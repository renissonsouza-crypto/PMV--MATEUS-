import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findBrowserExecutable, startTestEnvironment } from './e2e-support.mjs';

// Only Google's account UI and public signing keys are simulated. The application
// verifies RS256 tokens and uses its real HTTP controllers, cookies and database.
const sdk = `window.google = { accounts: { id: {
  initialize(options) { window.__googleFixtureOptions = options; },
  renderButton(parent) {
    const button = document.createElement('button');
    button.textContent = 'Usar conta Google simulada';
    button.style.cssText = 'min-height:44px;width:100%';
    button.onclick = async () => {
      const credential = await window.googleFixtureCredential(window.__googleFixtureOptions.nonce);
      window.__googleFixtureOptions.callback({ credential });
    };
    parent.append(button);
  },
  prompt() {}, cancel() {}
} } };`;
const tests = [];
const test = (name, run, options = {}) => tests.push({ name, run, options });
const profileKey = 'qualificavix-profile';
const storedProfile = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), profileKey);
const profile = (id, name, email) => ({ id, nome: name, email, telefone: '27999999999', cep: '29050-945', bairro: 'Bento Ferreira', rua: 'Rua de teste', numero: '', escolaridade: 'Ensino médio completo', enrolledCourseIds: [], enrollments: [] });

