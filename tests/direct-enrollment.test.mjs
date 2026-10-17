import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { sqliteEnrollmentRepository } from '../server/models/SqliteEnrollmentRepository.mjs';
import { enrollmentService, digest } from '../server/services/enrollmentConfirmation.mjs';
import { enrollmentController } from '../server/controllers/enrollmentController.mjs';
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE registrations(id INTEGER PRIMARY KEY, name TEXT, email TEXT, payload TEXT); INSERT INTO registrations VALUES (1,'Person','person@example.test','{}'), (2,'Other','other@example.test','{}')");
  const repository = sqliteEnrollmentRepository(db);
  const token = 'a'.repeat(64);
  db.prepare('INSERT INTO profile_sessions VALUES (?, 1, ?)').run(digest(token), new Date(Date.now() + 86400000).toISOString());
  const service = enrollmentService(repository, { configuration() { throw new Error('Must not configure email'); }, send() { throw new Error('Must not send email'); } });
  return { db, repository, service, token, input: { registrationId: 1, courseId: 1 } };
}
test('direct enrollment is immediately persisted without any mail settings or provider', async () => {
  const { db, service, token, input } = fixture();
  try {
    const result = await service.enroll(input, token);
    assert.equal(result.status, 'confirmed');
    const row = db.prepare('SELECT * FROM course_enrollment_requests').get();
    assert.equal(row.delivery, 'direct');
    assert.equal(row.confirmed_at, result.enrolledAt);
    assert.notEqual(row.token_hash, token);
    assert.equal(result.profileToken, undefined);
  } finally { db.close(); }
});
test('direct enrollment rejects missing, foreign, expired or revoked sessions and unavailable courses', async () => {
  const { db, service, token, input } = fixture();
  try {
    for (const credential of [undefined, 'bad', 'b'.repeat(64)]) await assert.rejects(service.enroll(input, credential), error => error.statusCode === 401);
    await assert.rejects(service.enroll({ ...input, registrationId: 2 }, token), error => error.statusCode === 401);
    await assert.rejects(service.enroll({ ...input, courseId: 6 }, token), error => error.statusCode === 409);
    await assert.rejects(service.enroll({ ...input, registrationId: "1" }, token), error => error.statusCode === 400);
    db.prepare("UPDATE profile_sessions SET expires_at = '2000-01-01'").run();
    await assert.rejects(service.enroll(input, token), error => error.statusCode === 401);
    db.prepare('DELETE FROM profile_sessions').run();
    await assert.rejects(service.enroll(input, token), error => error.statusCode === 401);
    assert.equal(db.prepare('SELECT count(*) AS n FROM course_enrollment_requests').get().n, 0);
  } finally { db.close(); }
});
test('concurrent direct enrollment is idempotent and never exceeds monthly cap including cancellations', async () => {
  const { db, service, token, input } = fixture();
  try {
    const repeated = await Promise.all(Array.from({ length: 8 }, () => service.enroll(input, token)));
    assert.equal(new Set(repeated.map(result => result.requestId)).size, 1);
    const more = await Promise.allSettled([2, 3, 4].map(courseId => service.enroll({ ...input, courseId }, token)));
    assert.equal(more.filter(result => result.status === 'fulfilled').length, 2);
    assert.equal(more.filter(result => result.status === 'rejected').length, 1);
    await service.cancel({ requestId: repeated[0].requestId }, token);
    await assert.rejects(service.enroll({ ...input, courseId: 4 }, token), error => error.statusCode === 409);
    assert.equal(db.prepare('SELECT count(*) AS n FROM course_enrollment_requests').get().n, 3);
  } finally { db.close(); }
});
test('public API retires email requests and links, checks origin and sanitizes enrollment failures', async () => {
  const { db, repository, token, input } = fixture();
  try {
    const controller = enrollmentController(repository);
    const invoke = async (body, headers = {}, method = 'POST') => {
      const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
      await controller({ method, headers: { 'content-type': 'application/json', 'x-profile-token': token, ...headers }, body }, response);
      return response;
    };
    for (const action of ['request', 'confirm']) assert.equal((await invoke({ action, token, ...input })).code, 410);
    assert.equal((await invoke({ action: 'enroll', ...input }, {}, 'GET')).code, 405);
    assert.equal((await invoke({ action: 'enroll', ...input }, { origin: 'https://evil.test', host: 'example.test', 'x-forwarded-proto': 'https' })).code, 403);
    repository.enrollDirect = async () => { throw new Error('private database password'); };
    const failed = await invoke({ action: 'enroll', ...input });
    assert.equal(failed.code, 500);
    assert.doesNotMatch(failed.data.error, /password/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM course_enrollment_requests').get().n, 0);
  } finally { db.close(); }
});
