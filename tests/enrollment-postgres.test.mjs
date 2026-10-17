import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { enrollmentService, digest } from '../server/services/enrollmentConfirmation.mjs';

// Execute the production repository SQL in PostgreSQL/WASM without remote credentials.
// The adapter only replaces Neon's HTTP transport; schema, parameters and transactions are real SQL.
const database = new PGlite();
const query = (text, params = []) => ({ text, params, then(resolve, reject) { return database.query(text, params).then(result => result.rows).then(resolve, reject); } });
const sql = (parts, ...params) => query(parts.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''), params);
sql.query = query;
sql.transaction = statements => database.transaction(async tx => {
  const results = [];
  for (const statement of statements) results.push((await tx.query(statement.text, statement.params)).rows);
  return results;
});
globalThis.__enrollmentPostgresSql = sql;
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@neondatabase/serverless') return { url: `data:text/javascript,${encodeURIComponent('export const neon = () => globalThis.__enrollmentPostgresSql;')}`, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const previous = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://test:test@isolated.invalid/test';
const { ensurePostgresSchema } = await import('../server/config/postgres.mjs');
const { postgresEnrollmentRepository } = await import('../server/models/PostgresEnrollmentRepository.mjs');
await ensurePostgresSchema();
test.after(async () => {
  hooks.deregister();
  delete globalThis.__enrollmentPostgresSql;
  if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  await database.close();
});
async function fixture() {
  await database.exec('TRUNCATE registrations RESTART IDENTITY CASCADE');
  const person = { nome: 'Pessoa PostgreSQL', email: 'postgres@example.test', telefone: '27999999999', cep: '29050945', bairro: 'Bento Ferreira', rua: 'Rua Teste', numero: '1', escolaridade: 'Ensino médio' };
  await database.query("INSERT INTO registrations(name,cpf,email,phone,birth_date,neighborhood,payload) VALUES ($1,'12345678909',$2,$3,'1990-01-01',$4,$5)", [person.nome, person.email, person.telefone, person.bairro, JSON.stringify(person)]);
  const repository = postgresEnrollmentRepository();
  const mails = [];
  const service = enrollmentService(repository, { configuration: () => ({}), send: async mail => { mails.push(mail); } });
  return { repository, service, mails, input: { registrationId: 1, email: person.email, courseId: 1 } };
}

test('PostgreSQL production schema and request/confirm/status/cancel operate on real rows', async () => {
  const { repository, service, mails, input } = await fixture();
  const pending = await service.request(input);
  assert.equal((await service.status(pending)).status, 'pending');
  const confirmed = await service.confirm({ token: mails[0].token });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.profile.email, input.email);
  await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 409);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM profile_sessions')).rows[0].n, 1);
  assert.equal((await service.status(pending)).status, 'confirmed');
  await assert.rejects(repository.cancel(confirmed.requestId, digest('b'.repeat(64)), new Date().toISOString()), error => error.statusCode === 403);
  assert.equal((await service.cancel({ requestId: confirmed.requestId }, confirmed.profile.profileToken)).status, 'cancelled');
  await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 409);
});

test('PostgreSQL concurrent confirmations cannot exceed three monthly enrollments or duplicate a course', async () => {
  const { service, mails, input } = await fixture();
  for (const courseId of [1, 2, 3, 4]) await service.request({ ...input, courseId });
  const results = await Promise.allSettled(mails.map(mail => service.confirm({ token: mail.token })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);
  const [count] = (await database.query('SELECT count(*)::int AS count FROM course_enrollment_requests WHERE confirmed_at IS NOT NULL')).rows;
  assert.equal(count.count, 3);
  await assert.rejects(service.request(input), error => error.statusCode === 429);
});

test('PostgreSQL expired and failed-delivery links cannot finalize an enrollment', async () => {
  const { service, mails, input } = await fixture();
  const pending = await service.request(input);
  await database.query("UPDATE course_enrollment_requests SET expires_at = '2000-01-01' WHERE id = $1", [pending.requestId]);
  await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 410);
  assert.equal((await service.status(pending)).status, 'expired');
  await assert.rejects(service.status({ ...pending, statusToken: 'f'.repeat(64) }), error => error.statusCode === 404);
});


