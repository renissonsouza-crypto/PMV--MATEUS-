import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { COURSES } from '../shared/courses.mjs';
import { findBrowserExecutable, startTestEnvironment } from './e2e-support.mjs';

// These are CSS viewport/touch configurations, not physical-device certification.
// WebKit can be explicitly requested. Its absence must never look like a pass.
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const artifacts = process.env.MOBILE_TEST_ARTIFACTS || join(root, '../artifacts/mobile-2026-10-20');
const requestedEngines = (process.env.MOBILE_ENGINES || 'chromium').split(',').map(value => value.trim()).filter(Boolean);
assert(requestedEngines.length > 0, 'MOBILE_ENGINES must select at least one browser engine');
for (const name of requestedEngines) assert(['chromium', 'webkit'].includes(name), `Unsupported mobile engine: ${name}`);
const targets = [
  { name: 'Android compacto', viewport: { width: 320, height: 658 } },
  { name: 'Android 360', viewport: { width: 360, height: 740 }, full: true },
  { name: 'Pixel 7 viewport', viewport: { width: 412, height: 839 } },
  { name: 'iPhone SE viewport', viewport: { width: 320, height: 568 } },
  { name: 'iPhone 13 viewport', viewport: { width: 390, height: 664 }, full: true },
  { name: 'iPhone grande viewport', viewport: { width: 430, height: 932 } },
  { name: 'Paisagem compacta', viewport: { width: 568, height: 320 } },
  { name: 'iPhone paisagem viewport', viewport: { width: 844, height: 390 } },
  { name: 'Android paisagem viewport', viewport: { width: 915, height: 412 } },
  { name: 'Tablet 768', viewport: { width: 768, height: 1024 } },
  { name: 'Tablet 834', viewport: { width: 834, height: 1194 } },
  { name: 'Tablet paisagem', viewport: { width: 1024, height: 768 } },
];
await mkdir(artifacts, { recursive: true });
const report = { startedAt: new Date().toISOString(), checks: [], requestedEngines, executedEngines: [], viewports: [],
  limitations: [
    'Touch and CSS viewport emulation is not testing on physical Android, iPhone or iPad hardware.',
    'Chromium using an iPhone-sized viewport is not Safari/iOS. WebKit is tested only if explicitly requested and installed.',
    'A reduced viewport simulates lost keyboard space, not an operating system keyboard or real browser chrome.',
    'Safe-area CSS is preserved; hardware notch and home-indicator rendering need device verification.',
    'Google account/provider availability is covered separately with fixtures, not a live Google account.',
    'Remote catalogue photos use local placeholders; external CDN/TLS availability is outside the mobile layout result.',
  ] };
