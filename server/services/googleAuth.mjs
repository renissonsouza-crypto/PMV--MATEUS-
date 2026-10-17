import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { digest, newToken, fail } from './enrollmentConfirmation.mjs';

const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 5000 });
export function googleConfiguration(env = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const secret = env.GOOGLE_CLIENT_SECRET?.trim();
  const baseUrl = env.APP_BASE_URL?.trim();
  if (!clientId || !secret || !baseUrl) throw fail('A entrada com Google ainda não está configurada. Entre em contato com o atendimento.', 503);
  let origin;
  try { origin = new URL(baseUrl); } catch { throw fail('Endereço de login não configurado.', 503); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local && env.NODE_ENV !== 'production'))) throw fail('Endereço de login não configurado.', 503);
  return { clientId, secret, origin: origin.origin, secure: origin.protocol === 'https:', redirectUri: `${origin.origin}/api/auth?action=callback` };
}
export function authCookie(name, value, config, maxAge) {
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${config.secure ? '; Secure' : ''}`;
}
export function cookieValue(req, name) {
  const parts = String(req.headers?.cookie ?? '').split(';').map(part => part.trim());
  return parts.find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}
const mac = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');
export function beginGoogle(config) {
  const state = newToken(), nonce = newToken(), verifier = randomBytes(32).toString('base64url');
  const value = Buffer.from(JSON.stringify({ state, nonce, verifier, expires: Date.now() + 600000 })).toString('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
  return { url: url.href, cookie: authCookie('qv_oauth', `${value}.${mac(value, config.secret)}`, config, 600) };
}
export function readGoogleState(cookie, state, config) {
  if (typeof cookie !== 'string' || cookie.length > 2000 || typeof state !== 'string') throw fail('A tentativa de login venceu. Tente novamente.', 403);
  const [value, signature, extra] = cookie.split('.');
  const expected = mac(value ?? '', config.secret);
  if (extra || !signature || !/^[A-Za-z0-9_-]{43}$/.test(signature) || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw fail('Tentativa de login inválida.', 403);
  let data;
  try { data = JSON.parse(Buffer.from(value, 'base64url').toString()); } catch { throw fail('Tentativa de login inválida.', 403); }
  if (data.state !== state || !Number.isFinite(data.expires) || data.expires <= Date.now() || data.expires > Date.now() + 600000 || typeof data.verifier !== 'string' || typeof data.nonce !== 'string') throw fail('A tentativa de login venceu ou é inválida. Tente novamente.', 403);
  return data;
}
export async function verifyGoogleIdentity(idToken, config, nonce, keySet = keys) {
  const { payload } = await jwtVerify(idToken, keySet, { algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: config.clientId, requiredClaims: ['exp', 'iat', 'sub', 'email', 'email_verified', 'nonce'], maxTokenAge: '10m', clockTolerance: 5 });
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== 'string' || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255) throw fail('O Google não confirmou a identidade desta conta.', 403);
  // Google is authoritative for Gmail and verified Workspace domains, not arbitrary external addresses.
  const email = payload.email.trim().toLowerCase();
  if (!/^[^@\s]+@gmail\.com$/.test(email) && !(typeof payload.hd === 'string' && payload.hd && email.endsWith(`@${payload.hd.toLowerCase()}`))) throw fail('Use uma conta Gmail ou Google Workspace com domínio verificado.', 403);
  return { email, subject: payload.sub, name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : '' };
}
export async function exchangeGoogle(code, state, config, fetcher = fetch) {
  if (typeof code !== 'string' || !code || code.length > 4096) throw fail('Código de login inválido.', 400);
  const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.secret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code, code_verifier: state.verifier }) });
  const result = await response.json();
  if (!response.ok || typeof result.id_token !== 'string') throw fail('Não foi possível validar o acesso com Google. Tente novamente.', 403);
  return verifyGoogleIdentity(result.id_token, config, state.nonce);
}
export function publicProfile(person, rows) {
  const data = typeof person.payload === 'string' ? JSON.parse(person.payload) : person.payload;
  const fields = Object.fromEntries(['nome', 'telefone', 'whatsapp', 'cep', 'bairro', 'rua', 'numero', 'complemento', 'escolaridade', 'situacaoEmprego'].map(key => [key, typeof data?.[key] === 'string' ? data[key] : '']));
  return { ...fields, id: Number(person.id), email: person.email, enrollments: rows.filter(row => !row.cancelled_at).map(row => ({ courseId: Number(row.course_id), requestId: row.id, enrolledAt: new Date(row.confirmed_at).toISOString() })), enrollmentHistory: rows.map(row => ({ courseId: Number(row.course_id), enrolledAt: new Date(row.confirmed_at).toISOString() })) };
}
export async function finishGoogleLogin(repository, identity) {
  const bound = await repository.bySubject(identity.subject);
  const matches = bound ? [bound] : await repository.byEmail(identity.email);
  if (matches.length !== 1) throw fail('Não foi possível acessar o cadastro. Confira a conta Google escolhida ou faça seu cadastro na plataforma.', 404);
  const linked = bound ?? await repository.bind(identity.subject, Number(matches[0].id));
  if (!linked || Number(linked.id) !== Number(matches[0].id)) throw fail('Esta conta não pode ser vinculada ao cadastro. Entre em contato com o atendimento.', 403);
  const token = newToken();
  await repository.session(Number(linked.id), digest(token));
  return token;
}


export function beginGoogleIdentity(config) {
  const start = beginGoogle(config);
  const url = new URL(start.url);
  const nonce = url.searchParams.get('nonce');
  return { nonce, expiresAt: new Date(Date.now() + 600000).toISOString(), cookie: start.cookie.replace('qv_oauth=', 'qv_gis=') };
}
export function readGoogleIdentity(cookie, config) {
  // Reuse the authenticated envelope validation, including its expiry and nonce.
  if (typeof cookie !== 'string' || cookie.length > 2000) throw fail('Tentativa de login inválida.', 403);
  let state;
  try { state = JSON.parse(Buffer.from(cookie.split('.')[0], 'base64url').toString()).state; }
  catch { throw fail('Tentativa de login inválida.', 403); }
  return readGoogleState(cookie, state, config);
}


export async function finishGoogleAccess(repository, identity) {
  const bound = await repository.bySubject(identity.subject);
  const matches = bound ? [bound] : await repository.byEmail(identity.email);
  if (matches.length) return { kind: 'session', token: await finishGoogleLogin(repository, identity) };
  const token = newToken();
  await repository.createSignup(digest(token), identity, new Date(Date.now() + 30 * 60000).toISOString());
  return { kind: 'signup', token };
}

export async function registrationGoogleIntent(req, repository) {
  const token = cookieValue(req, 'qv_signup');
  if (!token && req.body?.googleSignup !== true) return null;
  if (!/^[a-f0-9]{64}$/.test(token)) throw fail('A confirmação Google venceu. Entre novamente com Google para concluir o cadastro.', 401);
  const intent = await repository.signup(digest(token));
  if (!intent) throw fail('A confirmação Google venceu ou já foi utilizada. Entre novamente com Google.', 401);
  if (typeof req.body?.email !== 'string' || req.body.email.trim().toLowerCase() !== intent.email) throw fail('Use o e-mail confirmado pela sua conta Google.', 400);
  return { ...intent, tokenHash: digest(token) };
}
export const clearGoogleSignupCookie = 'qv_signup=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