test('PostgreSQL concurrent reuse of the same token creates exactly one profile session', async () => {
  const { service, mails, input } = await fixture();
  await service.request(input);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => service.confirm({ token: mails[0].token })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert(results.filter(result => result.status === 'rejected').every(result => result.reason.statusCode === 409));
  assert.equal((await database.query('SELECT count(*)::int AS n FROM profile_sessions')).rows[0].n, 1);
});

test('PostgreSQL Google identity binding, authenticated profile and revocation use production SQL', async () => {
  await fixture();
  const { postgresAuthRepository } = await import('../server/models/AuthRepository.mjs');
  const { finishGoogleLogin, publicProfile } = await import('../server/services/googleAuth.mjs');
  const repository = postgresAuthRepository();
  const token = await finishGoogleLogin(repository, { email: 'postgres@example.test', subject: 'verified-google-subject' });
  assert.equal(Number((await repository.bySubject('verified-google-subject')).id), 1);
  const person = await repository.authenticated(digest(token));
  assert.equal(publicProfile(person, await repository.enrollments(1)).email, 'postgres@example.test');
  await assert.rejects(finishGoogleLogin(repository, { email: 'postgres@example.test', subject: 'different-subject' }), error => error.statusCode === 403);
  await repository.revoke([digest(token)]);
  assert.equal(await repository.authenticated(digest(token)), undefined);
});

