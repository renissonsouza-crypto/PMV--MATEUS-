import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

// No credentials, live application data or external services are needed.
// Chromium device emulation does not replace Safari or physical-device testing.
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(join(root, 'presentation.html'), 'utf8');
const resultsDirectory = process.env.PRESENTATION_TEST_ARTIFACTS || join(root, '..', 'artifacts', 'apresentacao-qualifica-vix');
const report = {
  date: new Date().toISOString(),
  artifact: 'presentation.html',
  browser: 'Chromium',
  checks: [],
  externalRequests: [],
  limitations: [
    'The managed cloud Chromium blocks native file:// navigation. Offline independence is checked with setContent in an offline context, in addition to a local HTTP page.',
    'Desktop, phone and landscape checks use Chromium emulation; physical Android and Safari/iOS are not covered.',
    'PDF export and visual review are performed separately; this suite verifies the print layout without exporting a PDF.',
  ],
};
const server = createServer((request, response) => {
  if (request.url?.split('?')[0] !== '/presentation.html') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
report.browserVersion = browser.version();

async function check(name, run) {
  const started = Date.now();
  try {
    const evidence = await run();
    report.checks.push({ name, status: 'passed', durationMs: Date.now() - started, ...evidence });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.stack });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function withPage(run, options = {}) {
  const { offlineContent = false, blockedStorage = false, mockClock = false, ...contextOptions } = options;
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce', ...contextOptions });
  const errors = [], external = [];
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  });
  await context.route(/^https?:/, route => {
    const url = route.request().url();
    if (!offlineContent && url.startsWith(`${origin}/`)) return route.continue();
    external.push(url);
    report.externalRequests.push(url);
    return route.abort('blockedbyclient');
  });
  if (blockedStorage) await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage blocked for test', 'SecurityError'); } });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  if (mockClock) await page.clock.install();
  try {
    if (offlineContent) {
      await context.setOffline(true);
      await page.setContent(html, { waitUntil: 'load' });
    } else await page.goto(`${origin}/presentation.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#notes-text')?.textContent.trim().length > 0);
    await page.evaluate(() => document.fonts.ready);
    const evidence = await run(page, context);
    assert.deepEqual(errors, [], 'The presentation or presenter popup emitted browser errors');
    assert.deepEqual(external, [], 'Opening and using the deck must not request external resources');
    return evidence;
  } finally { await context.close(); }
}
const activeId = page => page.locator('.slide.active').getAttribute('id');
const expectSlide = async (page, id) => {
  await page.waitForFunction(expected => document.querySelector('.slide.active')?.id === expected, `slide-${id}`);
  const state = await page.evaluate(() => [...document.querySelectorAll('.slide')].map(slide => ({ active: slide.classList.contains('active'), hidden: slide.getAttribute('aria-hidden'), inert: slide.inert })));
  assert.equal(state.filter(slide => slide.active).length, 1, 'Exactly one slide is active');
  for (const slide of state) {
    assert.equal(slide.inert, !slide.active, 'Inactive slides must be inert');
    assert.equal(slide.hidden, slide.active ? null : 'true', 'Inactive slides must be hidden from assistive technology');
  }
};
const goTo = async (page, id) => { await page.evaluate(id => { location.hash = `slide-${id}`; }, id); await expectSlide(page, id); };
const withinViewport = async (page, selector) => {
  const boxes = await page.locator(selector).evaluateAll(elements => elements.filter(el => getComputedStyle(el).display !== 'none').map(el => {
    const r = el.getBoundingClientRect(); return { label: el.getAttribute('aria-label') || el.id, x: r.x, y: r.y, width: r.width, height: r.height };
  }));
  const { width, height } = page.viewportSize();
  for (const box of boxes) {
    assert(box.width > 0 && box.height > 0, `${box.label} has no visible area`);
    assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${box.label} extends beyond the viewport: ${JSON.stringify(box)}`);
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
  return boxes.length;
};

try {
  await check('Standalone resources, 34 accessible slides and image loading', () => withPage(async page => {
    const inventory = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('#presentation-data').textContent);
      return { count: document.querySelectorAll('.slide').length, main: data.slides.filter(s => !s.appendix).length, appendix: data.slides.filter(s => s.appendix).length,
        notes: data.slides.every(s => s.speakerNotes.length > 150 && s.takeaway && s.sourcePages.length),
        images: [...document.images].map(image => ({ loaded: image.complete && image.naturalWidth > 0, source: image.currentSrc.slice(0, 40) })),
        fontStatus: document.fonts.status };
    });
    assert.equal(inventory.count, 34); assert.equal(inventory.main, 30); assert.equal(inventory.appendix, 4);
    assert(inventory.notes, 'All slides have meaningful speaker notes, takeaways and manual references');
    assert(inventory.images.length >= 15); assert(inventory.images.every(image => image.loaded), 'Every embedded image loads');
    assert.equal(inventory.fontStatus, 'loaded');
    await expectSlide(page, '01');
    for (const id of ['02', '12', '29', 'A4']) { await goTo(page, id); }
    return { slides: inventory.count, mainSlides: inventory.main, appendixSlides: inventory.appendix, embeddedImages: inventory.images.length };
  }));

  await check('Keyboard navigation, boundaries and home/end', () => withPage(async page => {
    await page.locator('#stage').focus();
    await page.keyboard.press('ArrowLeft'); await expectSlide(page, '01');
    await page.keyboard.press('ArrowRight'); await expectSlide(page, '02');
    await page.keyboard.press('PageDown'); await expectSlide(page, '03');
    await page.keyboard.press('PageUp'); await expectSlide(page, '02');
    await page.keyboard.press('Space'); await expectSlide(page, '03');
    await page.keyboard.press('Shift+Space'); await expectSlide(page, '02');
    await page.keyboard.press('Home'); await expectSlide(page, '01');
    assert(await page.locator('#previous-button').isDisabled());
    await page.keyboard.press('End'); await expectSlide(page, 'A4');
    assert(await page.locator('#next-button').isDisabled());
    await page.keyboard.press('ArrowRight'); await expectSlide(page, 'A4');
    assert.equal(await page.locator('#current-number').textContent(), '34');
    assert.equal(await page.locator('#progress-bar').evaluate(el => el.style.width), '100%');
  }));

  await check('Searchable index, accent normalization, filters and selection', () => withPage(async page => {
    await page.keyboard.press('i'); await page.locator('#index-dialog').waitFor({ state: 'visible' });
    const visible = page.locator('#slide-index [data-goto]:visible');
    assert.equal(await visible.count(), 34);
    await page.locator('#index-filter').fill('inscrições'); const accented = await visible.count(); assert(accented > 0);
    await page.locator('#index-filter').fill('inscricoes'); assert.equal(await visible.count(), accented, 'Search matches text with or without accents');
    await page.locator('#index-filter').fill('zzzz-sem-assunto'); assert.equal(await visible.count(), 0); assert(await page.locator('#index-empty').isVisible());
    await page.locator('#index-filter').fill('');
    await page.locator('[data-filter="appendix"]').click(); assert.equal(await visible.count(), 4);
    assert.equal(await page.locator('[data-filter="appendix"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-filter="main"]').click(); assert.equal(await visible.count(), 30);
    await page.locator('[data-filter="all"]').click(); assert.equal(await visible.count(), 34);
    await page.locator('#slide-index [data-goto="18"]').click(); await expectSlide(page, '19'); assert(!(await page.locator('#index-dialog').isVisible()));
    await page.keyboard.press('i'); await page.locator('#index-filter').fill('Google'); await page.locator('#index-filter').press('ArrowRight'); await expectSlide(page, '19');
    await page.keyboard.press('Escape'); assert(!(await page.locator('#index-dialog').isVisible()));
    return { accentInsensitiveResults: accented };
  }));

  await check('Speaker notes, live updates, dialogs and focus restoration', () => withPage(async page => {
    const trigger = page.locator('.toolbar [data-action="notes"]'); await trigger.click();
    assert(await page.locator('#notes-dialog').isVisible()); const before = await page.locator('#notes-text').textContent(); assert(before.length > 150);
    await page.locator('#notes-dialog [data-action="next"]').click(); await expectSlide(page, '02');
    assert.notEqual(await page.locator('#notes-text').textContent(), before);
    assert.match(await page.locator('#notes-meta').textContent(), /Slide 2 \/ 34/);
    await page.locator('#notes-dialog [data-close]').click(); assert(await trigger.evaluate(el => el === document.activeElement));
    await page.locator('#stage').focus(); await page.keyboard.press('n'); assert(await page.locator('#notes-dialog').isVisible());
    await page.keyboard.press('Escape'); assert(!(await page.locator('#notes-dialog').isVisible()));
    await page.keyboard.press('h'); assert(await page.locator('#help-dialog').isVisible());
    assert.match(await page.locator('#help-dialog').textContent(), /offline/); await page.keyboard.press('Escape');
    await page.keyboard.press('?'); assert(await page.locator('#help-dialog').isVisible()); await page.keyboard.press('Escape');
  }));

  await check('Motion preference, projection blackout and laser controls', () => withPage(async page => {
    await page.locator('#stage').focus(); await page.keyboard.press('m');
    assert(await page.locator('body').evaluate(el => el.classList.contains('motion-paused')));
    assert.equal(await page.locator('[data-action="motion"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('m'); assert(!(await page.locator('body').evaluate(el => el.classList.contains('motion-paused'))));
    await page.keyboard.press('b'); assert(await page.locator('#blackout').isVisible()); assert(await page.locator('#stage').evaluate(el => el.inert));
    await page.keyboard.press('Escape'); assert(!(await page.locator('#blackout').isVisible())); assert(!(await page.locator('#stage').evaluate(el => el.inert)));
    await page.keyboard.press('l'); await page.locator('#stage').hover(); assert(await page.locator('#laser').isVisible());
    await page.keyboard.press('Escape'); assert(!(await page.locator('#laser').isVisible()));
  }));

  await check('Practice timer starts, pauses, resets and pauses when leaving', () => withPage(async page => {
    await goTo(page, '29');
    assert.equal(await page.locator('#practice-clock').textContent(), '01:00');
    await page.locator('#practice-toggle').click(); await page.clock.fastForward(3200);
    assert.match(await page.locator('#practice-clock').textContent(), /^00:5[67]$/);
    await page.locator('#practice-toggle').click(); const paused = await page.locator('#practice-clock').textContent();
    await page.clock.fastForward(4000); assert.equal(await page.locator('#practice-clock').textContent(), paused);
    await page.locator('#practice-reset').click(); assert.equal(await page.locator('#practice-clock').textContent(), '01:00');
    await page.locator('#practice-toggle').click(); await page.clock.fastForward(2000); await goTo(page, '30');
    const leftAt = await page.locator('#practice-clock').textContent(); await page.clock.fastForward(5000); assert.equal(await page.locator('#practice-clock').textContent(), leftAt);
    await goTo(page, '29'); await page.locator('#practice-reset').click(); await page.locator('#practice-toggle').click(); await page.clock.fastForward(61000);
    assert.equal(await page.locator('#practice-clock').textContent(), '00:00'); assert.match(await page.locator('#timer-status').textContent(), /terminou/);
  }, { mockClock: true }));

  await check('Separate presenter panel synchronizes notes and navigation', () => withPage(async (page, context) => {
    await page.locator('#stage').focus(); const pending = context.waitForEvent('page'); await page.keyboard.press('p'); const presenter = await pending;
    await presenter.locator('#presenter-notes').waitFor();
    assert.equal(await presenter.locator('#presenter-count').textContent(), '1 / 34 · Abertura');
    assert.equal(await presenter.locator('#presenter-notes').textContent(), await page.locator('#notes-text').textContent());
    await presenter.locator('[data-presenter="next"]').click(); await expectSlide(page, '02');
    assert.equal(await presenter.locator('#presenter-title').textContent(), await page.locator('#notes-title').textContent());
    await presenter.keyboard.press('ArrowRight'); await expectSlide(page, '03');
    await page.keyboard.press('ArrowRight'); await expectSlide(page, '04');
    assert.match(await presenter.locator('#presenter-count').textContent(), /^4 \/ 34/);
    await presenter.close(); await page.keyboard.press('ArrowRight'); await expectSlide(page, '05');
  }));

  await check('Appendix deep link restores the expected slide on reload', () => withPage(async page => {
    await page.goto(`${origin}/presentation.html#slide-A2`); await expectSlide(page, 'A2');
    assert.equal(await page.locator('#current-number').textContent(), '32');
    assert.match(await page.locator('#chapter-label').textContent(), /Consulta/);
    await page.reload(); await expectSlide(page, 'A2');
  }));

  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await check(`Controls and all slides fit ${viewport.width}×${viewport.height}`, () => withPage(async page => {
      const controls = await withinViewport(page, '.app-header button,.toolbar button');
      const ids = await page.locator('.slide').evaluateAll(slides => slides.map(slide => slide.id.replace('slide-', '')));
      for (const id of ids) {
        await goTo(page, id); await withinViewport(page, '.slide.active');
        assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'Presentation must not add vertical page scrolling');
      }
      await page.locator('.toolbar [data-action="index"]').first().click(); await withinViewport(page, '#index-dialog'); await page.keyboard.press('Escape');
      return { viewport, slidesChecked: ids.length, visibleControls: controls };
    }, { viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 1000 }));
  }

  await check('Touch swipe advances and reverses without intercepting vertical movement', () => withPage(async page => {
    const swipe = async (dx, dy) => {
      const box = await page.locator('#stage').boundingBox(); const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.locator('#stage').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: x, clientY: y });
      await page.locator('#stage').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1, clientX: x + dx, clientY: y + dy });
    };
    await swipe(-100, 10); await expectSlide(page, '02'); await swipe(100, 5); await expectSlide(page, '01');
    await swipe(-10, 100); await expectSlide(page, '01'); await swipe(-20, 0); await expectSlide(page, '01');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }));

  await check('Reduced motion suppresses continuous animation and transitions', () => withPage(async page => {
    assert(await page.locator('body').evaluate(el => el.classList.contains('reduced-motion')));
    await goTo(page, '24');
    const styles = await page.locator('.mascot').evaluate(el => ({ animation: getComputedStyle(el).animationName, transition: getComputedStyle(el).transitionDuration }));
    assert.equal(styles.animation, 'none'); assert.equal(styles.transition, '0s');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !document.body.classList.contains('reduced-motion'));
    assert.notEqual(await page.locator('.mascot').evaluate(el => getComputedStyle(el).animationName), 'none');
  }));

  await check('Offline standalone HTML runs without any network connection', () => withPage(async page => {
    assert.equal(await page.locator('.slide').count(), 34); await page.keyboard.press('ArrowRight'); await expectSlide(page, '02');
    await page.keyboard.press('i'); assert(await page.locator('#index-dialog').isVisible()); await page.keyboard.press('Escape');
    await goTo(page, '24'); assert(await page.locator('.mascot').count());
    assert(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)));
    return { network: 'offline', loadMethod: 'setContent', imageCount: await page.locator('img').count() };
  }, { offlineContent: true }));

  await check('Blocked browser storage does not prevent navigation or motion controls', () => withPage(async page => {
    await page.keyboard.press('m'); assert.equal(await page.locator('[data-action="motion"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('ArrowRight'); await expectSlide(page, '02');
    await page.keyboard.press('m'); assert.equal(await page.locator('[data-action="motion"]').getAttribute('aria-pressed'), 'false');
  }, { blockedStorage: true }));

  await check('Print media exposes all 34 slides as consecutive 16:9 pages', () => withPage(async page => {
    await page.emulateMedia({ media: 'print' });
    const layout = await page.locator('.slide').evaluateAll(slides => slides.map(slide => {
      const r = slide.getBoundingClientRect(), style = getComputedStyle(slide);
      return { y: r.y, width: r.width, height: r.height, visibility: style.visibility, opacity: style.opacity, breakAfter: style.breakAfter };
    }));
    assert.equal(layout.length, 34);
    for (let i = 0; i < layout.length; i++) {
      const slide = layout[i]; assert.equal(slide.width, 1600); assert.equal(slide.height, 900); assert.equal(slide.visibility, 'visible'); assert.equal(slide.opacity, '1');
      if (i > 0) assert.equal(slide.y - layout[i - 1].y, 900, 'Slides are consecutive without gaps');
    }
    assert(!(await page.locator('.toolbar').isVisible())); return { pages: layout.length, pageSizeCssPixels: [1600, 900] };
  }));
} finally {
  report.passed = report.checks.filter(check => check.status === 'passed').length;
  report.failed = report.checks.filter(check => check.status === 'failed').length;
  await mkdir(resultsDirectory, { recursive: true });
  await writeFile(join(resultsDirectory, 'test-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(`${report.passed} passed; ${report.failed} failed. Evidence: ${join(resultsDirectory, 'test-results.json')}`);
if (report.failed) process.exitCode = 1;
