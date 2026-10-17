import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { sqliteEnrollmentRepository } from '../server/models/SqliteEnrollmentRepository.mjs';
import { enrollmentService, digest } from '../server/services/enrollmentConfirmation.mjs';
import { buildCourseEmail, emailConfiguration, sendCourseEmail } from '../server/services/courseEmail.mjs';
import { enrollmentController } from '../server/controllers/enrollmentController.mjs';
import { COURSES } from '../shared/courses.mjs';

function fixture({ send, configuration } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE registrations(id INTEGER PRIMARY KEY, name TEXT, email TEXT, payload TEXT)');
  const person = { nome: 'Pessoa Teste', email: 'person@example.test', telefone: '27999999999', cep: '29050945', bairro: 'Bento Ferreira', rua: 'Rua Teste', numero: '1', escolaridade: 'Ensino médio completo' };
  db.prepare('INSERT INTO registrations VALUES (?, ?, ?, ?)').run(1, person.nome, person.email, JSON.stringify(person));
  const repository = sqliteEnrollmentRepository(db);
  const mails = [];
  const service = enrollmentService(repository, { configuration: configuration ?? (() => ({})), send: send ?? (async content => { mails.push(content); }) });
  return { db, repository, service, mails, input: { registrationId: 1, email: person.email, courseId: 1 } };
}

test('course email contains the authoritative curriculum, location and exactly one confirmation button', () => {
  const email = buildCourseEmail({ name: '<script>name</script>', course: COURSES[0], token: 'a'.repeat(64), origin: 'https://example.test' });
  assert.equal((email.html.match(/<a /g) || []).length, 1);
  assert.match(email.html, /Confirmar minha inscrição/);
  assert.match(email.html, /#confirm-enrollment=/);
  assert.match(email.html, /&lt;script&gt;name/);
  assert.doesNotMatch(email.html, /<script>/);
  for (const topic of COURSES[0].whatYouLearn) assert(email.text.includes(topic));
  assert(email.text.includes(COURSES[0].title));
  assert(email.text.includes(COURSES[0].about));
  assert.match(email.text, /24 horas/);
  assert.match(email.text, /Online/);
  const onsite = buildCourseEmail({ name: 'Teste', course: { ...COURSES[0], modality: 'Presencial', location: '' }, token: 'a'.repeat(64), origin: 'https://example.test' });
  assert.match(onsite.text, /Local ainda não informado/);
});

test('missing mail settings and unsafe public URLs cannot result in a false sent confirmation', async () => {
  for (const env of [{}, { RESEND_API_KEY: 'test-only', MAIL_FROM: 'test@example.test', APP_BASE_URL: 'http://public.example.test', NODE_ENV: 'production' }, { RESEND_API_KEY: 'test-only', MAIL_FROM: 'test@example.test', APP_BASE_URL: 'https://example.test/?redirect=1' }]) assert.throws(() => emailConfiguration(env));
  const { db, service, input } = fixture({ configuration: () => emailConfiguration({}) });
  try {
    await assert.rejects(service.request(input), /ainda não está configurado/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM course_enrollment_requests').get().n, 0);
  } finally { db.close(); }
});

test('mail transport requires provider acceptance and does not leak provider errors', async () => {
  const names = ['RESEND_API_KEY', 'MAIL_FROM', 'APP_BASE_URL', 'NODE_ENV', 'MAIL_TEST_URL'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { RESEND_API_KEY: 'test-only-mail-key', MAIL_FROM: 'test@example.test', APP_BASE_URL: 'https://example.test', NODE_ENV: 'production' });
  try {
    const content = { to: 'person@example.test', name: 'Teste', course: COURSES[0], token: 'a'.repeat(64), requestId: 'fixture' };
    await sendCourseEmail(content, async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      assert.equal(options.headers['Idempotency-Key'], 'enrollment-fixture');
      assert.deepEqual(JSON.parse(options.body).to, ['person@example.test']);
      assert(options.signal instanceof AbortSignal);
      assert.equal(options.redirect, 'error', 'Provider redirects must never forward secrets');
      return Response.json({ id: 'mail-fixture' });
    });
    await assert.rejects(sendCourseEmail(content, async () => Response.json({ error: 'private provider detail' }, { status: 401 })), error => error.statusCode === 503 && !/private provider/.test(error.message));
  } finally { for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } }
});