async function post(context, action, data, token) {
  return context.request.post(`${environment.baseURL}/api/${action}`, {
    headers: { Origin: environment.baseURL, ...(token ? { 'x-profile-token': token } : {}) }, data,
  });
}
async function seedAccounts(context, index) {
  const ana = profile(8100 + index * 2, 'Ana já cadastrada', `ana.fixture${index}@gmail.com`);
  const bia = profile(8101 + index * 2, 'Bia já cadastrada', `bia.fixture${index}@gmail.com`);
  environment.seedRegistration(ana);
  environment.seedRegistration(bia);
  // Create real enrollments before the simulated Google sign-in.
  for (const [person, courseId] of [[ana, 1], [ana, 2], [bia, 3]]) {
    const response = await post(context, 'enrollments', { action: 'enroll', registrationId: person.id, courseId }, person.profileToken);
    assert.equal(response.status(), 200, await response.text());
    if (person === ana && courseId === 2) {
      const enrollment = await response.json();
      assert.equal((await post(context, 'enrollments', { action: 'cancel', requestId: enrollment.requestId }, person.profileToken)).status(), 200);
    }
  }
  return { ana, bia, identity: { email: ana.email, nome: 'Nome recebido do Google', subject: `google-ana-${index}` } };
}
async function installProvider(page, identity, overrides = {}) {
  const credentials = [];
  await page.exposeFunction('googleFixtureCredential', async nonce => {
    const token = await environment.signGoogleCredential(identity, nonce, overrides);
    credentials.push(token);
    return token;
  });
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: sdk }));
  return credentials;
}
async function openGoogle(page) {
  if (await page.getByRole('button', { name: 'Abrir menu', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('button', { name: 'Entrar / Cadastrar', exact: true }).click();
  } else await page.getByRole('button', { name: 'Entrar ou cadastrar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continuar com Google', exact: true }).click();
  await page.getByRole('button', { name: 'Usar conta Google simulada', exact: true }).waitFor();
}
async function authenticate(page, status = 200) {
  const response = page.waitForResponse(item => item.url().endsWith('/api/auth?action=credential') && item.request().method() === 'POST');
  await page.getByRole('button', { name: 'Usar conta Google simulada', exact: true }).click();
  const result = await response;
  assert.equal(result.status(), status, await result.text());
  return result.json();
}
async function expectProfile(page, person, courseIds) {
  assert.equal(await page.getByRole('button', { name: 'Completar meu cadastro', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Acessar meu perfil', exact: true }).click();
  await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
  assert.equal(await page.getByLabel('E-mail', { exact: true }).inputValue(), person.email);
  const saved = await storedProfile(page);
  assert.equal(saved.id, person.id);
  assert.equal(saved.nome, person.nome, 'Google name must not overwrite the existing registration');
  assert.deepEqual(saved.enrolledCourseIds.sort(), courseIds);
  assert.equal(environment.registrationCount(person.email), 1, 'Sign-in must not create another registration');
  const server = await page.request.get(`${environment.baseURL}/api/auth?action=session`);
  assert.equal(server.status(), 200);
  const data = await server.json();
  assert.equal(data.profile.id, person.id);
  assert.equal(data.profile.profileToken, saved.profileToken);
  for (const field of ['cpf', 'payload', 'dataNascimento', 'autorizaDados']) assert.equal(data.profile[field], undefined);
  assert((await page.context().cookies()).some(cookie => cookie.name === 'qv_session' && cookie.httpOnly));
  return saved;
}

test('conta existente: primeiro acesso Google recupera o mesmo perfil e histórico sem novo cadastro', async (page, context, accounts) => {
  const before = environment.registration(accounts.ana.id).payload;
  const tokens = await installProvider(page, { ...accounts.identity, email: `  ${accounts.ana.email.toUpperCase()}  ` });
  await openGoogle(page);
  assert.deepEqual(await authenticate(page), { status: 'authenticated' });
  const saved = await expectProfile(page, accounts.ana, [1]);
  assert.deepEqual(saved.enrollmentHistory.map(row => row.courseId).sort(), [1, 2], 'Cancelled enrollment remains in monthly history');
  assert.equal(environment.registration(accounts.ana.id).payload, before);
  assert.equal(environment.googleIdentity(accounts.identity.subject).registration_id, accounts.ana.id);
  assert.equal(environment.googleIdentity('unrelated-account'), undefined);
  assert(!tokens.some(token => JSON.stringify(saved).includes(token)), 'Google JWT must never be stored in localStorage');
  assert.equal((await post(context, 'enrollments', { action: 'enroll', registrationId: accounts.ana.id, courseId: 4 }, accounts.ana.profileToken)).status(), 401, 'First verified sign-in must revoke the earlier unverified session');
  await page.getByRole('button', { name: 'Cursos cadastrados (1)', exact: true }).click();
  await page.getByRole('heading', { name: 'Introdução à Programação', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Design Gráfico para Iniciantes', exact: true }).count(), 0);
});

test('celular: sair e entrar outra vez mantém perfil e cursos e revoga a sessão anterior', async (page, context, accounts) => {
  await installProvider(page, accounts.identity);
  await openGoogle(page);
  await authenticate(page);
  const first = await expectProfile(page, accounts.ana, [1]);
  const logout = page.waitForResponse(response => response.url().endsWith('/api/auth?action=logout'));
  await page.getByRole('button', { name: 'Sair da plataforma', exact: true }).click();
  assert.equal((await logout).status(), 200);
  assert.equal(await storedProfile(page), null);
  assert.equal((await context.request.get(`${environment.baseURL}/api/auth?action=session`)).status(), 401);
  await openGoogle(page);
  await authenticate(page);
  const second = await expectProfile(page, accounts.ana, [1]);
  assert.notEqual(second.profileToken, first.profileToken);
  assert.equal((await post(context, 'enrollments', { action: 'enroll', registrationId: accounts.ana.id, courseId: 4 }, first.profileToken)).status(), 401);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}, { mobile: true });

test('outra conta Google: recupera somente o próprio perfil, substituindo dados locais de outra pessoa', async (page, context, accounts) => {
  const identity = { email: accounts.bia.email, nome: 'Bia Google', subject: `google-bia-${accounts.bia.id}` };
  await installProvider(page, identity);
  await openGoogle(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: profileKey, value: { ...accounts.ana, enrolledCourseIds: [1] } });
  await authenticate(page);
  const saved = await expectProfile(page, accounts.bia, [3]);
  assert(!JSON.stringify(saved).includes(accounts.ana.profileToken));
  assert.equal(environment.googleIdentity(identity.subject).registration_id, accounts.bia.id);
  assert.equal((await post(context, 'enrollments', { action: 'enroll', registrationId: accounts.ana.id, courseId: 4 }, saved.profileToken)).status(), 401);
});

test('identidade já vinculada: mudança no e-mail Google não transfere acesso para outro cadastro', async (page, context, accounts) => {
  await installProvider(page, accounts.identity);
  await openGoogle(page);
  await authenticate(page);
  await expectProfile(page, accounts.ana, [1]);
  const logout = page.waitForResponse(response => response.url().endsWith('/api/auth?action=logout'));
  await page.getByRole('button', { name: 'Sair da plataforma', exact: true }).click();
  await logout;
  accounts.identity.email = accounts.bia.email;
  await openGoogle(page);
  await authenticate(page);
  await expectProfile(page, accounts.ana, [1]);
  assert.equal(environment.registrationCount(accounts.bia.email), 1);
});

test('identidade diferente com e-mail de uma conta já vinculada não consegue acessar esse perfil', async (page, context, accounts) => {
  await installProvider(page, accounts.identity);
  await openGoogle(page);
  await authenticate(page);
  await expectProfile(page, accounts.ana, [1]);
  const logout = page.waitForResponse(response => response.url().endsWith('/api/auth?action=logout'));
  await page.getByRole('button', { name: 'Sair da plataforma', exact: true }).click();
  await logout;
  accounts.identity.subject = 'another-google-identity';
  await openGoogle(page);
  await authenticate(page, 403);
  await page.getByRole('alert').filter({ hasText: 'Esta conta não pode ser vinculada' }).waitFor();
  assert.equal(await storedProfile(page), null);
  assert.equal((await context.request.get(`${environment.baseURL}/api/auth?action=session`)).status(), 401);
});

test('conta Google nova inicia cadastro sem acessar perfis existentes nem criar perfil incompleto', async (page, context, accounts) => {
  const unknown = { email: 'unknown.fixture@gmail.com', nome: 'Pessoa nova', subject: 'unknown-google-identity' };
  await installProvider(page, unknown);
  await openGoogle(page);
  assert.deepEqual(await authenticate(page), { status: 'registration-required' });
  await page.getByRole('button', { name: 'Completar meu cadastro', exact: true }).waitFor();
  assert.equal(await storedProfile(page), null);
  const session = await (await context.request.get(`${environment.baseURL}/api/auth?action=session`)).json();
  assert.equal(session.status, 'registration-required');
  assert.equal(session.identity.email, unknown.email);
  assert.equal(session.profile, undefined);
  assert.equal(environment.registrationCount(unknown.email), 0);
  assert.equal(environment.googleIdentity(unknown.subject), undefined);
  assert.equal(environment.registrationCount(accounts.ana.email), 1);
});

for (const [label, overrides] of [['e-mail não verificado', { email_verified: false }], ['nonce de outro navegador', { nonce: 'wrong-browser-nonce' }]]) {
  test(`credencial Google com ${label} não recupera o perfil`, async (page, context, accounts) => {
    await installProvider(page, accounts.identity, overrides);
    await openGoogle(page);
    await authenticate(page, 403);
    await page.getByRole('alert').filter({ hasText: 'Não foi possível validar a conta Google.' }).waitFor();
    assert.equal(await storedProfile(page), null);
    assert.equal((await context.request.get(`${environment.baseURL}/api/auth?action=session`)).status(), 401);
    assert.equal(environment.googleIdentity(accounts.identity.subject), undefined);
  });
}

const environment = await startTestEnvironment({ google: true });
let browser;
try {
  browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
  console.log('GOOGLE_ISOLATION\tSDK e chaves públicas simulados; assinatura RS256, API, sessão e SQLite reais; sem conta ou credenciais externas');
  for (const [index, item] of tests.entries()) {
    const context = await browser.newContext({ viewport: item.options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: Boolean(item.options.mobile), hasTouch: Boolean(item.options.mobile), reducedMotion: 'reduce' });
    try {
      await environment.prepareContext(context);
      const accounts = await seedAccounts(context, index);
      const page = await context.newPage();
      page.on('dialog', dialog => dialog.accept());
      const errors = [];
      let registrationPosts = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().endsWith('/api/registrations') && request.method() === 'POST') registrationPosts++; });
      page.setDefaultTimeout(10000);
      await page.goto(environment.baseURL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Encontre oportunidades/i }).waitFor();
      await item.run(page, context, accounts);
      assert.equal(registrationPosts, 0, 'Existing-user authentication must not submit a new registration');
      assert.deepEqual(errors, []);
      item.passed = true;
      console.log(`PASS\t${item.name}`);
    } catch (error) {
      console.error(`FAIL\t${item.name}\t${error.message}`);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close();
  await environment.cleanup();
}
const passed = tests.filter(item => item.passed).length;
console.log(`RESULT\t${passed}/${tests.length} testes Google aprovados`);
if (passed !== tests.length) process.exitCode = 1;
