import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { COURSES } from '../shared/courses.mjs';
import { findBrowserExecutable, startTestEnvironment } from './e2e-support.mjs';

// Browser, real HTTP API and direct read-only SQLite checks use disposable data.
// No production database, real Google account or email service is involved.
if (process.env.TEST_URL) throw new Error('Enrollment integrity tests require the isolated local frontend and database; unset TEST_URL.');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const artifacts = process.env.ENROLLMENT_TEST_ARTIFACTS || join(root, '../artifacts/regressao-plataforma-2026-10-20/enrollment');
await mkdir(artifacts, { recursive: true });
const environment = await startTestEnvironment();
const browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
const PROFILE_KEY = 'qualificavix-profile';
const report = { date: new Date().toISOString(), browser: browser.version(), database: 'isolated disposable SQLite; real API writes and read-only SQL verification', cases: [], sqlReads: 0, limitations: ['Google identity flows have their own test suite.', 'Phone layouts use Chromium emulation; no physical iOS/Android device was used.', 'The production PostgreSQL database was not accessed.'] };
let sqlAssertions = 0;
let currentEvidence;
const same = (actual, expected, message) => { sqlAssertions++; assert.deepEqual(actual, expected, message); };
function history(id) {
  report.sqlReads++;
  const rows = environment.enrollmentHistory(id);
  currentEvidence?.push({ registrationId: id, rows: rows.map(row => ({ courseId: row.course_id, confirmed: !!row.confirmed_at, cancelled: !!row.cancelled_at, delivery: row.delivery })) });
  return rows;
}
const active = rows => rows.filter(row => row.confirmed_at && !row.cancelled_at);
const ids = rows => rows.map(row => Number(row.course_id)).toSorted((a, b) => a - b);
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROFILE_KEY);
const course = id => COURSES.find(item => item.id === id);
function fixture(id) {
  return { id, nome: `Pessoa de Teste ${id}`, email: `enrollment.fixture${id}@example.test`, telefone: '27999999999', cep: '29050-945', bairro: 'Bento Ferreira', rua: 'Avenida Marechal Mascarenhas de Moraes', numero: '', escolaridade: 'Ensino médio completo', enrolledCourseIds: [], enrollments: [] };
}
async function navigate(page, label) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('button', { name: label, exact: true }).first().click();
  } else await page.locator('header').getByRole('button', { name: label, exact: true }).first().click();
}
async function openCourse(page, id) {
  await navigate(page, 'Cursos');
  await page.getByRole('heading', { name: /Encontre o curso ideal/i }).waitFor();
  await page.getByPlaceholder(/Buscar cursos, áreas/i).fill(course(id).title);
  await page.waitForFunction(title => {
    const cards = [...document.querySelectorAll('main article h3')];
    return cards.length === 1 && cards[0].textContent === title;
  }, course(id).title);
  await page.locator('main article').getByRole('button', { name: /Ver curso/i }).click();
  await page.getByRole('heading', { name: course(id).title, exact: true }).waitFor();
}
async function openProfileCourses(page, expectedIds) {
  if (await page.getByRole('button', { name: 'Abrir menu', exact: true }).isVisible()) await navigate(page, 'Meu perfil');
  else await page.getByRole('button', { name: /Abrir perfil de/i }).first().click();
  await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
  await page.getByRole('button', { name: `Cursos cadastrados (${expectedIds.length})`, exact: true }).click();
  const titles = await page.locator('main article h2').allTextContents();
  assert.deepEqual(titles.toSorted(), expectedIds.map(id => course(id).title).toSorted(), 'The visible choices pack must contain exactly the confirmed courses');
  if (!expectedIds.length) await page.getByText('Nenhum curso cadastrado', { exact: true }).waitFor();
}
async function seed(page, person) {
  environment.seedRegistration(person);
  await page.evaluate(({ key, person }) => localStorage.setItem(key, JSON.stringify(person)), { key: PROFILE_KEY, person });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Encontre oportunidades/i }).waitFor();
}
async function enroll(page, id) {
  await openCourse(page, id);
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  await page.getByRole('heading', { name: 'Confirmar inscrição', exact: true }).waitFor();
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/enrollments') && response.request().method() === 'POST' && response.request().postDataJSON()?.action === 'enroll');
  await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, 'Real enrollment API must confirm the mutation');
  const result = await response.json();
  assert.equal(result.status, 'confirmed');
  assert.equal(result.courseId, id);
  await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
  return result;
}
async function verifyEverywhere(page, personId, expectedIds) {
  const profile = await stored(page);
  assert.equal(profile.id, personId);
  assert.deepEqual(profile.enrolledCourseIds.toSorted((a,b) => a-b), expectedIds.toSorted((a,b) => a-b));
  const rows = active(history(personId));
  same(ids(rows), expectedIds.toSorted((a,b) => a-b), 'Direct SQL must match the browser choices pack');
  for (const row of rows) {
    same(Number(row.registration_id), personId);
    same(row.delivery, 'direct');
    same(row.cancelled_at, null);
    const entry = profile.enrollments.find(item => item.courseId === Number(row.course_id));
    assert(entry, 'Confirmed SQL row must be represented in profile metadata');
    same(entry.requestId, row.id, 'Profile and SQLite refer to the same enrollment, not just the course title');
    same(entry.enrolledAt, new Date(row.confirmed_at).toISOString(), 'The enrollment timestamp must come from the actual database result');
  }
  await openProfileCourses(page, expectedIds);
}
async function post(page, body, token) {
  return page.request.post(`${environment.baseURL}/api/enrollments`, { headers: token ? { 'x-profile-token': token } : {}, data: body });
}
async function cancel(page, id) {
  await openCourse(page, id);
  const confirmed = page.waitForEvent('dialog').then(dialog => dialog.accept());
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/enrollments') && response.request().postDataJSON()?.action === 'cancel');
  await page.getByRole('button', { name: 'Desinscrever-se', exact: true }).click();
  await confirmed;
  const response = await responsePromise; assert.equal(response.status(), 200);
  const result = await response.json(); assert.equal(result.status, 'cancelled'); assert.equal(result.courseId, id);
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).waitFor();
}
async function monthlyUiBlock(page, id) {
  await openCourse(page, id);
  const dialogPromise = page.waitForEvent('dialog').then(async dialog => {
    const message = dialog.message(); await dialog.accept(); assert.match(message, /3 cursos por mês/i);
  });
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click(); await dialogPromise;
}
async function registerFromCourse(page, courseId, index) {
  await openCourse(page, courseId);
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  await page.getByRole('heading', { name: 'Dados Pessoais', exact: true }).waitFor();
  const values = { nome: `Pessoa Cadastro Integridade ${index}`, cpf: String(75861000000 + index), dataNascimento: '25/08/1990', telefone: '27999999999', email: `integrity.signup${index}@example.test`, emailConfirm: `integrity.signup${index}@example.test` };
  for (const [name, value] of Object.entries(values)) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="sexo"]').selectOption('Prefiro não informar');
  await page.locator('[name="escolaridade"]').selectOption('Ensino médio completo');
  await page.locator('[name="situacaoEmprego"]').selectOption('Desempregado');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.locator('[name="cep"]').fill('29050-945'); await page.locator('[name="cep"]').blur();
  await page.waitForFunction(() => document.querySelector('[name="bairro"]')?.value === 'Bento Ferreira');
  assert.equal(await page.locator('[name="numero"]').inputValue(), '', 'Address number remains optional');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await page.locator('[name="autorizaDados"]').check(); await page.locator('[name="aceitaTermos"]').check();
  const registrationPromise = page.waitForResponse(response => response.url().endsWith('/api/registrations') && response.request().method() === 'POST');
  const enrollmentPromise = page.waitForResponse(response => response.url().endsWith('/api/enrollments') && response.request().postDataJSON()?.action === 'enroll');
  await page.getByRole('button', { name: 'Concluir cadastro', exact: true }).click();
  const registration = await registrationPromise; assert.equal(registration.status(), 201);
  const result = await registration.json();
  const enrollment = await enrollmentPromise; assert.equal(enrollment.status(), 200);
  const response = await enrollment.json(); same(response.registrationId, result.id); same(response.courseId, courseId);
  await page.getByRole('heading', { name: 'Inscrição confirmada!', exact: true }).waitFor();
  await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
  const profile = await stored(page); assert.equal(profile.id, result.id);
  report.sqlReads++; same(environment.registrationCount(values.email), 1, 'Exactly one user registration must be persisted');
  report.sqlReads++; const saved = environment.registration(result.id); same(saved.name, values.nome); same(saved.email, values.email);
  same(JSON.parse(saved.payload).numero, '');
  await page.getByRole('button', { name: 'Acessar meu perfil', exact: true }).click();
  await verifyEverywhere(page, result.id, [courseId]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await verifyEverywhere(page, result.id, [courseId]);
  return result.id;
}
async function run(name, action, options = {}) {
  const started = Date.now(), caseEvidence = [];
  currentEvidence = caseEvidence;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ...options });
  const failures = [];
  try {
    await environment.prepareContext(context);
    await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
    const page = await context.newPage(); page.setDefaultTimeout(14000); page.on('pageerror', error => failures.push(error.message));
    await page.goto(environment.baseURL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Encontre oportunidades/i }).waitFor();
    await action(page);
    assert.deepEqual(failures, [], 'No unexpected browser exception');
    const image = `${String(report.cases.length + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: join(artifacts, image), fullPage: true });
    report.cases.push({ name, status: 'passed', durationMs: Date.now() - started, databaseChecks: caseEvidence, screenshot: image });
    console.log(`PASS ${name}`);
  } catch (failure) {
    report.cases.push({ name, status: 'failed', durationMs: Date.now() - started, databaseChecks: caseEvidence, error: failure.stack });
    console.error(`FAIL ${name}: ${failure.message}`);
    const page = context.pages()[0]; if (page) await page.screenshot({ path: join(artifacts, `failed-${report.cases.length}.png`), fullPage: true }).catch(() => {});
  } finally { await context.close(); currentEvidence = null; }
}

try {
  assert.equal(typeof environment.enrollmentHistory, 'function', 'Integrity suite needs the read-only enrollmentHistory test helper');
  for (const [name, courseId, index, options] of [['Desktop', 1, 1, {}], ['Telefone', 3, 2, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    await run(`${name}: cadastro iniciado por curso cria usuário e inscrição nas mesmas referências do perfil e SQLite`, page => registerFromCourse(page, courseId, index), options);
  }
  await run('Conta existente: escolha específica, recarregamento e repetições simultâneas não duplicam o registro', async page => {
    const person = fixture(9210); await seed(page, person); const result = await enroll(page, 2);
    await verifyEverywhere(page, person.id, [2]); await page.reload({ waitUntil: 'domcontentloaded' }); await verifyEverywhere(page, person.id, [2]);
    const responses = await Promise.all(Array.from({ length: 5 }, () => post(page, { action: 'enroll', registrationId: person.id, courseId: 2 }, person.profileToken)));
    for (const response of responses) { assert.equal(response.status(), 200); const duplicate = await response.json(); same(duplicate.requestId, result.requestId); same(duplicate.courseId, 2); }
    same(history(person.id).length, 1); await verifyEverywhere(page, person.id, [2]);
  });
  await run('Cancelamento: remove somente a escolha cancelada e mantém o registro auditável no banco', async page => {
    const person = fixture(9220); await seed(page, person); const first = await enroll(page, 1); await enroll(page, 4); await verifyEverywhere(page, person.id, [1, 4]);
    await cancel(page, 1); await verifyEverywhere(page, person.id, [4]);
    const rows = history(person.id); same(rows.length, 2); const cancelled = rows.find(row => row.id === first.requestId);
    assert(cancelled?.cancelled_at && cancelled.confirmed_at); same(Number(cancelled.course_id), 1); same(Number(cancelled.registration_id), person.id);
    const before = cancelled.cancelled_at;
    const repeat = await post(page, { action: 'cancel', requestId: first.requestId }, person.profileToken); assert.equal(repeat.status(), 200);
    same(history(person.id).find(row => row.id === first.requestId).cancelled_at, before);
    await page.reload({ waitUntil: 'domcontentloaded' }); await verifyEverywhere(page, person.id, [4]);
  });
  await run('Limite mensal: quarto curso é rejeitado pela tela e API, inclusive depois de cancelar um dos três', async page => {
    const person = fixture(9230); await seed(page, person);
    for (const id of [1, 2, 3]) await enroll(page, id);
    await verifyEverywhere(page, person.id, [1, 2, 3]); await monthlyUiBlock(page, 4);
    assert.equal((await post(page, { action: 'enroll', registrationId: person.id, courseId: 4 }, person.profileToken)).status(), 409);
    same(history(person.id).length, 3);
    await cancel(page, 2); await verifyEverywhere(page, person.id, [1, 3]);
    await monthlyUiBlock(page, 4); assert.equal((await post(page, { action: 'enroll', registrationId: person.id, courseId: 4 }, person.profileToken)).status(), 409);
    same(history(person.id).length, 3); same(ids(active(history(person.id))), [1, 3]);
    assert.equal((await stored(page)).enrollmentHistory.length, 3, 'Cancellation must not return a monthly choice');
  });
  await run('Oferta em breve: controle desativado e tentativa direta não criam escolha nem inscrição SQL', async page => {
    const person = fixture(9240); await seed(page, person); await openCourse(page, 6);
    assert(await page.getByRole('button', { name: 'Inscrições em breve', exact: true }).isDisabled());
    assert.equal((await post(page, { action: 'enroll', registrationId: person.id, courseId: 6 }, person.profileToken)).status(), 409);
    same(history(person.id).length, 0); await verifyEverywhere(page, person.id, []);
  });
  await run('Isolamento: sessão de B não altera inscrições de A; o mesmo curso fica associado a cada dono correto', async page => {
    const a = fixture(9250), b = fixture(9251); await seed(page, a); const enrollmentA = await enroll(page, 5); await verifyEverywhere(page, a.id, [5]);
    await seed(page, b); await verifyEverywhere(page, b.id, []);
    assert.equal((await post(page, { action: 'enroll', registrationId: a.id, courseId: 2 }, b.profileToken)).status(), 401);
    assert.equal((await post(page, { action: 'cancel', requestId: enrollmentA.requestId }, b.profileToken)).status(), 403);
    assert.equal((await post(page, { action: 'enroll', registrationId: a.id, courseId: 2 })).status(), 401);
    same(ids(active(history(a.id))), [5]); same(history(b.id).length, 0);
    await enroll(page, 5); await verifyEverywhere(page, b.id, [5]);
    const aRows = history(a.id), bRows = history(b.id); same(aRows.length, 1); same(bRows.length, 1); assert.notEqual(aRows[0].id, bRows[0].id);
    same(Number(aRows[0].registration_id), a.id); same(Number(bRows[0].registration_id), b.id);
  });
  await run('Falha transitória: nenhum sucesso local ou SQL antecipado; nova tentativa confirma uma única inscrição', async page => {
    const person = fixture(9260); await seed(page, person); await openCourse(page, 7); await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
    let first = true;
    await page.route('**/api/enrollments', route => {
      if (first && route.request().postDataJSON()?.action === 'enroll') { first = false; return route.fulfill({ status: 503, json: { error: 'Falha simulada temporária. Tente novamente.' } }); }
      return route.continue();
    });
    await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Falha simulada temporária.' }).waitFor();
    same(history(person.id).length, 0); assert.deepEqual((await stored(page)).enrolledCourseIds, []);
    assert.equal(await page.getByRole('status').filter({ hasText: 'Inscrição confirmada.' }).count(), 0);
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/enrollments') && response.request().postDataJSON()?.action === 'enroll');
    await page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true }).click(); assert.equal((await responsePromise).status(), 200);
    await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
    await verifyEverywhere(page, person.id, [7]); same(history(person.id).length, 1);
  });
  await run('Catálogo completo: cada oferta disponível gera a escolha correta e um vínculo SQL no usuário correto', async page => {
    const available = COURSES.filter(item => item.status !== 'coming-soon');
    report.catalogCourses = available.map(item => ({ id: item.id, title: item.title, modality: item.modality }));
    for (let index = 0; index < available.length; index += 3) {
      const person = fixture(9270 + index); await seed(page, person);
      const chosen = [];
      for (const offer of available.slice(index, index + 3)) {
        const result = await enroll(page, offer.id); same(result.registrationId, person.id); same(result.courseId, offer.id);
        chosen.push(offer.id); await verifyEverywhere(page, person.id, chosen);
      }
      same(history(person.id).length, chosen.length);
    }
  });
  assert.equal(environment.emails.length, 0, 'The direct enrollment flow must never attempt email confirmation');
} finally {
  report.passed = report.cases.filter(item => item.status === 'passed').length;
  report.failed = report.cases.filter(item => item.status === 'failed').length;
  report.sqlAssertions = sqlAssertions;
  report.emailsSent = environment.emails.length;
  await writeFile(join(artifacts, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close(); await environment.cleanup();
}
console.log(`${report.passed} passed; ${report.failed} failed; ${report.sqlReads} read-only SQL checks; ${report.sqlAssertions} database identity/status assertions.`);
if (report.failed) process.exitCode = 1;
