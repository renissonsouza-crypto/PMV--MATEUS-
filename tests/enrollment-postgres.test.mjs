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
