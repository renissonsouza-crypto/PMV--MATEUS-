import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPair, SignJWT } from 'jose';
import { authController } from '../server/controllers/authController.mjs';
import { sqliteAuthRepository } from '../server/models/AuthRepository.mjs';
import { beginGoogle, readGoogleState, googleConfiguration, verifyGoogleIdentity, finishGoogleLogin } from '../server/services/googleAuth.mjs';
import { digest } from '../server/services/enrollmentConfirmation.mjs';

const config = { clientId: 'test.apps.googleusercontent.com', secret: 'test-server-secret', origin: 'https://example.test', secure: true, redirectUri: 'https://example.test/api/auth?action=callback' };
const { publicKey, privateKey } = await generateKeyPair('RS256');
const sign = (overrides = {}, options = {}) => new SignJWT({ email: 'person@gmail.com', email_verified: true, nonce: 'expected-nonce', ...overrides }).setProtectedHeader({ alg: 'RS256' }).setIssuer(options.issuer ?? 'https://accounts.google.com').setAudience(options.audience ?? config.clientId).setSubject('google-person-123').setIssuedAt().setExpirationTime(options.exp ?? '5m').sign(privateKey);
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE registrations(id INTEGER PRIMARY KEY, name TEXT, email TEXT, payload TEXT)');
  const data = { nome: 'Pessoa Google', email: 'person@gmail.com', cpf: '52998224725', telefone: '27999999999', numero: '', autorizaDados: true };
  db.prepare('INSERT INTO registrations VALUES (1, ?, ?, ?)').run(data.nome, data.email, JSON.stringify(data));
  return { db, repository: sqliteAuthRepository(db) };
}
async function invoke(controller, url, { method = 'GET', headers = {}, body } = {}) {
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, end() { return this; } };
  await controller({ url, method, headers, body }, response);
  return response;
}

test('Google configuration fails closed and permits HTTP only on development loopback', () => {
  assert.throws(() => googleConfiguration({}), error => error.statusCode === 503);
  const env = { GOOGLE_CLIENT_ID: config.clientId, GOOGLE_CLIENT_SECRET: config.secret, APP_BASE_URL: 'https://example.test' };
  assert.equal(googleConfiguration(env).redirectUri, config.redirectUri);
  for (const origin of ['http://example.test', 'https://example.test/elsewhere', 'https://user@example.test', 'https://example.test/#unsafe']) assert.throws(() => googleConfiguration({ ...env, APP_BASE_URL: origin }));
  assert.equal(googleConfiguration({ ...env, APP_BASE_URL: 'http://localhost:5173' }).secure, false);
  assert.throws(() => googleConfiguration({ ...env, APP_BASE_URL: 'http://localhost:5173', NODE_ENV: 'production' }));
});

test('OAuth state is signed, expires, binds browser and uses PKCE, nonce and fixed redirect', () => {
  const start = beginGoogle(config);
  const url = new URL(start.url);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'), config.redirectUri);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(start.cookie, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=600; Secure/);
  assert(!start.url.includes(config.secret));
  const cookie = start.cookie.split(';')[0].slice('qv_oauth='.length);
  const state = readGoogleState(cookie, url.searchParams.get('state'), config);
  assert.equal(state.nonce, url.searchParams.get('nonce'));
  for (const [value, query] of [[cookie, 'wrong'], ['', url.searchParams.get('state')], [cookie + 'x', url.searchParams.get('state')]]) assert.throws(() => readGoogleState(value, query, config));
  const previous = Date.now;
  try { Date.now = () => previous() + 660000; assert.throws(() => readGoogleState(cookie, url.searchParams.get('state'), config)); }
  finally { Date.now = previous; }
});

