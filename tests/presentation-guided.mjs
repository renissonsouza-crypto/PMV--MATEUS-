import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

// Functional checks for the guided edition. These use the browser's actual
// layout and animation timelines, without needing accounts or external APIs.
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(join(root, 'presentation.html'), 'utf8');
const artifacts = process.env.PRESENTATION_TEST_ARTIFACTS || join(root, '..', 'artifacts', 'apresentacao-qualifica-vix');
await mkdir(artifacts, { recursive: true });
const report = { date: new Date().toISOString(), artifact: 'presentation.html', checks: [], limitations: [
  'Chromium rendering at desktop sizes does not substitute for physical-device or Safari testing.',
  'Print media checks verify visible final states; the PDF export is validated separately.',
] };
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
  try { const evidence = await run(); report.checks.push({ name, status: 'passed', durationMs: Date.now() - started, ...evidence }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function withPage(run, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'no-preference', ...options });
  const errors = [], external = [];
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await context.route(/^https?:/, route => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`)) return route.continue();
    external.push(url); return route.abort();
  });
  try {
    await page.goto(`${origin}/presentation.html`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelector('#notes-text')?.textContent.trim().length > 0);
    const evidence = await run(page);
    assert.deepEqual(errors, [], 'Browser scripts must not throw');
    assert.deepEqual(external, [], 'The guided edition must remain self-contained');
    return evidence;
  } finally { await context.close(); }
}
async function goTo(page, id) {
  await page.evaluate(id => { location.hash = `slide-${id}`; }, id);
  await page.waitForFunction(id => document.querySelector('.slide.active')?.id === `slide-${id}`, id);
}
const sceneAnimations = page => page.evaluate(() => document.querySelector('.slide.active').getAnimations({ subtree: true })
  .filter(animation => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition))
  .map(animation => ({ selector: animation.effect.target.className?.baseVal ?? animation.effect.target.className, playState: animation.playState,
    currentTime: animation.currentTime, duration: animation.effect.getTiming().duration, delay: animation.effect.getTiming().delay,
    properties: [...new Set(animation.effect.getKeyframes().flatMap(frame => Object.keys(frame)))].filter(key => !['computedOffset', 'offset', 'easing', 'composite'].includes(key)) })));

try {
  await check('Every slide has a readable, distinct mascot guide; its introduction remains', () => withPage(async page => {
    const guides = await page.locator('.slide').evaluateAll(slides => slides.map(slide => ({
      id: slide.id, guideCount: slide.querySelectorAll(':scope > .slide-guide').length,
      turtleCount: slide.querySelectorAll('.slide-guide svg.guide-turtle').length,
      text: slide.querySelector('.guide-speech > p')?.textContent.trim() ?? '',
      replayLabel: slide.querySelector('.guide-replay')?.getAttribute('aria-label'),
    })));
    assert.equal(guides.length, 34);
    assert.equal(new Set(guides.map(guide => guide.text)).size, 34, 'Guide speeches should be specific to each slide');
    for (const guide of guides) {
      assert.equal(guide.guideCount, 1, `${guide.id}: one guide lane`);
      assert.equal(guide.turtleCount, 1, `${guide.id}: vector mascot present`);
      const words = guide.text.split(/\s+/).length;
      assert(words >= 12 && words <= 45, `${guide.id}: guide speech is concise (${words} words)`);
      assert(guide.text.length <= 290, `${guide.id}: guide speech must fit its reserved space`);
      assert.match(guide.replayLabel, /animações/i);
    }
    await goTo(page, '24');
    assert(await page.locator('.slide.active .assistant-layout').isVisible(), 'Keep the dedicated assistant introduction');
    assert(await page.locator('.slide.active .mascot').isVisible(), 'Keep the original large mascot illustration');
    assert.match(await page.locator('.slide.active h2').textContent(), /Tortuguita/i);
    return { slidesWithGuide: guides.length, maximumGuideWords: Math.max(...guides.map(guide => guide.text.split(/\s+/).length)) };
  }, { reducedMotion: 'reduce' }));

  await check('Orange, blue and white are applied to rendered guide and presentation controls', () => withPage(async page => {
    await goTo(page, '04');
    const colors = await page.evaluate(() => Object.fromEntries([
      ['pageBlue', 'body', 'backgroundColor'], ['guideOrange', '.slide.active .slide-guide', 'backgroundColor'],
      ['speechWhite', '.slide.active .guide-speech', 'backgroundColor'], ['nameBlue', '.slide.active .guide-byline > b', 'color'],
      ['slideWhite', '.slide.active', 'backgroundColor'], ['progressOrange', '#progress-bar', 'backgroundColor'],
    ].map(([name, selector, property]) => [name, getComputedStyle(document.querySelector(selector))[property]])));
    assert.equal(colors.pageBlue, 'rgb(0, 87, 217)'); assert.equal(colors.guideOrange, 'rgb(255, 133, 0)');
    assert.equal(colors.speechWhite, 'rgb(255, 255, 255)'); assert.equal(colors.slideWhite, 'rgb(255, 255, 255)');
    assert.equal(colors.nameBlue, 'rgb(0, 87, 217)'); assert.equal(colors.progressOrange, 'rgb(255, 133, 0)');
    return { computedColors: colors };
  }, { reducedMotion: 'reduce' }));

  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await check(`Guide lane preserves content and images at ${viewport.width}×${viewport.height}`, () => withPage(async page => {
      const ids = await page.locator('.slide').evaluateAll(slides => slides.map(slide => slide.id.replace('slide-', '')));
      const collisions = [], clipped = [];
      for (const id of ids) {
        await goTo(page, id);
        const evidence = await page.locator('.slide.active').evaluate(slide => {
          const guide = slide.querySelector('.slide-guide'), speech = slide.querySelector('.guide-speech'), rect = guide.getBoundingClientRect();
          const slideRect = slide.getBoundingClientRect(), paragraph = speech.querySelector('p').getBoundingClientRect(), speechRect = speech.getBoundingClientRect();
          const selectors = '.slide-heading,.bottom-line,.browser,.phone,.photo-card,.steps,.reference-grid,.document-cards,.support-grid,.assistant-layout,.practice-timer,.catalog-table,.document-reference,.profile-showcase,.storage-grid,.validation-flow,.validation-grid,.contact-ribbon,.numbered-list';
          return { guide: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
            clipped: paragraph.bottom > speechRect.bottom - 2 || speech.scrollHeight > speech.clientHeight + 1 || rect.right > slideRect.right || rect.bottom > slideRect.bottom,
            content: [...slide.querySelectorAll(selectors)].map(element => {
              const r = element.getBoundingClientRect();
              return { selector: element.className, top: r.top, bottom: r.bottom, left: r.left, right: r.right, visible: r.width > 0 && r.height > 0 };
            }) };
        });
        if (evidence.clipped) clipped.push(id);
        for (const content of evidence.content) {
          if (content.visible && content.right > evidence.guide.left + 1 && content.left < evidence.guide.right - 1 && content.bottom > evidence.guide.top + 1 && content.top < evidence.guide.bottom - 1)
            collisions.push({ slide: id, element: content.selector, overlapPixels: Math.round(content.bottom - evidence.guide.top) });
        }
      }
      assert.deepEqual(clipped, [], 'All guide speech and lanes fit');
      assert.deepEqual(collisions, [], 'Guide must not cover main content, course screenshots or bottom-line text');
      return { viewport, slidesChecked: ids.length, clippedGuides: clipped, collisions };
    }, { viewport, reducedMotion: 'reduce' }));
  }

  await check('Menu, search, form, success, enrollment and chat scenes produce visible animation', () => withPage(async page => {
    const targets = { '04': '.navigation-list .text-point', '06': '.search-sample', '12': '.step-progress span',
      '18': '.success-seal', '19': '.numbered-list > div', '24': '.chat-bubble' };
    const scenes = [];
    for (const [id, selector] of Object.entries(targets)) {
      await goTo(page, id);
      const animations = await sceneAnimations(page);
      assert(animations.length > 0, `Slide ${id} should have a teaching scene in addition to CSS entrance effects`);
      const active = await page.locator(`.slide.active ${selector}`).first().evaluate(element => element.getAnimations().filter(animation => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition))
        .map(animation => ({ playState: animation.playState, frames: animation.effect.getKeyframes(), timing: animation.effect.getComputedTiming() })));
      assert(active.some(animation => animation.playState === 'running' && animation.frames.length >= 2), `Slide ${id}: the illustrated teaching target must animate`);
      const target = page.locator(`.slide.active ${selector}`).first();
      const differences = await target.evaluate(element => {
        const animation = element.getAnimations().find(animation => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition));
        animation.pause();
        const timing = animation.effect.getTiming();
        const sample = offset => {
          animation.currentTime = timing.delay + timing.duration * offset;
          const style = getComputedStyle(element);
          return ['opacity', 'boxShadow', 'scale', 'translate', 'rotate', 'clipPath', 'transform'].map(property => style[property]);
        };
        const start = sample(.02), middle = sample(.47), end = sample(.98);
        animation.play();
        return { start, middle, end };
      });
      assert(JSON.stringify(differences.start) !== JSON.stringify(differences.middle) || JSON.stringify(differences.middle) !== JSON.stringify(differences.end),
        `Slide ${id}: animation must change the target's rendered appearance`);
      scenes.push({ slide: id, target: selector, waapiCount: animations.length });
    }
    return { scenes };
  }));

  await check('M pauses and resumes CSS and scene animation timelines together', () => withPage(async page => {
    await goTo(page, '24'); await page.locator('#stage').focus();
    await page.evaluate(() => { window.__motionProbe = document.querySelector('.slide.active').getAnimations({ subtree: true }).filter(animation => animation.playState === 'running'); });
    const kinds = await page.evaluate(() => ({ css: window.__motionProbe.some(animation => animation instanceof CSSAnimation), scene: window.__motionProbe.some(animation => !(animation instanceof CSSAnimation)) }));
    assert(kinds.css && kinds.scene, 'Sample contains both kinds of live effects');
    await page.keyboard.press('m');
    await page.waitForFunction(() => window.__motionProbe.every(animation => ['paused', 'finished', 'idle'].includes(animation.playState)));
    const first = await page.evaluate(() => window.__motionProbe.map(animation => animation.currentTime));
    await page.waitForTimeout(180);
    const second = await page.evaluate(() => window.__motionProbe.map(animation => animation.currentTime));
    first.forEach((time, index) => assert(Math.abs((time ?? 0) - (second[index] ?? 0)) < 1, `Paused timeline ${index} must remain still`));
    assert.equal(await page.locator('[data-action="motion"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('m'); await page.waitForTimeout(180);
    const resumed = await page.evaluate(() => window.__motionProbe.map(animation => animation.currentTime));
    assert(resumed.some((time, index) => (time ?? 0) - (second[index] ?? 0) > 50), 'Resuming advances the same timelines');
    assert.equal(await page.locator('[data-action="motion"]').getAttribute('aria-pressed'), 'false');
    return { sampledCssAndSceneEffects: first.length };
  }));

  await check('R and the visible replay button restart the scene without changing the slide', () => withPage(async page => {
    await goTo(page, '18'); await page.locator('#stage').focus();
    const remember = async () => page.evaluate(() => { window.__previousScene = document.querySelector('.slide.active').getAnimations({ subtree: true }).filter(animation => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition)); });
    const verify = async () => {
      assert.equal(await page.locator('.slide.active').getAttribute('id'), 'slide-18');
      const state = await page.evaluate(() => ({ oldCancelled: window.__previousScene.every(animation => animation.playState === 'idle'),
        replaced: document.querySelector('.slide.active').getAnimations({ subtree: true }).filter(animation => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition)).every(animation => !window.__previousScene.includes(animation)),
        restarted: document.querySelector('.success-seal').getAnimations().filter(animation => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition)).some(animation => animation.currentTime < 350 && animation.playState === 'running'),
        guideRestarted: document.querySelector('.slide.active .guide-avatar').getAnimations().some(animation => animation instanceof CSSAnimation && animation.currentTime < 350 && animation.playState === 'running') }));
      assert(state.oldCancelled && state.replaced && state.restarted && state.guideRestarted, `Replay must restart both the teaching scene and mascot: ${JSON.stringify(state)}`);
      assert.match(await page.locator('#announcement').textContent(), /reiniciadas/);
    };
    await page.waitForTimeout(400); await remember(); await page.keyboard.press('r'); await verify();
    await page.waitForTimeout(400); await remember(); await page.locator('.slide.active .guide-replay').click(); await verify();
  }));

  await check('Leaving a slide cancels its teaching scene and removes its pointer', () => withPage(async page => {
    await goTo(page, '04');
    await page.evaluate(() => { window.__oldSlideAnimations = document.querySelector('.slide.active').getAnimations({ subtree: true }).filter(animation => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition)); });
    assert(await page.locator('#slide-04 .scene-pointer').count(), 'The navigation scene includes an explanatory pointer');
    await goTo(page, '06');
    assert(await page.evaluate(() => window.__oldSlideAnimations.length > 0 && window.__oldSlideAnimations.every(animation => animation.playState === 'idle')),
      'Old WAAPI effects must be canceled');
    assert.equal(await page.locator('#slide-04 .scene-pointer').count(), 0);
    assert.equal(await page.locator('.slide:not(.active) .scene-pointer').count(), 0);
    assert((await sceneAnimations(page)).length > 0, 'The new slide has its own scene');
  }));

  await check('Reduced motion leaves readable final scenes and disables replay effects', () => withPage(async page => {
    for (const id of ['04', '06', '12', '18', '19', '24']) {
      await goTo(page, id); await page.locator('#stage').focus(); await page.keyboard.press('r');
      const running = await page.locator('.slide.active').evaluate(slide => slide.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation.effect.getComputedTiming().activeDuration > 1).length);
      assert.equal(running, 0, `${id}: reduced motion has no effective animation`);
      assert.equal((await sceneAnimations(page)).length, 0, `${id}: no script effects created`);
      assert.equal(await page.locator('.slide.active .guide-speech').evaluate(element => getComputedStyle(element).opacity), '1');
    }
    assert.equal(await page.locator('.scene-pointer').count(), 0);
  }, { reducedMotion: 'reduce' }));

  await check('Printing an active animation exposes all guide and teaching content in final state', () => withPage(async page => {
    await goTo(page, '24'); await page.emulateMedia({ media: 'print' });
    // Media-query change handlers run on the rendering step after emulation.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const print = await page.locator('.slide').evaluateAll(slides => slides.map(slide => {
      const rect = slide.getBoundingClientRect(), guide = slide.querySelector('.slide-guide'), speech = slide.querySelector('.guide-speech'), avatar = slide.querySelector('.guide-avatar');
      return { id: slide.id, width: rect.width, height: rect.height, top: rect.top, visible: getComputedStyle(slide).visibility,
        guideVisible: getComputedStyle(guide).display !== 'none' && getComputedStyle(guide).visibility === 'visible' && guide.getBoundingClientRect().height > 0,
        speechVisible: getComputedStyle(speech).opacity === '1' && getComputedStyle(speech).visibility === 'visible',
        mascotVisible: getComputedStyle(avatar).opacity === '1' && getComputedStyle(avatar).visibility === 'visible',
        runningEffects: slide.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation.effect.getComputedTiming().activeDuration > 1).length };
    }));
    assert.equal(print.length, 34);
    for (const [index, slide] of print.entries()) {
      assert.equal(slide.width, 1600); assert.equal(slide.height, 900); assert.equal(slide.visible, 'visible');
      assert(slide.guideVisible && slide.speechVisible && slide.mascotVisible, `${slide.id}: guide visible in printed page`);
      assert.equal(slide.runningEffects, 0, `${slide.id}: printing must settle live animation`);
      if (index > 0) assert.equal(slide.top - print[index - 1].top, 900);
    }
    const content = await page.locator('#slide-24 .chat-bubble').evaluateAll(elements => elements.map(element => ({ opacity: getComputedStyle(element).opacity,
      scale: getComputedStyle(element).scale, translate: getComputedStyle(element).translate })));
    assert(content.length > 0);
    for (const item of content) { assert.equal(item.opacity, '1', 'Printed chat examples must not disappear during entrance effects'); assert(['none', '1'].includes(item.scale)); }
    return { pages: print.length, guidesVisible: print.filter(slide => slide.guideVisible && slide.speechVisible).length };
  }));
} finally {
  report.passed = report.checks.filter(check => check.status === 'passed').length;
  report.failed = report.checks.filter(check => check.status === 'failed').length;
  await writeFile(join(artifacts, 'guided-test-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(`${report.passed} passed; ${report.failed} failed. Evidence: ${join(artifacts, 'guided-test-results.json')}`);
if (report.failed) process.exitCode = 1;
