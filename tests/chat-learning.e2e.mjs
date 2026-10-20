import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { startTestEnvironment, findBrowserExecutable } from './e2e-support.mjs';

if (process.env.TEST_URL) throw new Error('Use a API e o banco temporários desta suíte, sem TEST_URL.');
const artifacts = process.env.CHAT_LEARNING_ARTIFACTS || resolve('../artifacts/chat-learning-2026-10-20');
await mkdir(artifacts, { recursive: true });
const environment = await startTestEnvironment();
const browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
const checks = [], timings = [];
const ratings = () => environment.chatLearningRows().filter(row => row.reward !== null);
async function run(name, viewport, action) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 500, reducedMotion: 'reduce' });
  try {
    await environment.prepareContext(context);
    await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().endsWith('/api/chat-learning')) requests.push(request.postDataJSON()); });
    await page.goto(environment.baseURL); await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
    const chat = page.getByRole('dialog', { name: 'Tortuguita', exact: true }), log = chat.getByRole('log');
    const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true });
    const consent = chat.getByRole('checkbox', { name: 'Permitir aprendizado com minhas avaliações', exact: true });
    const settings = chat.locator('details').filter({ has: page.locator('summary', { hasText: 'Melhorar a Tortuguita' }) });
    async function ask(prompt, expected) {
      const count = await log.locator(':scope > div').count(); const started = performance.now();
      await input.fill(prompt); await input.press('Enter');
      await page.waitForFunction(count => document.querySelector('[role="log"]')?.children.length === count + 2, count);
      const answer = log.locator(':scope > div').last();
      await answer.locator('p').first().filter({ hasText: expected }).waitFor();
      timings.push({ name, durationMs: performance.now() - started });
      await answer.locator('summary', { hasText: 'Avaliar resposta' }).click();
      return answer;
    }
    async function enable() {
      await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
      if (!await settings.evaluate(el => el.open)) await settings.locator('summary').click();
      await consent.check(); await settings.locator('summary').click();
      await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
    }
    const apiResponse = action => page.waitForResponse(response => response.url().endsWith('/api/chat-learning') && response.request().postDataJSON()?.action === action);
    await action({ context, page, chat, log, input, consent, settings, requests, ask, enable, apiResponse });
    assert.deepEqual(errors, []); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    const screenshot = `${checks.length + 1}.png`; await page.screenshot({ path: join(artifacts, screenshot) });
    checks.push({ name, status: 'passed', screenshot }); console.log(`PASS ${name}`);
  } catch (error) { checks.push({ name, status: 'failed', error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
  finally { await context.close(); }
}
try {
  for (const width of [390, 1440]) await run(`Consentimento, votos reais, repetição, retirada e exclusão em ${width}px`, { width, height: 844 }, async ({ context, page, chat, consent, settings, input, requests, ask, enable, apiResponse }) => {
    await ask('Como funcionam os filtros?', 'Categoria e Modalidade'); assert.equal(requests.length, 0);
    const before = ratings().length;
    await enable();
    let pending = apiResponse('select'); await ask('Como uso a busca?', 'Buscar cursos'); const choice = await (await pending).json();
    assert(choice.token); assert(['direct', 'steps'].includes(choice.variant));
    const cookie = (await context.cookies()).find(cookie => cookie.name === 'qv_chat_feedback'); assert(cookie.httpOnly); assert.equal(cookie.sameSite, 'Strict');
    pending = apiResponse('feedback'); await chat.getByRole('button', { name: 'Ajudou, obrigado', exact: true }).click();
    assert.equal((await pending).status(), 200); await chat.getByRole('status').filter({ hasText: 'Sua avaliação foi registrada' }).waitFor();
    assert.equal(ratings().length, before + 1);
    assert.equal((await context.request.post(`${environment.baseURL}/api/chat-learning`, { data: { action: 'feedback', token: choice.token, reason: 'found' } })).status(), 200);
    assert.equal(ratings().length, before + 1);
    const outsider = await browser.newContext();
    try { assert.equal((await outsider.request.post(`${environment.baseURL}/api/chat-learning`, { data: { action: 'feedback', token: choice.token, reason: 'found' } })).status(), 401); }
    finally { await outsider.close(); }
    pending = apiResponse('select'); await ask('Como funcionam os filtros?', 'Limpar filtros'); await pending;
    await chat.getByRole('button', { name: 'Não ajudou', exact: true }).click();
    pending = apiResponse('feedback'); await chat.getByRole('button', { name: 'Resposta confusa', exact: true }).click(); assert.equal((await pending).status(), 200);
    await chat.getByRole('status').filter({ hasText: 'Avaliação registrada' }).waitFor();
    assert.equal(ratings().filter(row => row.reason === 'confusing').length > 0, true);
    // An unavailable write must show an error and keep the same ticket retryable.
    pending = apiResponse('select'); await ask('Quais categorias existem?', 'Categorias'); await pending;
    let fail = true;
    await page.route('**/api/chat-learning', route => {
      if (route.request().postDataJSON()?.action === 'feedback' && fail) { fail = false; return route.fulfill({ status: 503, json: { error: 'temporary' } }); }
      return route.continue();
    });
    await chat.getByRole('button', { name: 'Ajudou, obrigado', exact: true }).click(); await chat.getByRole('alert').waitFor();
    assert.equal(ratings().length, before + 2);
    pending = apiResponse('feedback'); await chat.getByRole('button', { name: 'Ajudou, obrigado', exact: true }).click(); assert.equal((await pending).status(), 200);
    await chat.getByRole('status').filter({ hasText: 'Sua avaliação foi registrada' }).waitFor();
    await page.unroute('**/api/chat-learning');
    pending = apiResponse('select'); await ask('Quais são as etapas do cadastro?', 'Dados Pessoais'); await pending;
    await chat.getByRole('button', { name: 'Não ajudou', exact: true }).click();
    pending = apiResponse('feedback'); await chat.getByRole('button', { name: 'Informação incorreta', exact: true }).click(); assert.equal((await pending).status(), 200);
    await chat.getByRole('status').filter({ hasText: 'sinalizado para revisão' }).waitFor();
    assert.equal(ratings().length, before + 4);
    assert(requests.every(body => Object.keys(body).every(key => ['action', 'topic', 'token', 'reason'].includes(key))), 'No raw question, answer or profile may leave the browser');
    await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
    await settings.locator('summary').click(); await consent.uncheck();
    const calls = requests.length; await ask('Como entro na minha conta?', 'Google'); assert.equal(requests.length, calls);
    // Failed deletion is not reported as success; a retry removes this browser's votes only.
    await page.route('**/api/chat-learning', route => route.request().postDataJSON()?.action === 'forget' ? route.fulfill({ status: 503, json: { error: 'temporary' } }) : route.continue());
    await chat.getByRole('button', { name: 'Apagar minhas avaliações', exact: true }).click();
    await chat.getByRole('status').filter({ hasText: 'Não foi possível apagar' }).waitFor(); assert.equal(ratings().length, before + 4);
    await page.unroute('**/api/chat-learning'); pending = apiResponse('forget');
    await chat.getByRole('button', { name: 'Apagar minhas avaliações', exact: true }).click(); assert.equal((await pending).status(), 200);
    await chat.getByRole('status').filter({ hasText: 'Avaliações deste navegador apagadas' }).waitFor(); assert.equal(ratings().length, before);
    await page.setViewportSize({ width: 390, height: 320 }); await input.fill('Os cursos são gratuitos?'); await input.press('Enter');
    await page.waitForFunction(() => document.querySelector('.tortuguita-panel')?.getAttribute('data-compact') === 'true');
    const box = await input.boundingBox(); assert(box.y >= 0 && box.y + box.height <= 321);
  });
  await run('API indisponível e prazo de rede não bloqueiam a resposta revisada', { width: 390, height: 844 }, async ({ page, chat, ask, enable }) => {
    await enable();
    await page.route('**/api/chat-learning', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
    await ask('Como uso a busca?', 'Buscar cursos'); await chat.getByRole('status').filter({ hasText: 'aprendizado está indisponível' }).waitFor();
    await page.unroute('**/api/chat-learning');
    let release; const gate = new Promise(resolve => release = resolve);
    await page.route('**/api/chat-learning', async route => { await gate; await route.fulfill({ status: 503, json: {} }).catch(() => {}); });
    const started = performance.now();
    try { await ask('Como funcionam os filtros?', 'Categoria e Modalidade'); assert(performance.now() - started < 6500); }
    finally { release(); }
  });
  await run('Reiniciar durante uma seleção pendente não restaura a resposta antiga', { width: 390, height: 844 }, async ({ page, chat, input, log, enable }) => {
    await enable();
    let release; const gate = new Promise(resolve => release = resolve);
    await page.route('**/api/chat-learning', async route => { await gate; await route.fulfill({ status: 503, json: {} }).catch(() => {}); });
    await input.fill('Como uso a busca?'); await input.press('Enter'); await chat.getByRole('status').filter({ hasText: 'Preparando' }).waitFor();
    await chat.getByRole('button', { name: 'Reiniciar conversa', exact: true }).click(); release();
    await page.unroute('**/api/chat-learning');
    await input.fill('Os cursos são gratuitos?'); await input.press('Enter');
    await log.getByText(/Os cursos e o cadastro são apresentados como gratuitos/).waitFor();
    assert.doesNotMatch(await log.innerText(), /Buscar cursos, áreas|Como uso a busca/);
  });
  await run('Retirar a permissão sincroniza outra aba antes da próxima pergunta', { width: 390, height: 844 }, async ({ context, chat, consent, settings, enable }) => {
    await enable();
    const other = await context.newPage(); const requests = [];
    other.on('request', request => { if (request.url().endsWith('/api/chat-learning')) requests.push(request.url()); });
    try {
      await other.goto(environment.baseURL); await other.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
      const otherChat = other.getByRole('dialog', { name: 'Tortuguita', exact: true });
      await otherChat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
      await otherChat.locator('summary', { hasText: 'Melhorar a Tortuguita' }).click();
      assert(await otherChat.getByRole('checkbox', { name: 'Permitir aprendizado com minhas avaliações', exact: true }).isChecked());
      await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
      await settings.locator('summary').click(); await consent.uncheck();
      await other.waitForFunction(() => { const input = document.querySelector('.tortuguita-panel input[type="checkbox"]'); return input && !input.checked; });
      const input = otherChat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true }); await input.fill('Como uso a busca?'); await input.press('Enter');
      await otherChat.getByRole('log').getByText(/Abra Cursos e use Buscar cursos/).waitFor(); assert.equal(requests.length, 0);
    } finally { await other.close(); }
  });
} finally { await browser.close(); await environment.cleanup(); }
const report = { date: new Date().toISOString(), checks, passed: checks.filter(c => c.status === 'passed').length, total: checks.length, timings, limitations: ['Chromium with viewport/touch emulation, not physical Android or Safari.', 'SQLite test database; PostgreSQL SQL has separate PGlite tests.', 'No real-user satisfaction or production latency claim.'] };
await writeFile(join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
console.log(`RESULT ${report.passed}/${report.total} learning browser scenarios passed`);
if (report.passed !== report.total) process.exitCode = 1;