test('Google JWT verification requires signature, issuer, audience, nonce, expiry and authoritative verified email', async () => {
  const good = await sign();
  assert.equal((await verifyGoogleIdentity(good, config, 'expected-nonce', publicKey)).subject, 'google-person-123');
  assert.equal((await verifyGoogleIdentity(await sign({ email: 'worker@company.test', hd: 'company.test' }), config, 'expected-nonce', publicKey)).email, 'worker@company.test');
  const invalid = [await sign({ email_verified: false }), await sign({ nonce: 'other' }), await sign({}, { issuer: 'https://evil.test' }), await sign({}, { audience: 'other-app' }), await sign({}, { exp: '-1m' }), await sign({ email: 'victim@external.test' }), await sign({ email: 'victim@external.test', hd: 'different.test' })];
  for (const token of invalid) await assert.rejects(verifyGoogleIdentity(token, config, 'expected-nonce', publicKey));
  const otherKeys = await generateKeyPair('RS256');
  await assert.rejects(verifyGoogleIdentity(good, config, 'expected-nonce', otherKeys.publicKey));
});

test('Google callback restores only matched account, stores session hash and logout revokes it', async () => {
  const { db, repository } = fixture();
  try {
    let exchanges = 0;
    const controller = authController(repository, { configuration: () => config, exchange: async (code, state) => { exchanges++; assert.equal(code, 'valid-code'); assert(state.verifier); return { email: 'person@gmail.com', subject: 'google-person-123' }; } });
    const start = await invoke(controller, '/api/auth?action=start');
    assert.equal(start.code, 302);
    const state = new URL(start.headers.Location).searchParams.get('state');
    const cookie = start.headers['Set-Cookie'].split(';')[0];
    const wrong = await invoke(controller, '/api/auth?action=callback&code=valid-code&state=wrong', { headers: { cookie } });
    assert.equal(exchanges, 0);
    assert.match(wrong.headers.Location, /google-login-error=failed/);
    const callback = await invoke(controller, `/api/auth?action=callback&code=valid-code&state=${state}`, { headers: { cookie } });
    assert.equal(exchanges, 1);
    assert.equal(callback.headers.Location, 'https://example.test/#google-login');
    const sessionCookie = callback.headers['Set-Cookie'][1].split(';')[0];
    const rawToken = sessionCookie.slice('qv_session='.length);
    assert(db.prepare('SELECT 1 FROM profile_sessions WHERE token_hash = ?').get(digest(rawToken)));
    assert(!db.prepare('SELECT 1 FROM profile_sessions WHERE token_hash = ?').get(rawToken));
    const recovered = await invoke(controller, '/api/auth?action=session', { headers: { cookie: sessionCookie } });
    assert.equal(recovered.data.profile.id, 1);
    assert.equal(recovered.data.profile.numero, '');
    assert.equal(recovered.data.profile.cpf, undefined);
    assert.equal(recovered.headers['Cache-Control'], 'no-store');
    assert.equal((await invoke(controller, '/api/auth?action=session')).code, 401);
    assert.equal((await invoke(controller, '/api/auth?action=logout')).code, 405);
    const crossOrigin = { 'content-type': 'application/json', cookie: sessionCookie, host: 'example.test', origin: 'https://evil.test', 'x-forwarded-proto': 'https' };
    assert.equal((await invoke(controller, '/api/auth?action=logout', { method: 'POST', headers: crossOrigin, body: {} })).code, 403);
    const logout = await invoke(controller, '/api/auth?action=logout', { method: 'POST', headers: { ...crossOrigin, origin: 'https://example.test' }, body: {} });
    assert.equal(logout.code, 200);
    assert.equal((await invoke(controller, '/api/auth?action=session', { headers: { cookie: sessionCookie } })).code, 401);
  } finally { db.close(); }
});

