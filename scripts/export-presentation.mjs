import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'), process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe')].filter(Boolean);
const executablePath = candidates.find(p => existsSync(p));
if (!executablePath) throw new Error('Defina CHROMIUM_PATH com o caminho do Chrome, Chromium ou Edge instalado.');
const html = await readFile(path.join(root, 'presentation.html'));
const server = createServer((req, res) => {
  if (req.url !== '/') { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  const missing = await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.alt));
  if (errors.length || missing.length) throw new Error(JSON.stringify({ errors, missing }));
  await mkdir(path.join(root, 'docs'), { recursive: true });
  const target = path.join(root, 'docs/apresentacao-qualifica-vix.pdf');
  await page.pdf({ path: target, printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
  console.log(`PDF exportado: ${target}. A cópia em PDF é estática; as animações estão no HTML.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