test('PostgreSQL direct enrollment is authenticated, idempotent under concurrency and enforces monthly cap', async () => {
  const { service, repository, input, mails } = await fixture();
  const token = 'd'.repeat(64);
  await repository.session(1, digest(token));
  await assert.rejects(service.enroll(input, 'e'.repeat(64)), error => error.statusCode === 401);
  const repeated = await Promise.all(Array.from({ length: 8 }, () => service.enroll(input, token)));
  assert.equal(new Set(repeated.map(result => result.requestId)).size, 1);
  const more = await Promise.allSettled([2, 3, 4].map(courseId => service.enroll({ ...input, courseId }, token)));
  assert.equal(more.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal(more.filter(result => result.status === 'rejected').length, 1);
  await service.cancel({ requestId: repeated[0].requestId }, token);
  await assert.rejects(service.enroll({ ...input, courseId: 4 }, token), error => error.statusCode === 409);
  assert.equal(mails.length, 0);
});

test('PostgreSQL registration and initial session commit together or roll back together', async () => {
  await fixture();
  const { createPostgresRegistration } = await import('../server/models/PostgresRegistrationModel.mjs');
  const data = { nome: 'New person', cpf: '52998224725', email: 'atomic@example.test', telefone: '27999999999', dataNascimento: '1990-01-01', bairro: 'Centro' };
  await database.exec("ALTER TABLE profile_sessions ADD CONSTRAINT reject_fixture CHECK(token_hash <> 'rejected-fixture')");
  try {
    await assert.rejects(createPostgresRegistration(data, 'rejected-fixture'));
    assert.equal((await database.query('SELECT id FROM registrations WHERE email = $1', [data.email])).rows.length, 0);
  } finally { await database.exec('ALTER TABLE profile_sessions DROP CONSTRAINT reject_fixture'); }
  const id = await createPostgresRegistration(data, digest('f'.repeat(64)));
  assert.equal((await database.query('SELECT registration_id FROM profile_sessions WHERE token_hash = $1', [digest('f'.repeat(64))])).rows[0].registration_id, id);
});


test('PostgreSQL first Google binding atomically invalidates prior unverified sessions', async () => {
  await fixture();
  const { postgresAuthRepository } = await import('../server/models/AuthRepository.mjs');
  const { finishGoogleLogin } = await import('../server/services/googleAuth.mjs');
  const repository = postgresAuthRepository();
  const previous = 'a'.repeat(64);
  await repository.session(1, digest(previous));
  const verified = await finishGoogleLogin(repository, { email: 'postgres@example.test', subject: 'owner' });
  assert.equal(await repository.authenticated(digest(previous)), undefined);
  assert.equal(Number((await repository.authenticated(digest(verified))).id), 1);
  await finishGoogleLogin(repository, { email: 'postgres@example.test', subject: 'owner' });
  assert.equal(Number((await repository.authenticated(digest(verified))).id), 1);
});

test('PostgreSQL Google chooser challenges are single-use across workers and expire', async () => {
  const { postgresAuthRepository } = await import('../server/models/AuthRepository.mjs');
  const repository = postgresAuthRepository();
  const hash = digest('browser-login-challenge');
  await repository.challenge(hash, new Date(Date.now() + 60000).toISOString());
  const results = await Promise.all(Array.from({ length: 8 }, () => repository.consumeChallenge(hash)));
  assert.equal(results.filter(Boolean).length, 1);
  await repository.challenge(hash, '2000-01-01T00:00:00.000Z');
  assert.equal(await repository.consumeChallenge(hash), false);
});

test('PostgreSQL completes Google signup atomically, rejects wrong email and preserves intent after database failure', async () => {
  await fixture();
  const { postgresAuthRepository } = await import('../server/models/AuthRepository.mjs');
  const { finishGoogleAccess } = await import('../server/services/googleAuth.mjs');
  const { createPostgresRegistration } = await import('../server/models/PostgresRegistrationModel.mjs');
  const repository = postgresAuthRepository();
  const identity = { email: 'signup-google@gmail.com', name: 'New Person', subject: 'new-google-subject' };
  const access = await finishGoogleAccess(repository, identity);
  assert.equal(access.kind, 'signup');
  const data = { nome: identity.name, cpf: '52998224725', email: identity.email, telefone: '27999999999', dataNascimento: '1990-01-01', bairro: 'Centro' };
  await assert.rejects(createPostgresRegistration({ ...data, email: 'other@gmail.com' }, digest('s'.repeat(64)), digest(access.token)), error => error.statusCode === 401);
  assert(await repository.signup(digest(access.token)));
  await database.exec("ALTER TABLE profile_sessions ADD CONSTRAINT reject_signup CHECK(token_hash <> 'reject-signup')");
  try {
    await assert.rejects(createPostgresRegistration(data, 'reject-signup', digest(access.token)));
    assert.equal((await database.query('SELECT id FROM registrations WHERE email = $1', [identity.email])).rows.length, 0);
    assert.equal(await repository.bySubject(identity.subject), undefined);
    assert(await repository.signup(digest(access.token)), 'Rollback must preserve the verified identity for retry');
  } finally { await database.exec('ALTER TABLE profile_sessions DROP CONSTRAINT reject_signup'); }
  const id = await createPostgresRegistration(data, digest('s'.repeat(64)), digest(access.token));
  assert.equal(Number((await repository.bySubject(identity.subject)).id), id);
  assert.equal(await repository.signup(digest(access.token)), undefined);
  assert.equal(Number((await repository.authenticated(digest('s'.repeat(64)))).id), id);
  const returning = await finishGoogleAccess(repository, identity);
  assert.equal(returning.kind, 'session');
  assert.equal(Number((await repository.authenticated(digest(returning.token))).id), id);
  assert.equal((await database.query('SELECT id FROM registrations WHERE email = $1', [identity.email])).rows.length, 1);
});

test('PostgreSQL concurrent Google signup consumes the confirmation once and creates one profile', async () => {
  await fixture();
  const { postgresAuthRepository } = await import('../server/models/AuthRepository.mjs');
  const { finishGoogleAccess } = await import('../server/services/googleAuth.mjs');
  const { createPostgresRegistration } = await import('../server/models/PostgresRegistrationModel.mjs');
  const repository = postgresAuthRepository();
  const identity = { email: 'concurrent-google@gmail.com', name: 'Person', subject: 'concurrent-new-subject' };
  const pending = await finishGoogleAccess(repository, identity);
  const data = { nome: identity.name, cpf: '52998224725', email: identity.email, telefone: '27999999999', dataNascimento: '1990-01-01', bairro: 'Centro' };
  const attempts = await Promise.allSettled(['u', 'v'].map(value => createPostgresRegistration(data, digest(value.repeat(64)), digest(pending.token))));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await database.query('SELECT id FROM registrations WHERE email = $1', [identity.email])).rows.length, 1);
  assert.equal(await repository.signup(digest(pending.token)), undefined);
});