test('unknown account, duplicate email, conflicting identity and expired sessions fail safely', async () => {
  const { db, repository } = fixture();
  try {
    await assert.rejects(finishGoogleLogin(repository, { email: 'unknown@gmail.com', subject: 'unknown' }), error => error.statusCode === 404);
    await finishGoogleLogin(repository, { email: 'person@gmail.com', subject: 'original' });
    await assert.rejects(finishGoogleLogin(repository, { email: 'person@gmail.com', subject: 'other' }), error => error.statusCode === 403);
    // Future sign-ins use Google's stable subject, not a new address supplied by the browser.
    await finishGoogleLogin(repository, { email: 'changed@gmail.com', subject: 'original' });
    db.prepare('INSERT INTO registrations VALUES (2, ?, ?, ?)').run('Duplicate', 'duplicate@gmail.com', '{}');
    db.prepare('INSERT INTO registrations VALUES (3, ?, ?, ?)').run('Duplicate', 'DUPLICATE@gmail.com', '{}');
    await assert.rejects(finishGoogleLogin(repository, { email: 'duplicate@gmail.com', subject: 'duplicate' }), error => error.statusCode === 404);
    const token = 'a'.repeat(64);
    await repository.session(1, digest(token));
    db.prepare("UPDATE profile_sessions SET expires_at = '2000-01-01'").run();
    const response = await invoke(authController(repository), '/api/auth?action=session', { headers: { cookie: `qv_session=${token}` } });
    assert.equal(response.code, 401);
  } finally { db.close(); }
});

test('missing provider configuration disables UI and rejects attempts without fake login', async () => {
  const { db, repository } = fixture();
  try {
    const controller = authController(repository, { configuration: () => googleConfiguration({}) });
    assert.deepEqual((await invoke(controller, '/api/auth?action=config')).data, { enabled: false });
    assert.equal((await invoke(controller, '/api/auth?action=start')).code, 503);
    assert.equal(db.prepare('SELECT count(*) AS n FROM profile_sessions').get().n, 0);
  } finally { db.close(); }
});

test('profile recovery includes server-confirmed history and excludes pending requests and sensitive registration payload', async () => {
  const { db, repository } = fixture();
  try {
    const { publicProfile } = await import('../server/services/googleAuth.mjs');
    const insert = db.prepare('INSERT INTO course_enrollment_requests(id, registration_id, course_id, token_hash, status_hash, delivery, created_at, expires_at, confirmed_at, cancelled_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)');
    const now = new Date().toISOString();
    insert.run('active', 1, 'hash1', 'status1', 'sent', now, now, now, null);
    insert.run('cancelled', 2, 'hash2', 'status2', 'sent', now, now, now, now);
    insert.run('pending', 3, 'hash3', 'status3', 'sent', now, now, null, null);
    const token = await finishGoogleLogin(repository, { email: 'person@gmail.com', subject: 'real-google-sub' });
    const person = await repository.authenticated(digest(token));
    const profile = publicProfile(person, await repository.enrollments(1));
    assert.deepEqual(profile.enrollments.map(row => row.courseId), [1]);
    assert.equal(profile.enrollmentHistory.length, 2, 'Cancelled courses still count in monthly history');
    for (const field of ['cpf', 'payload', 'dataNascimento', 'autorizaDados']) assert.equal(profile[field], undefined);
  } finally { db.close(); }
});


test('first verified Google login revokes unverified registration sessions without revoking later verified sessions', async () => {
  const { db, repository } = fixture();
  try {
    const old = 'a'.repeat(64);
    await repository.session(1, digest(old));
    const verified = await finishGoogleLogin(repository, { email: 'person@gmail.com', subject: 'google-owner' });
    assert.equal(await repository.authenticated(digest(old)), undefined);
    assert.equal((await repository.authenticated(digest(verified))).id, 1);
    await finishGoogleLogin(repository, { email: 'person@gmail.com', subject: 'google-owner' });
    assert.equal((await repository.authenticated(digest(verified))).id, 1);
  } finally { db.close(); }
});

