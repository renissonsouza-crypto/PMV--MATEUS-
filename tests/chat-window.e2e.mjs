import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { startTestEnvironment, findBrowserExecutable } from './e2e-support.mjs';

const artifacts = resolve('../artifacts/chat-window');
await mkdir(artifacts, { recursive: true });
const environment = await startTestEnvironment();
const browser = await chromium.launch({ executablePath: findBrowserExecutable(), headless: true });
const checks = [];
async function scenario(name, viewport, action, touch = false, setup) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  try {
    await environment.prepareContext(context);
    await context.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
    if (setup) await context.addInitScript(setup);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(environment.baseURL);
    const open = () => page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).click();
    await open();
    const chat = page.getByRole('dialog', { name: 'Tortuguita', exact: true });
    await action({ page, chat, open });
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(artifacts, `${checks.length + 1}.png`) });
    checks.push({ name, status: 'passed' }); console.log(`PASS ${name}`);
  } catch (error) { checks.push({ name, status: 'failed', error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
  finally { await context.close(); }
}
async function fits(page, chat) {
  const box = await chat.boundingBox(), viewport = page.viewportSize();
  assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, JSON.stringify({ box, viewport }));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  for (const label of ['Fechar assistente virtual', 'Ampliar chat', 'Restaurar tamanho do chat']) {
    const button = chat.getByRole('button', { name: label, exact: true });
    if (!await button.count()) continue;
    const bounds = await button.boundingBox();
    assert(bounds.x >= box.x && bounds.x + bounds.width <= box.x + box.width + 1);
  }
  const input = await chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true }).boundingBox();
  assert(input.y >= box.y && input.y + input.height <= box.y + box.height);
}
try {
  await scenario('Janela maior, opções recolhidas, avaliação e sugestões sob demanda', { width: 1440, height: 1000 }, async ({ page, chat }) => {
    const box = await chat.boundingBox(); assert.equal(box.width, 480); assert.equal(box.height, 680);
    await page.screenshot({ path: join(artifacts, "desktop-initial.png") });
    assert(!await chat.locator('#chat-options').isVisible());
    assert.equal(await chat.getByLabel('Perguntas sugeridas', { exact: true }).getByRole('button').count(), 2);
    const scroll = chat.locator('[role="log"]').locator('..'); assert((await scroll.boundingBox()).height >= 450);
    const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true });
    await input.fill('Como funcionam os filtros?'); await input.press('Enter');
    await chat.getByRole('log').getByText(/Categoria e Modalidade/).waitFor();
    assert(!await chat.getByRole('button', { name: 'Ajudou, obrigado', exact: true }).isVisible());
    assert.equal(await chat.getByLabel('Perguntas sugeridas', { exact: true }).getByRole('button').count(), 0);
    await chat.locator('summary', { hasText: 'Avaliar resposta' }).click();
    await chat.getByRole('button', { name: 'Ajudou, obrigado', exact: true }).click();
    await chat.getByRole('status').filter({ hasText: 'Que bom que ajudou' }).waitFor();
    await chat.getByRole('button', { name: 'Ver sugestões de perguntas', exact: true }).click();
    assert(await chat.getByLabel('Perguntas sugeridas', { exact: true }).getByRole('button').count() > 0);
    await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
    await chat.locator('summary', { hasText: 'Melhorar a Tortuguita' }).click();
    assert(await chat.getByRole('checkbox', { name: 'Permitir aprendizado com minhas avaliações', exact: true }).isVisible());
    await fits(page, chat);
  });
  await scenario('Arrastar, teclado, persistência, ampliação e restauração', { width: 1440, height: 1000 }, async ({ page, chat, open }) => {
    const handle = chat.getByRole('button', { name: 'Redimensionar janela do chat', exact: true });
    const bounds = await handle.boundingBox();
    await page.mouse.move(bounds.x + 14, bounds.y + 14); await page.mouse.down();
    await page.mouse.move(bounds.x - 106, bounds.y - 66, { steps: 8 }); await page.mouse.up();
    let box = await chat.boundingBox(); assert.equal(box.width, 600); assert.equal(box.height, 760);
    await handle.focus(); await handle.press('Shift+ArrowLeft'); await handle.press('ArrowDown');
    box = await chat.boundingBox(); assert.equal(box.width, 640); assert.equal(box.height, 740);
    await chat.getByRole('button', { name: 'Ampliar chat', exact: true }).click();
    box = await chat.boundingBox(); assert.equal(box.width, 860); assert.equal(box.height, 968);
    await chat.getByRole('button', { name: 'Restaurar tamanho do chat', exact: true }).click();
    assert.equal((await chat.boundingBox()).width, 640);
    await chat.getByRole('button', { name: 'Fechar assistente virtual', exact: true }).click(); await open();
    assert.equal((await chat.boundingBox()).height, 740);
    await page.reload(); await open(); assert.equal((await chat.boundingBox()).width, 640);
    // Minimum dimensions must still leave the composer and a conversation area usable.
    for (let i = 0; i < 15; i++) await handle.press('Shift+ArrowDown');
    for (let i = 0; i < 10; i++) await handle.press('Shift+ArrowRight');
    assert.equal((await chat.boundingBox()).height, 320);
    await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
    await chat.locator('summary', { hasText: 'Melhorar a Tortuguita' }).click();
    await fits(page, chat);
    assert((await chat.getByRole('log').locator('..').boundingBox()).height >= 80);
    await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
    // Restore the user's prior preference before checking viewport clamping.
    for (let i = 0; i < 8; i++) await handle.press('Shift+ArrowLeft');
    for (let i = 0; i < 10; i++) await handle.press('Shift+ArrowUp');
    await handle.press('ArrowUp');
    await page.setViewportSize({ width: 800, height: 480 }); await fits(page, chat);
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal((await chat.boundingBox()).height, 740);
    await chat.getByRole('button', { name: 'Opções do chat', exact: true }).click();
    await chat.getByRole('button', { name: 'Restaurar tamanho padrão', exact: true }).click();
    assert.equal((await chat.boundingBox()).width, 480); await fits(page, chat);
  });
  for (const width of [320, 390, 768]) await scenario(`Toque ${width}px, rotação e espaço reduzido pelo teclado`, { width, height: 844 }, async ({ page, chat }) => {
    await fits(page, chat);
    await page.screenshot({ path: join(artifacts, `touch-${width}-initial.png`) });
    await chat.getByRole('button', { name: 'Ampliar chat', exact: true }).click(); await fits(page, chat);
    await page.setViewportSize({ width: 844, height: width }); await fits(page, chat);
    await page.setViewportSize({ width, height: 320 });
    await page.waitForFunction(() => document.querySelector('.tortuguita-panel')?.dataset.compact === 'true');
    await fits(page, chat);
    const input = chat.getByRole('textbox', { name: 'Sua dúvida ou busca', exact: true });
    await input.fill('Os cursos são gratuitos?'); await input.press('Enter');
    await chat.getByRole('log').getByText(/Os cursos e o cadastro são apresentados como gratuitos/).waitFor();
    await chat.getByRole('button', { name: 'Restaurar tamanho do chat', exact: true }).click(); await fits(page, chat);
    await chat.getByRole('button', { name: 'Fechar assistente virtual', exact: true }).click();
    assert(await page.getByRole('button', { name: 'Abrir assistente virtual', exact: true }).evaluate(el => el === document.activeElement));
  }, true);
  await scenario('Arraste por toque no tablet respeita os limites da tela', { width: 1024, height: 900 }, async ({ page, chat }) => {
    const session = await page.context().newCDPSession(page);
    async function drag(dx, dy) {
      const bounds = await chat.getByRole('button', { name: 'Redimensionar janela do chat', exact: true }).boundingBox();
      const x = bounds.x + 14, y = bounds.y + 14;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.max(0, x + dx), y: Math.max(0, y + dy) }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await drag(-80, -40);
    assert.equal((await chat.boundingBox()).width, 560); assert.equal((await chat.boundingBox()).height, 720);
    await drag(-2000, -2000); await fits(page, chat);
    assert.equal((await chat.boundingBox()).width, 992); assert.equal((await chat.boundingBox()).height, 868);
    await session.detach();
  }, true);
  await scenario('Preferência corrompida e armazenamento bloqueado não impedem o chat', { width: 1280, height: 900 }, async ({ page, chat }) => {
    assert.equal((await chat.boundingBox()).width, 480);
    const handle = chat.getByRole('button', { name: 'Redimensionar janela do chat', exact: true });
    await handle.focus(); await handle.press('ArrowLeft'); assert.equal((await chat.boundingBox()).width, 500);
    await fits(page, chat);
  }, false, () => {
    localStorage.setItem('qualificavix-chat-window-v1', '{invalid');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'qualificavix-chat-window-v1') throw new Error('Blocked'); return original.call(this, key, value); };
  });
} finally { await browser.close(); await environment.cleanup(); }
await writeFile(join(artifacts, 'results.json'), JSON.stringify({ checks, limitation: 'Chromium com emulação de toque; sem aparelhos físicos ou Safari.' }, null, 2));
console.log(`RESULT ${checks.filter(check => check.status === 'passed').length}/${checks.length}`);
if (checks.some(check => check.status === 'failed')) process.exitCode = 1;