let environment;
let caseIndex = 0;
const PROFILE_KEY = 'qualificavix-profile';
const title = COURSES.find(course => course.id === 2).title;
function viewportSeen(engine, viewport, phase) {
  if (!report.viewports.some(entry => entry.engine === engine && entry.width === viewport.width && entry.height === viewport.height))
    report.viewports.push({ engine, width: viewport.width, height: viewport.height, phase });
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth, body: document.body.scrollWidth }));
  assert(size.scroll <= size.width + 1 && size.body <= size.width + 1, `Horizontal overflow: ${JSON.stringify(size)}`);
}
async function withinScreen(page, locator, { vertical = false, touch = false } = {}) {
  const box = await locator.boundingBox(); assert(box && box.width > 0 && box.height > 0, 'Control must be visible');
  const viewport = page.viewportSize();
  assert(box.x >= -1 && box.x + box.width <= viewport.width + 1, `Control exceeds viewport width: ${JSON.stringify(box)}`);
  if (vertical) assert(box.y >= -1 && box.y + box.height <= viewport.height + 1, `Control exceeds viewport height: ${JSON.stringify(box)}`);
  if (touch) assert(box.width >= 43 && box.height >= 43, `Touch target below 44px: ${JSON.stringify(box)}`);
}
async function navigate(page, label) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    const dialog = page.getByRole('dialog', { name: 'Menu', exact: true });
    await dialog.getByRole('button', { name: label, exact: true }).first().click();
    await dialog.waitFor({ state: 'hidden' });
  } else await page.locator('header').getByRole('button', { name: label, exact: true }).first().click();
}
async function enterCatalog(page) { await navigate(page, 'Cursos'); await page.getByRole('heading', { name: /Encontre o curso ideal/i }).waitFor(); }
async function openFirstCourse(page) { await enterCatalog(page); await page.locator('main article').first().getByRole('button', { name: /Ver curso/ }).click(); }
async function openChat(page) {
  await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
  const chat = page.getByRole('dialog', { name: 'Tortuguita', exact: true }); await chat.waitFor(); return chat;
}
async function completeRegistration(page, sequence) {
  await navigate(page, 'Meu perfil');
  const values = { nome: `Pessoa Mobile ${sequence}`, cpf: String(86000000000 + sequence), dataNascimento: '01011990', telefone: '27999999999', email: `mobile${sequence}@example.test`, emailConfirm: `mobile${sequence}@example.test` };
  for (const [name, value] of Object.entries(values)) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="sexo"]').selectOption('Prefiro não informar');
  await page.locator('[name="escolaridade"]').selectOption('Ensino médio completo');
  await page.locator('[name="situacaoEmprego"]').selectOption('Desempregado');
  const next = page.getByRole('button', { name: 'Próximo', exact: true });
  await next.click();
  const addressTitle = page.getByRole('heading', { name: 'Endereço de Moradia', exact: true }); await addressTitle.waitFor();
  assert(await addressTitle.evaluate(el => el === document.activeElement), 'New registration step must receive focus');
  assert((await addressTitle.boundingBox()).y < 300, 'New step must scroll into view');
  await page.locator('[name="cep"]').fill('29050-945'); await page.locator('[name="cep"]').blur();
  await page.waitForFunction(() => document.querySelector('[name="bairro"]')?.value === 'Bento Ferreira');
  assert.equal(await page.locator('[name="numero"]').inputValue(), '');
  await next.click(); await next.click();
  await page.locator('[name="autorizaDados"]').check(); await page.locator('[name="aceitaTermos"]').check();
  const finish = page.getByRole('button', { name: 'Concluir cadastro', exact: true });
  await finish.scrollIntoViewIfNeeded(); await withinScreen(page, finish, { touch: true });
  const response = page.waitForResponse(r => r.url().endsWith('/api/registrations') && r.request().method() === 'POST');
  await finish.click(); const result = await response; assert.equal(result.status(), 201); const saved = await result.json();
  assert.equal(environment.registration(saved.id).email, values.email, 'The mobile form must persist a real registration');
  await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
  await navigate(page, 'Meu perfil'); await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cursos cadastrados (0)', exact: true }).click();
  await page.getByText('Nenhum curso cadastrado', { exact: true }).waitFor();
  await noOverflow(page); await openFirstCourse(page);
  await page.getByRole('button', { name: 'Inscrever-se', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirmar minha inscrição', exact: true });
  await confirm.scrollIntoViewIfNeeded(); await withinScreen(page, confirm, { touch: true }); await noOverflow(page);
  await confirm.click(); await page.getByRole('status').filter({ hasText: 'Inscrição confirmada. O curso está disponível no seu perfil.' }).waitFor();
  const rows = environment.confirmedEnrollments(saved.id); assert.equal(rows.length, 1); assert.equal(Number(rows[0].course_id), 1);
  await navigate(page, 'Meu perfil'); await page.getByRole('button', { name: 'Cursos cadastrados (1)', exact: true }).click();
  await page.getByRole('heading', { name: COURSES[0].title, exact: true }).waitFor(); await noOverflow(page);
  return saved.id;
}
async function runCase(browser, engine, name, viewport, action) {
  const started = Date.now(); const index = ++caseIndex;
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = []; let page;
  try {
    await environment.prepareContext(context);
    await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' }));
    page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(environment.baseURL, { waitUntil: 'domcontentloaded' }); await page.getByRole('heading', { name: /Encontre oportunidades/i }).waitFor();
    viewportSeen(engine, viewport, name); const evidence = await action(page, index);
    assert.deepEqual(errors, [], 'Unexpected browser errors');
    const screenshot = `${engine}-${String(index).padStart(2, '0')}.png`;
    await page.screenshot({ path: join(artifacts, screenshot), fullPage: false });
    report.checks.push({ engine, name, viewport, status: 'passed', durationMs: Date.now() - started, evidence, screenshot });
    console.log(`PASS\t${engine}: ${name}`);
  } catch (error) {
    const screenshot = `${engine}-failure-${index}.png`; await page?.screenshot({ path: join(artifacts, screenshot), fullPage: true }).catch(() => {});
    report.checks.push({ engine, name, viewport, status: 'failed', durationMs: Date.now() - started, error: error.stack, screenshot });
    console.error(`FAIL\t${engine}: ${name}: ${error.message}`);
  } finally { await context.close(); }
}
async function viewportFlow(page, target, engine, index) {
  const checks = [];
  await noOverflow(page); await withinScreen(page, page.getByRole('button', { name: 'Abrir menu', exact: true }), { vertical: true, touch: true });
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click(); const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden');
  const zoom = menu.getByRole('button', { name: 'Aumentar tamanho da fonte', exact: true });
  for (let i = 0; i < 5; i++) await zoom.click();
  assert.equal(await page.locator('html').evaluate(el => el.style.fontSize), '20px');
  await menu.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
  await menu.getByRole('button', { name: 'Fechar menu', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Abrir menu'); checks.push('menu-focus-scroll-lock-and-125%-font');
  const rotated = { width: target.viewport.height, height: target.viewport.width };
  await page.setViewportSize(rotated); viewportSeen(engine, rotated, `${target.name}: rotation`); await noOverflow(page);
  await withinScreen(page, page.getByRole('button', { name: 'Buscar cursos', exact: true }), { vertical: true, touch: true });
  await page.getByRole('button', { name: 'Buscar cursos', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Buscar cursos no site', exact: true }); await withinScreen(page, search, { vertical: true }); await noOverflow(page);
  await search.press('Escape'); await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Buscar cursos');
  await page.setViewportSize(target.viewport); await page.getByRole('button', { name: 'Buscar cursos', exact: true }).click(); await search.fill('Excel'); await search.press('Enter');
  await page.getByRole('heading', { name: /Encontre o curso ideal/ }).waitFor(); assert.equal(await page.locator('main article').count(), 1);
  await withinScreen(page, page.getByRole('combobox', { name: 'Categoria', exact: true }), { touch: true }); await noOverflow(page);
  await page.getByRole('combobox', { name: 'Modalidade', exact: true }).selectOption('Online'); assert.equal(await page.locator('main article').count(), 1); checks.push('rotated-header-search-filter');
  const favorite = page.getByRole('button', { name: `Adicionar ${title} aos favoritos`, exact: true }); await withinScreen(page, favorite, { touch: true }); await favorite.click();
  await navigate(page, 'Favoritos'); await page.locator('main article').waitFor(); assert.equal(await page.locator('main article').count(), 1);
  await page.reload({ waitUntil: 'domcontentloaded' }); await navigate(page, 'Favoritos'); await page.locator('main article').waitFor();
  await page.locator('main article').getByRole('button', { name: /Ver curso/ }).click();
  for (const tab of ['Sobre o curso', 'Conteúdo programático', 'Instrutor', 'Requisitos', 'Certificado', 'Instituição']) {
    const button = page.getByRole('button', { name: tab, exact: true }); await button.scrollIntoViewIfNeeded(); await withinScreen(page, button, { touch: true }); await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); await noOverflow(page);
  } checks.push('favorites-persistence-six-course-tabs');
  for (const label of ['Categorias', 'Sobre', 'Contato']) { await navigate(page, label); await noOverflow(page); }
  await page.locator('footer').getByRole('button', { name: 'Termos de Uso', exact: true }).click(); const policy = page.getByRole('dialog');
  await policy.getByRole('heading', { name: 'Termos de uso', exact: true }).waitFor(); await withinScreen(page, policy, { vertical: true });
  await policy.getByRole('button', { name: 'Fechar', exact: true }).click(); await policy.waitFor({ state: 'hidden' }); checks.push('navigation-policy-dialog');
  if (target.full) { const id = await completeRegistration(page, index); checks.push(`registration-profile-enrollment-sql:${id}`); }
  else {
    await navigate(page, 'Meu perfil'); const next = page.getByRole('button', { name: 'Próximo', exact: true }); await next.scrollIntoViewIfNeeded(); await withinScreen(page, next, { touch: true });
    const phone = page.locator('[name="telefone"]'); assert.equal(await phone.getAttribute('inputmode'), 'tel'); assert(await phone.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16)); await noOverflow(page);
    await page.getByRole('button', { name: 'Voltar ao site', exact: true }).click();
  }
  const chat = await openChat(page); await withinScreen(page, chat, { vertical: true });
  await page.setViewportSize({ width: target.viewport.width, height: 320 }); viewportSeen(engine, page.viewportSize(), `${target.name}: reduced keyboard space`);
  const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true }); await input.fill('Os cursos são gratuitos?');
  await page.waitForFunction(() => document.querySelector('.tortuguita-panel')?.getAttribute('data-compact') === 'true');
  await withinScreen(page, input, { vertical: true }); await withinScreen(page, chat.getByRole('button', { name: 'Enviar mensagem', exact: true }), { vertical: true, touch: true });
  await chat.getByRole('button', { name: 'Enviar mensagem', exact: true }).click(); assert.match(await chat.getByRole('log').innerText(), /gratuit/i); await input.press('Escape'); await chat.waitFor({ state: 'hidden' }); checks.push('compact-chat-input-and-send');
  await page.setViewportSize(target.viewport); await noOverflow(page);
  if (target.name === 'Tablet 768') {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.setViewportSize({ width: 1366, height: 800 }); viewportSeen(engine, page.viewportSize(), 'tablet-to-desktop-breakpoint');
    await page.getByRole('dialog', { name: 'Menu', exact: true }).waitFor({ state: 'hidden' });
    assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden', 'Desktop breakpoint must release the menu scroll lock');
    await page.locator('header').getByRole('button', { name: 'Cursos', exact: true }).waitFor();
    await noOverflow(page); checks.push('tablet-desktop-breakpoint-releases-menu');
    await page.setViewportSize(target.viewport);
  }
  return { phases: checks, initialViewport: target.viewport, rotatedViewport: rotated, appFontScale: '125%', darkMode: true, noEmailSent: environment.emails.length === 0 };
}

try {
  environment = await startTestEnvironment({ google: true });
  for (const engine of requestedEngines) {
    const executablePath = engine === 'chromium' ? findBrowserExecutable() : process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH || webkit.executablePath();
    if (!existsSync(executablePath)) throw new Error(`${engine} executable missing: ${executablePath}. Install the requested engine; it is not counted as validated.`);
    const browser = await (engine === 'chromium' ? chromium : webkit).launch({ executablePath, headless: true });
    report.executedEngines.push({ engine, version: browser.version() });
    try {
      for (const target of targets) await runCase(browser, engine, target.name, target.viewport, (page, index) => viewportFlow(page, target, engine, index));
      await runCase(browser, engine, 'Search 640×360 at 125% text remains usable', { width: 640, height: 360 }, async page => {
        await page.evaluate(() => localStorage.setItem('qualificavix-font-scale', '1.25')); await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Buscar cursos', exact: true }).click(); await noOverflow(page);
        await withinScreen(page, page.getByRole('searchbox', { name: 'Buscar cursos no site', exact: true }), { vertical: true });
        await withinScreen(page, page.getByRole('button', { name: 'Fechar busca', exact: true }), { vertical: true, touch: true });
        await page.getByRole('searchbox').fill('Excel'); await page.getByRole('searchbox').press('Enter'); await page.getByRole('heading', { name: /Encontre o curso ideal/ }).waitFor();
        assert.equal(await page.locator('main article').count(), 1); return { fontScale: '125%', searchSubmitted: true };
      });
      await runCase(browser, engine, 'Browser Back and Forward traverse platform pages', { width: 390, height: 844 }, async page => {
        await enterCatalog(page); await navigate(page, 'Favoritos'); await page.getByRole('heading', { name: 'Cursos favoritados', exact: true }).waitFor();
        await page.goBack(); await page.getByRole('heading', { name: /Encontre o curso ideal/ }).waitFor();
        await page.goForward(); await page.getByRole('heading', { name: 'Cursos favoritados', exact: true }).waitFor(); await noOverflow(page); return { browserHistory: 'back-and-forward' };
      });
      await runCase(browser, engine, 'Expanded chat memory leaves input accessible with keyboard space reduced', { width: 390, height: 844 }, async (page, sequence) => {
        const profile = { id: 15000 + sequence, nome: 'Pessoa Mobile Memória', email: `mobile-memory${sequence}@example.test`, telefone: '27999999999', cep: '29050-945', bairro: 'Bento Ferreira', rua: 'Rua de teste', numero: '', escolaridade: 'Ensino médio completo', enrolledCourseIds: [], enrollments: [] };
        environment.seedRegistration(profile); await page.evaluate(({ profile, key }) => localStorage.setItem(key, JSON.stringify(profile)), { profile, key: PROFILE_KEY }); await page.reload({ waitUntil: 'domcontentloaded' });
        const chat = await openChat(page); await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click(); await chat.getByText('Sua memória com a Tortuguita', { exact: true }).click();
        await page.setViewportSize({ width: 390, height: 320 }); const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true }); await input.fill('Quero saber sobre Excel');
        await page.waitForFunction(() => document.querySelector('.tortuguita-panel')?.getAttribute('data-compact') === 'true');
        await withinScreen(page, input, { vertical: true }); await withinScreen(page, chat.getByRole('button', { name: 'Enviar mensagem', exact: true }), { vertical: true, touch: true });
        await chat.getByRole('button', { name: 'Enviar mensagem', exact: true }).click(); return { memoryExpanded: true, compactViewport: { width: 390, height: 320 }, inputReachable: true };
      });
      await runCase(browser, engine, 'Policy close stays reachable after scrolling in landscape', { width: 844, height: 390 }, async page => {
        await page.locator('footer').getByRole('button', { name: 'Termos de Uso', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
        const document = dialog.locator('.policy-document'); await document.evaluate(el => { el.scrollTop = el.scrollHeight; });
        assert(await document.evaluate(el => el.scrollTop > 0), 'Policy content must actually scroll before the close control is checked');
        await withinScreen(page, document.locator('p').last(), { vertical: true });
        const close = dialog.getByRole('button', { name: 'Fechar', exact: true }); await withinScreen(page, close, { vertical: true, touch: true });
        await close.click(); await dialog.waitFor({ state: 'hidden' }); return { scrolledPolicy: true, closeReachableWithoutScrollReset: true };
      });
      await runCase(browser, engine, 'Google chooser close stays reachable after scrolling with reduced keyboard space', { width: 390, height: 320 }, async page => {
        // Only the provider's visual button is simulated here; signed identity/session tests live in google-login.e2e.mjs.
        await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: `window.google={accounts:{id:{initialize(){},renderButton(parent,options){const button=document.createElement('button');button.textContent='Conta Google simulada';button.style.width=options.width+'px';button.style.height='44px';parent.append(button);},prompt(){},cancel(){}}}};` }));
        await navigate(page, 'Meu perfil'); await page.getByRole('button', { name: 'Continuar com Google', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Entrar na sua conta', exact: true });
        await dialog.getByRole('button', { name: 'Conta Google simulada', exact: true }).waitFor(); await withinScreen(page, dialog, { vertical: true });
        const options = dialog.locator('.google-account-options'); await options.evaluate(el => { el.scrollTop = el.scrollHeight; });
        assert(await options.evaluate(el => el.scrollTop > 0), 'Google options must actually scroll before the close control is checked');
        await withinScreen(page, options.getByRole('link', { name: 'Continuar com Google em outra página', exact: true }), { vertical: true, touch: true });
        const close = dialog.getByRole('button', { name: 'Fechar', exact: true }); await withinScreen(page, close, { vertical: true, touch: true });
        await close.click(); await dialog.waitFor({ state: 'hidden' }); await noOverflow(page);
        return { providerUI: 'local visual fixture', optionsScrolled: true, closeReachableWithoutScrollReset: true };
      });
      await runCase(browser, engine, 'Browser Back after logout cannot reopen the previous profile', { width: 390, height: 844 }, async (page, sequence) => {
        const profile = { id: 19000 + sequence, nome: 'Pessoa Mobile Histórico', email: `mobile-history${sequence}@example.test`, telefone: '27999999999', cep: '29050-945', bairro: 'Bento Ferreira', rua: 'Rua de teste', numero: '', escolaridade: 'Ensino médio completo', enrolledCourseIds: [], enrollments: [] };
        environment.seedRegistration(profile); await page.evaluate(({ profile, key }) => localStorage.setItem(key, JSON.stringify(profile)), { profile, key: PROFILE_KEY }); await page.reload({ waitUntil: 'domcontentloaded' });
        await navigate(page, 'Meu perfil'); await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
        const navigation = await page.evaluate(() => history.state?.qualificavixNavigation);
        assert.deepEqual(Object.keys(navigation).sort(), ['courseId', 'page', 'scrollY']); assert.equal(navigation.page, 'profile');
        const response = page.waitForResponse(result => result.url().endsWith('/api/auth?action=logout'));
        page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Sair da plataforma', exact: true }).click(); assert.equal((await response).status(), 200);
        await page.getByRole('heading', { name: /Encontre oportunidades/i }).waitFor(); await page.goBack();
        await page.locator('[name="cpf"]').waitFor({ state: 'visible' }); assert.equal(await page.getByRole('heading', { name: 'Meu perfil', exact: true }).count(), 0);
        assert.equal(await page.evaluate(key => localStorage.getItem(key), PROFILE_KEY), null); await noOverflow(page);
        return { previousPage: 'profile', restoredPage: 'registration', localProfileCleared: true, historyContainsOnlyPublicNavigation: true };
      });
    } finally { await browser.close(); }
  }
} catch (error) {
  report.setupFailure = error.message; console.error(`SETUP_FAILURE\t${error.message}`); process.exitCode = 1;
} finally {
  await environment?.cleanup(); report.finishedAt = new Date().toISOString(); report.passed = report.checks.filter(check => check.status === 'passed').length;
  report.failed = report.checks.filter(check => check.status === 'failed').length; report.total = report.checks.length;
  await writeFile(join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
}
console.log(`RESULT\t${report.passed}/${report.total} mobile scenarios passed; ${report.viewports.length} distinct engine/viewport combinations checked`);
if (report.failed || report.setupFailure) process.exitCode = 1;
