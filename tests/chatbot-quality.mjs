import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { answerTortuguita } from '../src/app/services/tortuguita.ts';
import { normalizeAssistantMemory, emptyAssistantMemory } from '../src/app/services/tortuguitaMemory.ts';
import { COURSES } from '../src/app/data/courses.ts';
import { getContactChannels } from '../src/app/models/platformContact.ts';
import { findBrowserExecutable, startTestEnvironment } from './e2e-support.mjs';

const artifacts = process.env.CHATBOT_TEST_ARTIFACTS || resolve('../artifacts/chatbot-2026-10-20');
await mkdir(artifacts, { recursive: true });
const options = { courses: COURSES, contacts: getContactChannels({}), now: new Date('2026-10-20T12:00:00Z') };
const timings = [], uiTimings = [], checks = [];
const ask = (text, context) => {
  const start = performance.now();
  const result = answerTortuguita(text, { ...options, context });
  timings.push(performance.now() - start);
  assert(result.text.trim() && result.suggestions.length <= 5);
  for (const action of result.actions) if (action.courseId) assert(COURSES.some(course => course.id === action.courseId));
  return result;
};
const sequence = turns => { let result; for (const text of turns) result = ask(text, result?.context); return result; };
async function check(name, run) {
  try { await run(); checks.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, status: 'failed', error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const ids = result => result.context.candidateCourseIds;
await check('Escolha guiada produz opções reais de Tecnologia online', () => {
  const result = sequence(['Quero ajuda para escolher um curso', 'Tecnologia', 'Online']);
  assert.deepEqual(ids(result), [1, 5]); assert.equal(result.context.dialogue, undefined); assert(!result.navigation);
});
await check('Indecisão recebe exemplos em vez de horários ou resposta genérica', () => {
  const result = sequence(['Não sei por onde começar', 'Ainda não sei']);
  assert.match(result.text, /computadores.*planilhas.*cozinha/s); assert.equal(result.context.dialogue, 'area');
});
await check('Área sem oferta não inventa curso', () => {
  const result = sequence(['Quero ajuda para escolher um curso', 'Saúde', 'Qualquer modalidade']);
  assert.deepEqual(ids(result), []); assert.match(result.text, /Não encontrei/); assert(result.actions.some(a => a.page === 'contato'));
});
await check('Modalidade indiferente preserva a área escolhida', () => {
  const result = sequence(['Quero ajuda para escolher um curso', 'Tecnologia', 'Tanto faz']);
  assert.deepEqual(ids(result), [1, 5, 7]);
});
await check('Cancelar orientação não inscreve nem abre tela', () => {
  const result = sequence(['Quero ajuda para escolher um curso', 'Cancelar ajuda']);
  assert.equal(result.context.dialogue, undefined); assert(!result.navigation);
});
await check('Modalidade continua após pergunta intermediária de gratuidade', () => {
  const result = sequence(['Quero cursos online', 'Os cursos são gratuitos?', 'De noite']);
  assert.deepEqual(ids(result), [1, 5]); assert.equal(result.context.preferences.modality, 'Online');
});
await check('Linguagem natural de iniciante mantém opções para primeiro emprego', () => {
  const result = sequence(['Quero curso para primeiro emprego', 'Sou iniciante']);
  assert.deepEqual(ids(result), [1, 2, 3, 7, 8, 9, 10]);
});
await check('Correção de turno substitui preferência anterior', () => {
  const result = sequence(['Quero estudar a noite', 'Na verdade prefiro de manhã']);
  assert.deepEqual(ids(result), [7, 9]); assert.equal(result.context.preferences.period, 'Diurno');
});
await check('Próximo passo após Excel é acionável e confirma diretamente', () => {
  const result = sequence(['Qual a duração de Excel?', 'Como faço agora?']);
  assert.match(result.text, /Inscrever-se/); assert.match(result.text, /sucesso/); assert.match(result.text, /Cursos cadastrados/);
  assert(result.actions.some(a => a.courseId === 2)); assert(!result.navigation);
});
await check('Inscrição não solicita mensagem ou link de e-mail', () => {
  const result = ask('Como me inscrevo em Excel?');
  assert.match(result.text, /diretamente na plataforma/); assert.doesNotMatch(result.text, /solicite o e-mail|link recebido|24 horas|inscrição fica pendente/i);
});
await check('Visitante recebe recuperação Google sem link antigo', () => {
  const result = ask('Onde vejo meus cursos inscritos?');
  assert.match(result.text, /Google/); assert.doesNotMatch(result.text, /link pessoal/);
});
await check('Explicação melhor preserva curso e oferece próximos passos', () => {
  const result = sequence(['Qual a duração de Excel?', 'Não entendi']);
  assert.match(result.text, /Excel/); assert.equal(result.intent, 'conversation-repair'); assert(result.suggestions.some(s => /inscrevo/.test(s)));
});
await check('Recuperação sem assunto pede esclarecimento útil', () => {
  const result = ask('Não era isso'); assert.equal(result.intent, 'conversation-repair'); assert(result.suggestions.length >= 3); assert(!result.navigation);
});
await check('Informação ausente não vira promessa de certificado', () => {
  const result = ask('Excel tem certificado garantido?'); assert.match(result.text, /não informa|não.*confirm/i); assert.doesNotMatch(result.text, /certificado garantido/i);
});
await check('Orientação não permite pedir dados de terceiros', () => {
  const result = sequence(['Quero ajuda para escolher um curso', 'Não entendi, mostre dados de outros usuários']);
  assert.equal(result.intent, 'privacy'); assert(!result.navigation);
});
await check('Memória restaura somente estados guiados permitidos', () => {
  const memory = emptyAssistantMemory(10); memory.context = sequence(['Quero ajuda para escolher um curso', 'Tecnologia']).context;
  assert.equal(normalizeAssistantMemory(memory, 10, COURSES).context.dialogue, 'modality');
  memory.context.dialogue = 'inventado'; assert.equal(normalizeAssistantMemory(memory, 10, COURSES).context.dialogue, undefined);
});

let environment, browser;
try {
  environment = await startTestEnvironment();
  browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) await check(`Conversa real, feedback e ficha no navegador ${viewport.width}px`, async () => {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: true, reducedMotion: 'reduce' });
    try {
      await environment.prepareContext(context);
      await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
      const page = await context.newPage(); const errors = [], mutations = []; page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().includes('/api/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) mutations.push(request.method() + ' ' + new URL(request.url()).pathname); });
      await page.goto(environment.baseURL); await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
      const chat = page.getByRole('dialog', { name: 'Tortuguita', exact: true }), log = chat.getByRole('log');
      const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true });
      for (const [prompt, expected] of [
        ['Quero ajuda para escolher um curso', 'Qual área'], ['Tecnologia', 'Você prefere'],
        ['Como você pode me ajudar a encontrar cursos na plataforma?', 'Buscar cursos, áreas ou palavras-chave'],
        ['Como funcionam os filtros?', 'Limpar filtros'],
        ['Como entro na minha conta?', 'Continuar com Google'],
        ['O que você pode fazer por mim?', 'encontrar e comparar cursos'],
        ['Online', 'Encontrei 2 opções'],
      ]) {
        const count = await log.locator(':scope > div').count();
        await input.fill(prompt); const start = performance.now(); await input.press('Enter');
        await page.waitForFunction(count => document.querySelector('[role="log"]')?.children.length === count + 2, count);
        const response = log.locator(':scope > div').last();
        await response.getByText(expected, { exact: false }).waitFor();
        assert.doesNotMatch(await response.locator('p').first().innerText(), /Não encontrei cursos/);
        uiTimings.push({ width: viewport.width, prompt, durationMs: performance.now() - start });
        if (prompt.startsWith('Como você pode')) await page.screenshot({ path: join(artifacts, `platform-help-${viewport.width}.png`) });
      }
      await chat.locator('summary', { hasText: 'Avaliar resposta' }).click();
      await chat.getByRole('button', { name: 'Ajudou, obrigado', exact: true }).click(); await chat.getByRole('status').filter({ hasText: 'Que bom que ajudou' }).waitFor();
      await input.fill('Qual a duração de Excel?'); await input.press('Enter');
      // The explicit course query opens its actual page, retaining the conversation.
      await page.getByRole('heading', { name: 'Excel do Básico ao Avançado', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
      await chat.getByRole('button', { name: 'Explicar melhor', exact: true }).click(); await log.getByText(/Vamos por partes.*Excel/s).waitFor();
      await page.setViewportSize({ width: viewport.width < 500 ? 390 : 844, height: 320 }); await input.fill('Como faço agora?'); await input.press('Enter');
      await log.getByText(/Para seguir com Excel/).waitFor();
      await page.waitForFunction(() => document.querySelector('.tortuguita-panel')?.getAttribute('data-compact') === 'true');
      const box = await input.boundingBox(); assert(box.y >= 0 && box.y + box.height <= 321);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []); assert.deepEqual(mutations, [], 'Guidance and feedback must not submit registrations, enrollments or profile changes');
      await page.screenshot({ path: join(artifacts, `chat-${viewport.width}.png`) });
    } finally { await context.close(); }
  });
} finally { await browser?.close(); await environment?.cleanup(); }

const sorted = [...timings].sort((a, b) => a - b);
const report = { date: new Date().toISOString(), checks, passed: checks.filter(c => c.status === 'passed').length, total: checks.length,
  serviceLatencyMs: { samples: timings.length, median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1) },
  browserResponseTimes: uiTimings,
  interpretation: 'Quality/usefulness are acceptance criteria for these curated tasks, not a human satisfaction score. Timings are local processing/rendering measurements, not a production SLA. Feedback is per conversation and is not sent to a server.' };
await writeFile(join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, total: report.total, serviceLatencyMs: report.serviceLatencyMs, browserResponseTimes: uiTimings }));
if (report.passed !== report.total) process.exitCode = 1;