test('enrollment stays pending until the private email token is confirmed and tokens are stored hashed', async () => {
  const { db, repository, service, input, mails } = fixture();
  try {
    const pending = await service.request({ ...input, title: 'Injected title', location: 'Fake location' });
    assert.equal(pending.status, 'pending');
    assert.equal(mails[0].course.title, COURSES[0].title);
    const row = db.prepare('SELECT * FROM course_enrollment_requests').get();
    assert.equal(row.confirmed_at, null);
    assert.equal(row.token_hash, digest(mails[0].token));
    assert.notEqual(row.token_hash, mails[0].token);
    assert.notEqual(row.status_hash, pending.statusToken);
    assert.equal((await service.status(pending)).status, 'pending');
    await assert.rejects(service.confirm({ token: pending.statusToken }), error => error.statusCode === 404);
    const confirmed = await service.confirm({ token: mails[0].token });
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.profile.email, input.email);
    assert.equal(confirmed.profile.id, 1);
    assert.equal(confirmed.profile.profileToken.length, 64);
    assert(db.prepare('SELECT 1 FROM profile_sessions WHERE token_hash = ?').get(digest(confirmed.profile.profileToken)));
    await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 409);
    assert.equal(db.prepare('SELECT count(*) AS n FROM profile_sessions').get().n, 1, 'Replay must not mint another session');
    assert.equal(db.prepare('SELECT count(*) AS n FROM course_enrollment_requests WHERE confirmed_at IS NOT NULL').get().n, 1);
    const status = await service.status(pending);
    assert.equal(status.status, 'confirmed');
    assert.equal(status.profile, undefined, 'Status polling cannot expose personal data or a profile session');
    await assert.rejects(repository.cancel(confirmed.requestId, digest('b'.repeat(64)), new Date().toISOString()), error => error.statusCode === 403);
    await service.cancel({ requestId: confirmed.requestId }, confirmed.profile.profileToken);
    await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 409);
  } finally { db.close(); }
});

test('expired links, failed delivery, wrong recipient and closed courses never activate enrollment', async () => {
  const { db, service, input, mails } = fixture();
  try {
    await assert.rejects(service.request({ ...input, email: 'other@example.test' }), error => error.statusCode === 404);
    await assert.rejects(service.request({ ...input, courseId: 6 }), /não está disponível/);
    const pending = await service.request(input);
    await assert.rejects(service.request(input), error => error.statusCode === 429);
    db.prepare('UPDATE course_enrollment_requests SET expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', pending.requestId);
    await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 410);
    assert.equal((await service.status(pending)).status, 'expired');
    assert.equal(db.prepare('SELECT count(*) AS n FROM course_enrollment_requests WHERE confirmed_at IS NOT NULL').get().n, 0);
  } finally { db.close(); }
});

test('provider failure allows a new attempt without enrolling or reusing the failed token', async () => {
  const mails = [];
  let failing = true;
  const { db, service, input } = fixture({ send: async mail => { mails.push(mail); if (failing) throw Object.assign(new Error('Mail unavailable'), { statusCode: 503 }); } });
  try {
    await assert.rejects(service.request(input), /Mail unavailable/);
    assert.equal(db.prepare('SELECT delivery FROM course_enrollment_requests').get().delivery, 'failed');
    await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 410);
    failing = false;
    await service.request(input);
    const confirmed = await service.confirm({ token: mails[1].token });
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(db.prepare('SELECT count(*) AS n FROM course_enrollment_requests WHERE confirmed_at IS NOT NULL').get().n, 1);
  } finally { db.close(); }
});