test('Google account chooser validates signed identity and issues one session per browser challenge', async () => {
  const { db, repository } = fixture();
  try {
    const controller = authController(repository, { configuration: () => config, verify: (token, settings, nonce) => verifyGoogleIdentity(token, settings, nonce, publicKey) });
    const challenge = await invoke(controller, '/api/auth?action=challenge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: {} });
    assert.equal(challenge.code, 200);
    assert.equal(challenge.data.nonce.length, 64);
    const cookie = challenge.headers['Set-Cookie'].split(';')[0];
    const credential = await sign({ nonce: challenge.data.nonce });
    const request = { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: { credential } };
    const results = await Promise.all(Array.from({ length: 5 }, () => invoke(controller, '/api/auth?action=credential', request)));
    assert.equal(results.filter(result => result.code === 200).length, 1);
    assert.equal(results.filter(result => result.code === 403).length, 4);
    const success = results.find(result => result.code === 200);
    assert.deepEqual(success.data, { status: 'authenticated' });
    assert(!JSON.stringify(success.data).includes(credential));
    const sessionCookie = success.headers['Set-Cookie'][1].split(';')[0];
    const restored = await invoke(controller, '/api/auth?action=session', { headers: { cookie: sessionCookie } });
    assert.equal(restored.data.profile.email, 'person@gmail.com');
    assert.equal(db.prepare('SELECT count(*) AS n FROM profile_sessions').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM google_login_challenges').get().n, 0);
  } finally { db.close(); }
});

test('Google chooser rejects wrong nonce, missing browser state, cross origin, expired and superseded challenges', async () => {
  const { db, repository } = fixture();
  try {
    const controller = authController(repository, { configuration: () => config, verify: (token, settings, nonce) => verifyGoogleIdentity(token, settings, nonce, publicKey) });
    const headers = { 'content-type': 'application/json' };
    assert.equal((await invoke(controller, '/api/auth?action=challenge')).code, 405);
    assert.equal((await invoke(controller, '/api/auth?action=challenge', { method: 'POST', headers: { ...headers, origin: 'https://evil.test', host: 'example.test', 'x-forwarded-proto': 'https' }, body: {} })).code, 403);
    const first = await invoke(controller, '/api/auth?action=challenge', { method: 'POST', headers, body: {} });
    const cookie = first.headers['Set-Cookie'].split(';')[0];
    assert.equal((await invoke(controller, '/api/auth?action=credential', { method: 'POST', headers, body: { credential: await sign() } })).code, 403);
    assert.equal((await invoke(controller, '/api/auth?action=credential', { method: 'POST', headers: { ...headers, cookie }, body: { credential: await sign({ nonce: 'incorrect' }) } })).code, 403);
    const second = await invoke(controller, '/api/auth?action=challenge', { method: 'POST', headers: { ...headers, cookie }, body: {} });
    assert.equal((await invoke(controller, '/api/auth?action=credential', { method: 'POST', headers: { ...headers, cookie }, body: { credential: await sign({ nonce: first.data.nonce }) } })).code, 403);
    db.prepare("UPDATE google_login_challenges SET expires_at = '2000-01-01'").run();
    assert.equal((await invoke(controller, '/api/auth?action=credential', { method: 'POST', headers: { ...headers, cookie: second.headers['Set-Cookie'].split(';')[0] }, body: { credential: await sign({ nonce: second.data.nonce }) } })).code, 403);
    assert.equal(db.prepare('SELECT count(*) AS n FROM profile_sessions').get().n, 0);
  } finally { db.close(); }
});

test('signing out invalidates a pending Google chooser challenge', async () => {
  const { db, repository } = fixture();
  try {
    const controller = authController(repository, { configuration: () => config, verify: (token, settings, nonce) => verifyGoogleIdentity(token, settings, nonce, publicKey) });
    const headers = { 'content-type': 'application/json' };
    const challenge = await invoke(controller, '/api/auth?action=challenge', { method: 'POST', headers, body: {} });
    const cookie = challenge.headers['Set-Cookie'].split(';')[0];
    const signed = await sign({ nonce: challenge.data.nonce });
    const logout = await invoke(controller, '/api/auth?action=logout', { method: 'POST', headers: { ...headers, cookie }, body: {} });
    assert.equal(logout.code, 200);
    const replay = await invoke(controller, '/api/auth?action=credential', { method: 'POST', headers: { ...headers, cookie }, body: { credential: signed } });
    assert.equal(replay.code, 403);
    assert.equal(db.prepare('SELECT count(*) AS n FROM profile_sessions').get().n, 0);
  } finally { db.close(); }
});

test('new Google identity starts registration without creating an incomplete profile or a session', async () => {
  const { db, repository } = fixture();
  try {
    const controller = authController(repository, { configuration: () => config, verify: (token, settings, nonce) => verifyGoogleIdentity(token, settings, nonce, publicKey) });
    const headers = { 'content-type': 'application/json' };
    const challenge = await invoke(controller, '/api/auth?action=challenge', { method: 'POST', headers, body: {} });
    const credential = await sign({ email: 'new-user@gmail.com', name: 'Nova Pessoa', nonce: challenge.data.nonce });
    const result = await invoke(controller, '/api/auth?action=credential', { method: 'POST', headers: { ...headers, cookie: challenge.headers['Set-Cookie'].split(';')[0] }, body: { credential } });
    assert.equal(result.code, 200);
    assert.deepEqual(result.data, { status: 'registration-required' });
    const cookie = result.headers['Set-Cookie'][2].split(';')[0];
    assert.match(result.headers['Set-Cookie'][2], /HttpOnly; SameSite=Lax; Path=\/; Max-Age=1800; Secure/);
    const pending = await invoke(controller, '/api/auth?action=session', { headers: { cookie } });
    assert.deepEqual(pending.data, { status: 'registration-required', identity: { nome: 'Nova Pessoa', email: 'new-user@gmail.com' } });
    assert.equal(db.prepare('SELECT count(*) AS n FROM registrations').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM profile_sessions').get().n, 0);
    const raw = cookie.slice('qv_signup='.length);
    assert(db.prepare('SELECT 1 FROM google_signup_intents WHERE token_hash = ?').get(digest(raw)));
    assert(!db.prepare('SELECT 1 FROM google_signup_intents WHERE token_hash = ?').get(raw));
    const { registrationGoogleIntent } = await import('../server/services/googleAuth.mjs');
    await assert.rejects(registrationGoogleIntent({ headers: {}, body: { googleSignup: true, email: 'new-user@gmail.com' } }, repository), error => error.statusCode === 401);
    await assert.rejects(registrationGoogleIntent({ headers: { cookie }, body: { googleSignup: true, email: 'victim@gmail.com' } }, repository), error => error.statusCode === 400);
    assert.equal((await registrationGoogleIntent({ headers: { cookie }, body: { googleSignup: true, email: 'new-user@gmail.com' } }, repository)).subject, 'google-person-123');
    const cancelled = await invoke(controller, '/api/auth?action=cancel-signup', { method: 'POST', headers: { ...headers, cookie }, body: {} });
    assert.equal(cancelled.code, 200);
    assert.equal(db.prepare('SELECT count(*) AS n FROM google_signup_intents').get().n, 0);
    assert.equal((await invoke(controller, '/api/auth?action=session', { headers: { cookie } })).code, 401);
  } finally { db.close(); }
});

test('redirect Google login also supports a new user and pending registration expires', async () => {
  const { db, repository } = fixture();
  try {
    const controller = authController(repository, { configuration: () => config, exchange: async () => ({ email: 'redirect-new@gmail.com', subject: 'redirect-subject', name: 'New User' }) });
    const start = await invoke(controller, '/api/auth?action=start');
    const state = new URL(start.headers.Location).searchParams.get('state');
    const result = await invoke(controller, `/api/auth?action=callback&code=temporary-code&state=${state}`, { headers: { cookie: start.headers['Set-Cookie'].split(';')[0] } });
    assert.equal(result.code, 302);
    assert.equal(result.headers.Location, 'https://example.test/#google-login');
    const cookie = result.headers['Set-Cookie'][2].split(';')[0];
    assert.equal((await invoke(controller, '/api/auth?action=session', { headers: { cookie } })).data.status, 'registration-required');
    db.prepare("UPDATE google_signup_intents SET expires_at = '2000-01-01'").run();
    assert.equal((await invoke(controller, '/api/auth?action=session', { headers: { cookie } })).code, 401);
  } finally { db.close(); }
});
