import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { startTestEnvironment, findBrowserExecutable } from './e2e-support.mjs';

const artifacts = resolve('../artifacts/chat-interaction');
await mkdir(artifacts, { recursive: true });
const environment = await startTestEnvironment();
const browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
const checks = [], timings = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500, reducedMotion: 'reduce' });
    try {
      await environment.prepareContext(context);
      await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
      const page = await context.newPage(); const errors = [], mutations = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url()); });
      await page.goto(environment.baseURL);
      await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
      const chat = page.getByRole('dialog', { name: 'Tortuguita', exact: true }), log = chat.getByRole('log');
      const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true });
      const choices = chat.getByLabel('Perguntas sugeridas', { exact: true });
      async function turn(prompt, expected, button = false) {
        const count = await log.locator('[data-chat-message-text]').count(), started = performance.now();
        if (button) await choices.getByRole('button', { name: prompt, exact: true }).click();
        else { await input.fill(prompt); await input.press('Enter'); }
        await page.waitForFunction(count => document.querySelectorAll('[data-chat-message-text]').length === count + 2, count);
        const answer = log.locator('[data-chat-message-text]').last();
        await answer.filter({ hasText: expected }).waitFor();
        timings.push({ width, prompt, elapsedMs: performance.now() - started });
        return answer;
      }
      const greeting = await turn('ola boa noite', 'Boa noite!');
      assert.doesNotMatch(await greeting.innerText(), /Não encontrei|Noturno|com estes critérios/);
      assert.equal(await chat.locator('summary', { hasText: 'Avaliar resposta' }).count(), 0);
      assert.equal(await choices.getByRole('button').count(), 2);
      await page.screenshot({ path: join(artifacts, `greeting-${width}.png`) });
      await turn('Quero ajuda para escolher um curso', 'Qual área', true);
      await turn('Tecnologia', 'Você prefere', true);
      await turn('Oi, tudo bem e você?', /continuar com Tecnologia.*online, presencial/s);
      await turn('Obrigado pela ajuda', /Por nada.*online, presencial/s);
      await turn('sim', 'qualquer modalidade');
      await turn('Você não entendeu', 'Vamos tentar de outro jeito');
      await turn('Online', 'Encontrei 2 opções', true);
      assert.match(await log.locator('[data-chat-message-text]').last().innerText(), /Introdução à Programação/);
      assert.match(await log.locator('[data-chat-message-text]').last().innerText(), /Desenvolvimento Web Completo/);
      await turn('Como funcionam os filtros?', 'Categoria e Modalidade');
      await turn('obrigado', /continuar falando sobre filtrar e limpar resultados/);
      await turn('Essa resposta está errada', 'Categoria e Modalidade');
      await chat.getByRole('button', { name: 'Explicar melhor', exact: true }).click();
      await log.locator('[data-chat-message-text]').last().filter({ hasText: 'Qual parte ficou em dúvida?' }).waitFor();
      await turn('Mostrar todos os cursos', 'Encontrei 10 opções');
      await turn('Boa noite! Quero cursos presenciais de noite, por favor.', 'Eletricista Predial');
      const search = await log.locator('[data-chat-message-text]').last().innerText();
      assert.match(search, /Encontrei 1 opção/); assert.match(search, /Presencial, Noturno/);
      await chat.getByRole('button', { name: 'Fechar assistente virtual', exact: true }).click();
      await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
      await turn('Olá, bom dia', 'Eletricista Predial');
      assert.equal(await choices.getByRole('button').count(), 2);
      await page.setViewportSize({ width: width < 500 ? 390 : 844, height: 320 });
      await turn('tchau', 'Até mais!');
      const bounds = await input.boundingBox(); assert(bounds.y >= 0 && bounds.y + bounds.height <= 321);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []); assert.deepEqual(mutations, [], 'Conversar e orientar não deve gravar cadastros, inscrições ou avaliações sem consentimento');
      checks.push({ width, status: 'passed' }); console.log(`PASS Conversa completa, respostas rápidas e contexto em ${width}px`);
    } catch (error) { checks.push({ width, status: 'failed', error: error.stack }); console.error(`FAIL ${width}px: ${error.message}`); }
    finally { await context.close(); }
  }
} finally { await browser.close(); await environment.cleanup(); }
await writeFile(join(artifacts, 'results.json'), JSON.stringify({ checks, timings, limitations: ['Chromium e toque emulado; sem Safari ou aparelhos físicos.', 'Tempos locais e cenários definidos não medem satisfação de usuários reais.'] }, null, 2));
console.log(`RESULT ${checks.filter(check => check.status === 'passed').length}/${checks.length}`);
if (checks.some(check => check.status === 'failed')) process.exitCode = 1;