test('concurrent confirmations enforce the monthly limit, including canceled enrollments', async () => {
  const { db, service, input, mails } = fixture();
  try {
    for (const courseId of [1, 2, 3, 4]) await service.request({ ...input, courseId });
    const results = await Promise.allSettled(mails.map(mail => service.confirm({ token: mail.token })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);
    const confirmed = results.find(result => result.status === 'fulfilled').value;
    await service.cancel({ requestId: confirmed.requestId }, confirmed.profile.profileToken);
    await assert.rejects(service.confirm({ token: mails[3].token }), error => error.statusCode === 409);
  } finally { db.close(); }
});

test('GET and cross-origin requests cannot confirm enrollment', async () => {
  const { db, repository } = fixture();
  try {
    const controller = enrollmentController(repository);
    const invoke = async req => {
      const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
      await controller(req, res);
      return res;
    };
    assert.equal((await invoke({ method: 'GET', headers: {}, body: {} })).code, 405);
    assert.equal((await invoke({ method: 'POST', headers: { 'content-type': 'application/json', host: 'example.test', origin: 'https://evil.test', 'x-forwarded-proto': 'https' }, body: { action: 'confirm', token: 'a'.repeat(64) } })).code, 403);
  } finally { db.close(); }
});


test('concurrent reuse of one email token issues only one authenticated session', async () => {
  const { db, service, input, mails } = fixture();
  try {
    await service.request(input);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => service.confirm({ token: mails[0].token })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert(results.filter(result => result.status === 'rejected').every(result => result.reason.statusCode === 409));
    assert.equal(db.prepare('SELECT count(*) AS n FROM profile_sessions').get().n, 1);
  } finally { db.close(); }
});

test('cross-user sessions, expired sessions, tampered tokens and status credentials cannot authorize cancellation', async () => {
  const { db, repository, service, input, mails } = fixture();
  try {
    const pending = await service.request(input);
    for (const token of [null, {}, "' OR 1=1 --", 'a'.repeat(63), 'A'.repeat(64)]) {
      await assert.rejects(service.confirm({ token }), error => error.statusCode === 400);
    }
    await assert.rejects(service.status({ ...pending, statusToken: 'f'.repeat(64) }), error => error.statusCode === 404);
    db.prepare("UPDATE course_enrollment_requests SET delivery = 'sending'").run();
    await assert.rejects(service.confirm({ token: mails[0].token }), error => error.statusCode === 410);
    db.prepare("UPDATE course_enrollment_requests SET delivery = 'sent'").run();
    const confirmed = await service.confirm({ token: mails[0].token });
    db.prepare('INSERT INTO registrations VALUES (2, ?, ?, ?)').run('Other', 'other@example.test', '{}');
    const foreignToken = 'b'.repeat(64);
    await repository.session(2, digest(foreignToken));
    for (const token of [foreignToken, pending.statusToken, mails[0].token]) {
      await assert.rejects(service.cancel({ requestId: confirmed.requestId }, token), error => error.statusCode === 403);
    }
    db.prepare("UPDATE profile_sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    await assert.rejects(service.cancel({ requestId: confirmed.requestId }, confirmed.profile.profileToken), error => error.statusCode === 403);
    assert.equal(db.prepare('SELECT cancelled_at FROM course_enrollment_requests').get().cancelled_at, null);
  } finally { db.close(); }
});


test('email includes the archived accepted policies with one button, safe HTML and truthful legacy notice', async () => {
  const { policyReceipt } = await import('../shared/policies.mjs');
  const receipt = policyReceipt(new Date('2026-10-15T12:00:00.000Z'));
  receipt.policies.privacy.paragraphs[0] = 'Texto aceito anteriormente <script>invalid</script>';
  const content = { name: 'Pessoa', course: COURSES[0], token: 'a'.repeat(64), origin: 'https://example.test' };
  const email = buildCourseEmail({ ...content, consent: { receipt, dataAuthorized: true, termsAccepted: true } });
  assert.equal((email.html.match(/<a /g) || []).length, 1);
  assert.match(email.text, /Texto aceito anteriormente/);
  assert.match(email.html, /&lt;script&gt;invalid/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /versão 2026-10-16.2/);
  assert.match(email.text, /15\/10\/2026/);
  assert.match(email.text, /tratamento de dados autorizado; termos aceitos/);
  assert.match(email.text, /Lei Geral de Proteção de Dados Pessoais/);
  assert.match(buildCourseEmail(content).text, /cadastro antigo não contém uma cópia versionada/);
});

test('enrollment email uses only consent stored on the server, not injected request data', async () => {
  const { policyReceipt } = await import('../shared/policies.mjs');
  const { db, service, input, mails } = fixture();
  try {
    const row = db.prepare('SELECT payload FROM registrations WHERE id = 1').get();
    const payload = { ...JSON.parse(row.payload), policyReceipt: policyReceipt(), autorizaDados: true, aceitaTermos: true };
    db.prepare('UPDATE registrations SET payload = ? WHERE id = 1').run(JSON.stringify(payload));
    await service.request({ ...input, consent: { receipt: { version: 'forged' } }, policyReceipt: { version: 'forged' } });
    assert.equal(mails[0].consent.receipt.version, payload.policyReceipt.version);
    assert.equal(mails[0].consent.dataAuthorized, true);
    assert.equal(mails[0].consent.termsAccepted, true);
    assert.equal(mails[0].to, input.email);
  } finally { db.close(); }
});
