import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
      window.__googleFixtureButtonClicks = (window.__googleFixtureButtonClicks || 0) + 1;
      const credential = await window.googleFixtureCredential(window.__googleFixtureOptions.nonce);
      window.__googleFixtureOptions.callback({ credential });
    };
    parent.append(button);
  },
  prompt() {
    window.__googleFixturePromptCalls = (window.__googleFixturePromptCalls || 0) + 1;
    if (window.__googleFixtureFromPrompt) queueMicrotask(async () => {
      const credential = await window.googleFixtureCredential(window.__googleFixtureOptions.nonce);
      window.__googleFixtureOptions.callback({ credential });
    });
  }, cancel() {}
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
  const ana = profile(8100 + index * 10, 'Ana já cadastrada', `ana.fixture${index}@gmail.com`);
  const bia = profile(8101 + index * 10, 'Bia já cadastrada', `bia.fixture${index}@gmail.com`);
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
async function installProvider(page, identity, overrides = {}, { fromPrompt = false } = {}) {
  await page.evaluate(value => { window.__googleFixtureFromPrompt = value; }, fromPrompt);
  const credentials = [];
  await page.exposeFunction('googleFixtureCredential', async nonce => {
    const token = await environment.signGoogleCredential(identity, nonce, overrides);
    credentials.push(token);
    return token;
  });
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: sdk }));
  return credentials;
}
async function openGoogle(page, { waitForAccountButton = true } = {}) {
  if (await page.getByRole('button', { name: 'Abrir menu', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('button', { name: 'Entrar / Cadastrar', exact: true }).click();
  } else await page.getByRole('button', { name: 'Entrar ou cadastrar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continuar com Google', exact: true }).click();
  if (waitForAccountButton) await page.getByRole('button', { name: 'Usar conta Google simulada', exact: true }).waitFor();
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

async function navigate(page, label) {
  if (await page.getByRole('button', { name: 'Abrir menu', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('button', { name: label, exact: true }).click();
  } else await page.locator('header').getByRole('button', { name: label, exact: true }).first().click();
}
async function openCourse(page, title) {
  await navigate(page, 'Cursos');
  await page.getByPlaceholder(/Buscar cursos, áreas/i).fill(title);
  await page.locator('main article').getByRole('button', { name: /Ver curso/i }).click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
}
async function openSavedProfile(page) {
  await page.getByRole('button', { name: /Abrir perfil de/i }).first().click();
  await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
}
const confirmedCourses = id => environment.confirmedEnrollments(id).map(row => Number(row.course_id)).sort((a, b) => a - b);

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

test('sugestão Google: callback do provedor recupera perfil sem clique no botão da conta', async (page, context, accounts) => {
  await installProvider(page, accounts.identity, {}, { fromPrompt: true });
  const credentialResponse = page.waitForResponse(response => response.url().endsWith('/api/auth?action=credential') && response.request().method() === 'POST');
  await openGoogle(page, { waitForAccountButton: false });
  assert.equal((await credentialResponse).status(), 200);
  const saved = await expectProfile(page, accounts.ana, [1]);
  const provider = await page.evaluate(() => ({ prompts: window.__googleFixturePromptCalls, clicks: window.__googleFixtureButtonClicks || 0,
    autoSelect: window.__googleFixtureOptions.auto_select, fedcm: window.__googleFixtureOptions.use_fedcm_for_prompt }));
  assert.equal(provider.clicks, 0, 'The provider suggestion must reach the application callback without clicking the rendered account button');
  assert.equal(provider.prompts, 1);
  assert.equal(provider.autoSelect, false, 'The current product keeps account choice explicit; the fixture does not claim silent Google sign-in');
  assert.equal(provider.fedcm, true);
  assert.deepEqual(confirmedCourses(saved.id), [1]);
  return { providerPromptCallbacks: 1, renderedAccountButtonClicks: 0, confirmedCourses: [1] };
});

test('sessão Google: recarregar preserva o perfil e cookie retoma os cursos sem nova credencial', async (page, context, accounts) => {
  await installProvider(page, accounts.identity);
  await openGoogle(page); await authenticate(page);
  const first = await expectProfile(page, accounts.ana, [1]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openSavedProfile(page);
  assert.equal((await storedProfile(page)).profileToken, first.profileToken);
  await page.getByRole('button', { name: 'Cursos cadastrados (1)', exact: true }).click();
  await page.getByRole('heading', { name: 'Introdução à Programação', exact: true }).waitFor();
  let credentials = 0, providerLoads = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/auth?action=credential')) credentials++;
    if (request.url() === 'https://accounts.google.com/gsi/client') providerLoads++;
  });
  await page.evaluate(key => localStorage.removeItem(key), profileKey);
  assert.equal(await storedProfile(page), null);
  assert.equal((await context.request.get(`${environment.baseURL}/api/auth?action=session`)).status(), 200);
  await page.goto(`${environment.baseURL}/#google-login`, { waitUntil: 'domcontentloaded' });
  const restored = await expectProfile(page, accounts.ana, [1]);
  assert.equal(restored.profileToken, first.profileToken);
  assert.deepEqual(restored.enrollmentHistory.map(row => row.courseId).sort(), [1, 2]);
  assert.equal(credentials, 0); assert.equal(providerLoads, 0);
  assert.deepEqual(confirmedCourses(restored.id), [1]);
  return { normalReloadPreservesProfile: true, cookieRecoveryWithoutGoogleSDK: true, activeCourses: [1], cancelledCourseInHistoryOnly: 2 };
});

test('outro navegador: mesmo Google recupera o cadastro e somente inscrições ativas do servidor', async (page, context, accounts) => {
  await installProvider(page, accounts.identity); await openGoogle(page); await authenticate(page);
  const first = await expectProfile(page, accounts.ana, [1]);
  const other = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    await environment.prepareContext(other);
    assert.equal((await other.request.get(`${environment.baseURL}/api/auth?action=session`)).status(), 401, 'A clean browser must not inherit another device session');
    const secondPage = await other.newPage();
    await secondPage.goto(environment.baseURL, { waitUntil: 'domcontentloaded' });
    assert.equal(await storedProfile(secondPage), null);
    await installProvider(secondPage, accounts.identity); await openGoogle(secondPage); await authenticate(secondPage);
    const second = await expectProfile(secondPage, accounts.ana, [1]);
    assert.notEqual(second.profileToken, first.profileToken, 'Each device receives its own application session');
    assert.deepEqual(second.enrollmentHistory.map(row => row.courseId).sort(), [1, 2]);
    await secondPage.getByRole('button', { name: 'Cursos cadastrados (1)', exact: true }).click();
    await secondPage.getByRole('heading', { name: 'Introdução à Programação', exact: true }).waitFor();
    assert.equal(await secondPage.getByRole('heading', { name: 'Excel do Básico ao Avançado', exact: true }).count(), 0);
    assert.equal(await secondPage.getByRole('heading', { name: 'Design Gráfico para Iniciantes', exact: true }).count(), 0);
    assert.deepEqual(confirmedCourses(accounts.ana.id), [1]);
    assert.deepEqual(confirmedCourses(accounts.bia.id), [3]);
  } finally { await other.close(); }
  return { independentBrowser: true, activeCourses: [1], otherUserCoursesUntouched: [3] };
});

test('após entrar com Google: inscrição na tela coincide com perfil, sessão e linha do curso no SQLite', async (page, context, accounts) => {
  await installProvider(page, accounts.identity); await openGoogle(page); await authenticate(page);
  await expectProfile(page, accounts.ana, [1]);
  await openCourse(page, 'Marketing Digital na Prática');
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  await page.getByRole('heading', { name: 'Confirmar inscrição', exact: true }).waitFor();
  const response = page.waitForResponse(item => item.url().endsWith('/api/enrollments') && item.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
  const result = await response; assert.equal(result.status(), 200); const enrollment = await result.json();
  await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
  assert.equal(enrollment.registrationId, accounts.ana.id); assert.equal(enrollment.courseId, 4);
  const saved = await storedProfile(page);
  assert.deepEqual(saved.enrolledCourseIds.sort(), [1, 4]);
  const row = environment.confirmedEnrollments(accounts.ana.id).find(entry => Number(entry.course_id) === 4);
  assert(row, 'The selected course must have an active, confirmed database row');
  assert.equal(row.id, enrollment.requestId); assert.equal(row.confirmed_at, enrollment.enrolledAt);
  assert.equal(row.delivery, 'direct'); assert.equal(row.cancelled_at, null);
  assert.deepEqual(confirmedCourses(accounts.bia.id), [3], 'Enrollment must not be attached to another profile');
  await openSavedProfile(page);
  await page.getByRole('button', { name: 'Cursos cadastrados (2)', exact: true }).click();
  for (const title of ['Introdução à Programação', 'Marketing Digital na Prática']) await page.getByRole('heading', { name: title, exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Excel do Básico ao Avançado', exact: true }).count(), 0);
  await page.screenshot({ path: join(artifacts, 'google-existing-user-courses.png'), fullPage: true });
  await page.evaluate(key => localStorage.removeItem(key), profileKey);
  await page.goto(`${environment.baseURL}/#google-login`, { waitUntil: 'domcontentloaded' });
  const restored = await expectProfile(page, accounts.ana, [1, 4]);
  assert.equal(restored.enrollments.find(entry => entry.courseId === 4).requestId, enrollment.requestId);
  assert.deepEqual(confirmedCourses(accounts.ana.id), [1, 4]);
  assert.equal(environment.emails.length, 0);
  return { registeredProfileId: accounts.ana.id, courseId: 4, activeCourses: [1, 4], databaseConfirmed: true, sameEnrollmentAfterRecovery: true };
});

test('falha na inscrição após Google: aviso visível sem curso falso no perfil ou banco; repetição conclui', async (page, context, accounts) => {
  await installProvider(page, accounts.identity); await openGoogle(page); await authenticate(page);
  await expectProfile(page, accounts.ana, [1]);
  await openCourse(page, 'Marketing Digital na Prática');
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  const unavailable = route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Falha simulada de inscrição. Tente novamente.' }) });
  await page.route('**/api/enrollments', unavailable);
  await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Falha simulada de inscrição. Tente novamente.' }).waitFor();
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds, [1]);
  assert.deepEqual(confirmedCourses(accounts.ana.id), [1]);
  assert.equal(await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).count(), 0);
  await page.unroute('**/api/enrollments', unavailable);
  await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
  assert.deepEqual((await storedProfile(page)).enrolledCourseIds.sort(), [1, 4]);
  assert.deepEqual(confirmedCourses(accounts.ana.id), [1, 4]);
  return { simulatedFailureStatus: 503, noFalseSuccess: true, retryPersisted: true };
});

test('conta Google Workspace nova: completar cadastro de um curso cria um perfil único e inscrição vinculada no banco', async (page, context, accounts) => {
  const identity = { email: 'new-google-enrollment@example.test', nome: 'Pessoa Google Nova', subject: 'new-google-enrollment-identity' };
  await openCourse(page, 'Informática para o Mercado');
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  await installProvider(page, identity, { hd: 'example.test' });
  await page.getByRole('button', { name: 'Continuar com Google', exact: true }).click();
  await authenticate(page);
  await page.getByRole('button', { name: 'Completar meu cadastro', exact: true }).click();
  assert.equal(await page.locator('[name="email"]').inputValue(), identity.email);
  assert.equal(await page.locator('[name="nome"]').inputValue(), identity.nome);
  for (const [name, value] of Object.entries({ cpf: '529.982.247-25', dataNascimento: '25/08/1990', telefone: '27999999999' })) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="sexo"]').selectOption('Prefiro não informar');
  await page.locator('[name="escolaridade"]').selectOption('Ensino médio completo');
  await page.locator('[name="situacaoEmprego"]').selectOption('Desempregado');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.locator('[name="cep"]').fill('29050-945'); await page.locator('[name="cep"]').blur();
  await page.waitForFunction(() => document.querySelector('[name="bairro"]')?.value === 'Bento Ferreira');
  await page.locator('[name="numero"]').fill('');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.locator('[name="autorizaDados"]').check(); await page.locator('[name="aceitaTermos"]').check();
  const registrationResponse = page.waitForResponse(response => response.url().endsWith('/api/registrations') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Concluir cadastro', exact: true }).click();
  assert.equal((await registrationResponse).status(), 201);
  await page.getByRole('heading', { name: 'Inscrição confirmada!', exact: true }).waitFor();
  await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
  const saved = await storedProfile(page);
  assert.deepEqual(saved.enrolledCourseIds, [7]);
  assert.equal(environment.registrationCount(identity.email), 1);
  assert.equal(environment.googleIdentity(identity.subject).registration_id, saved.id);
  const registration = environment.registration(saved.id); assert(registration);
  assert.equal(registration.email, identity.email);
  const payload = JSON.parse(registration.payload);
  assert.equal(payload.numero, ''); assert.equal(payload.autorizaDados, true); assert.equal(payload.aceitaTermos, true);
  assert(payload.policyReceipt?.version);
  const rows = environment.confirmedEnrollments(saved.id);
  assert.equal(rows.length, 1); assert.equal(Number(rows[0].course_id), 7);
  assert.equal(rows[0].id, saved.enrollments[0].requestId); assert.equal(rows[0].delivery, 'direct');
  await expectProfile(page, { id: saved.id, nome: identity.nome, email: identity.email }, [7]);
  await page.getByRole('button', { name: 'Cursos cadastrados (1)', exact: true }).click();
  await page.getByRole('heading', { name: 'Informática para o Mercado', exact: true }).waitFor();
  await page.screenshot({ path: join(artifacts, 'google-workspace-new-user-course.png'), fullPage: true });
  assert.deepEqual(confirmedCourses(accounts.ana.id), [1]); assert.deepEqual(confirmedCourses(accounts.bia.id), [3]);
  return { createdRegistrationId: saved.id, uniqueProfile: true, courseId: 7, databaseConfirmed: true, googleIdentityBound: true };
}, { registrationPosts: 1 });

const environment = await startTestEnvironment({ google: true });
let browser;
const artifacts = process.env.GOOGLE_TEST_ARTIFACTS || join(process.cwd(), '..', 'artifacts', 'regressao-plataforma-2026-10-20', 'google');
await mkdir(artifacts, { recursive: true });
const report = { startedAt: new Date().toISOString(), provider: 'SDK suggestions and signing keys simulated; real RS256 verification, HTTP controllers, cookies and disposable SQLite', checks: [], limitations: ['No real Google account, OAuth client or external provider availability was validated.', 'Google auto_select is false; prompt callback is tested after the user opens the chooser.', 'Normal reload preserves the local profile; cookie-only recovery is tested on the google-login return route.'] };
try {
  browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
  console.log('GOOGLE_ISOLATION\tSDK e chaves públicas simulados; assinatura RS256, API, sessão e SQLite reais; sem conta ou credenciais externas');
  for (const [index, item] of tests.entries()) {
    const context = await browser.newContext({ viewport: item.options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: Boolean(item.options.mobile), hasTouch: Boolean(item.options.mobile), reducedMotion: 'reduce' });
    let page;
    try {
      await environment.prepareContext(context);
      const accounts = await seedAccounts(context, index);
      page = await context.newPage();
      page.on('dialog', dialog => dialog.accept());
      const errors = [];
      let registrationPosts = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().endsWith('/api/registrations') && request.method() === 'POST') registrationPosts++; });
      page.setDefaultTimeout(10000);
      await page.goto(environment.baseURL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Encontre oportunidades/i }).waitFor();
      item.evidence = await item.run(page, context, accounts);
      assert.equal(registrationPosts, item.options.registrationPosts ?? 0, 'Existing-user authentication must not submit a new registration; only the new-user form may create one');
      assert.deepEqual(errors, []);
      item.passed = true;
      report.checks.push({ name: item.name, status: 'passed', registrationPosts, evidence: item.evidence ?? { activeProfileCourses: confirmedCourses(accounts.ana.id), otherProfileCourses: confirmedCourses(accounts.bia.id) } });
      console.log(`PASS\t${item.name}`);
    } catch (error) {
      report.checks.push({ name: item.name, status: 'failed', error: error.message });
      await page?.screenshot({ path: join(artifacts, `failure-${index + 1}.png`), fullPage: true }).catch(() => {});
      console.error(`FAIL\t${item.name}\t${error.message}`);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close();
  await environment.cleanup();
}
const passed = tests.filter(item => item.passed).length;
report.finishedAt = new Date().toISOString(); report.passed = passed; report.failed = tests.length - passed; report.total = tests.length;
await writeFile(join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
console.log(`RESULT\t${passed}/${tests.length} testes Google aprovados`);
if (passed !== tests.length) process.exitCode = 1;
