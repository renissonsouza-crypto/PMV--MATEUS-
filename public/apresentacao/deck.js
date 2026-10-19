(() => {
  'use strict';
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const data = JSON.parse($('#presentation-data').textContent);
  const slides = $$('.slide');
  const stage = $('#stage');
  const dialogIds = ['index-dialog', 'notes-dialog', 'help-dialog'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, touchStart = null, indexFilter = 'all', presenter = null, lastTrigger = null;
  let effectsPaused = false, laserEnabled = false, practiceSeconds = 60, practiceRunning = false;
  let practiceDeadline = 0;
  const started = Date.now();
  const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  let sceneAnimations = [];
  function cancelScene() {
    sceneAnimations.forEach(animation => animation.cancel());
    sceneAnimations = [];
    $$('.scene-pointer').forEach(pointer => pointer.remove());
  }
  function animateScene(element, frames, options = {}) {
    if (!element || reduced.matches || effectsPaused) return;
    const animation = element.animate(frames, { duration: 1000, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'none', ...options });
    sceneAnimations.push(animation);
    return animation;
  }
  function highlight(element, delay = 1400, color = '#ff8500') {
    animateScene(element, [
      { boxShadow: `0 0 0 0 ${color}00`, offset: 0 },
      { boxShadow: `0 0 0 7px ${color}99, 0 8px 30px ${color}30`, offset: .45 },
      { boxShadow: `0 0 0 0 ${color}00`, offset: 1 },
    ], { duration: 1450, delay });
  }
  function sequence(root, selector, delay = 1400, interval = 1050) {
    $$(selector, root).forEach((element, index) => highlight(element, delay + index * interval));
  }
  function guidePointer(root, targets) {
    if (reduced.matches || effectsPaused || !targets.length) return;
    const pointer = document.createElement('div');
    pointer.className = 'scene-pointer'; pointer.setAttribute('aria-hidden', 'true'); root.append(pointer);
    const slideRect = root.getBoundingClientRect(), scale = slideRect.width / 1600;
    const frames = [{ opacity: 0, transform: 'translate(0,0) scale(.3)', offset: 0 }];
    targets.slice(0, 4).forEach((target, index, all) => {
      const rect = target.getBoundingClientRect();
      const x = Math.min(1490, Math.max(60, (rect.right - slideRect.left) / scale - 34));
      const y = Math.min(655, Math.max(190, (rect.top - slideRect.top) / scale + rect.height / scale * .5 - 27));
      const at = .08 + index * (.75 / all.length);
      frames.push({ opacity: .9, transform: `translate(${x}px,${y}px) scale(1)`, offset: at });
      frames.push({ opacity: .65, transform: `translate(${x}px,${y}px) scale(1.3)`, offset: at + .10 });
    });
    frames.push({ opacity: 0, offset: 1 });
    animateScene(pointer, frames, { duration: 6200, delay: 1100 });
  }
  function playScene(index) {
    cancelScene();
    if (reduced.matches || effectsPaused) return;
    const root = slides[index];
    // The drawings highlight explanatory content; screenshots remain static.
    $$('.text-point', root).forEach((element, n) => animateScene(element,
      [{ opacity: .2, translate: '-22px 0' }, { opacity: 1, translate: '0 0' }],
      { duration: 900, delay: 650 + n * 200, fill: 'backwards' }));
    $$('.photo-card', root).forEach((element, n) => animateScene(element,
      [{ opacity: .3, transform: 'perspective(1000px) rotateY(-10deg) translateY(30px)' }, { opacity: 1, transform: 'perspective(1000px) rotateY(0) translateY(0)' }],
      { duration: 1600, delay: 450 + n * 250, fill: 'backwards' }));
    let targets = [];
    switch (index) {
      case 0:
      case 29:
        animateScene($('.cover-photo,.closing-art', root), [{ scale: '1.06', translate: '20px 0' }, { scale: '1', translate: '0 0' }], { duration: 6500 });
        break;
      case 1:
      case 11:
        sequence(root, '.steps article', 1400, 1100);
        $$('.step-progress span', root).forEach((bar, n) => animateScene(bar, [{ scale: '0 1' }, { scale: '1 1' }], { duration: 900, delay: 1200 + n * 1050, fill: 'backwards' }));
        targets = $$('.steps article', root);
        break;
      case 3:
        sequence(root, '.navigation-list .text-point', 1500, 1150);
        targets = $$('.navigation-list .text-point', root);
        break;
      case 4:
        $$('.phone', root).forEach((phone, n) => animateScene(phone, [{ opacity: .15, translate: '0 50px' }, { opacity: 1, translate: '0 0' }], { duration: 1400, delay: 400 + n * 450, fill: 'backwards' }));
        sequence(root, '.mobile-copy .text-point', 2100, 1200);
        targets = $$('.mobile-copy .text-point', root);
        break;
      case 5:
        animateScene($('.search-sample', root), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 1700, delay: 900, easing: 'steps(5,end)', fill: 'backwards' });
        sequence(root, '.filter-tags .tag', 2700, 900);
        highlight($('.browser', root), 5200);
        targets = [$('.mock-search', root), ...$$('.filter-tags .tag', root).slice(0, 2)];
        break;
      case 6:
        animateScene($('.heart-disc', root), [{ scale: '1' }, { scale: '1.24', offset: .4 }, { scale: '.94', offset: .7 }, { scale: '1' }], { duration: 1900, delay: 1600 });
        sequence(root, '.float-label', 3500, 1200);
        break;
      case 8:
        sequence(root, '.six-tabs>div', 1300, 700);
        highlight($('.six-tabs>div:nth-child(2)', root), 5600);
        targets = [$('.six-tabs>div:nth-child(2)', root), $('.browser', root)];
        break;
      case 10:
        sequence(root, '.identity-outcomes article', 2300, 1800);
        animateScene($('.fork-line', root), [{ opacity: .1, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0)' }], { duration: 1900, delay: 900 });
        break;
      case 13:
        sequence(root, '.address-path>div', 1400, 1100);
        targets = $$('.address-path>div:not(.mini-alert)', root);
        break;
      case 15:
        sequence(root, '.consent', 1600, 1900);
        targets = $$('.consent', root);
        break;
      case 16:
        sequence(root, '.validation-grid article', 1200, 800);
        sequence(root, '.validation-flow>span,.validation-flow>b', 4100, 950);
        break;
      case 17:
        animateScene($('.success-seal', root), [{ scale: '.4', rotate: '-35deg', opacity: .1 }, { scale: '1.12', rotate: '5deg', opacity: 1, offset: .7 }, { scale: '1', rotate: '0deg', opacity: 1 }], { duration: 1500, delay: 900 });
        sequence(root, '.success-messages article', 2500, 1800);
        targets = $$('.success-messages article', root);
        break;
      case 18:
        sequence(root, '.numbered-list>div', 1400, 1450);
        targets = $$('.numbered-list>div', root);
        break;
      case 19:
        $$('.ticket', root).forEach((ticket, n) => animateScene(ticket, [{ opacity: .2, translate: '0 28px', rotate: '-7deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }], { duration: 1300, delay: 1200 + n * 900, fill: 'backwards' }));
        highlight($('.limit-detail .callout', root), 4500);
        break;
      case 20:
        animateScene($('.clock-orbit', root), [{ rotate: '-25deg' }, { rotate: '300deg' }], { duration: 6000 });
        animateScene($('.timeline-line', root), [{ scale: '0 1' }, { scale: '1 1' }], { duration: 3000, delay: 1300, fill: 'backwards' });
        sequence(root, '.clean-list li', 2300, 1100);
        break;
      case 21:
        sequence(root, '.profile-label', 1500, 1600);
        targets = $$('.profile-label', root);
        break;
      case 22:
        sequence(root, '.storage-grid article', 1700, 1900);
        animateScene($('.storage-link .icon', root), [{ translate: '-15px 0', opacity: .2 }, { translate: '15px 0', opacity: 1 }], { duration: 2600, delay: 1600, iterations: 2 });
        break;
      case 23:
        $$('.chat-bubble', root).forEach((bubble, n) => animateScene(bubble, [{ scale: '.45', opacity: 0, translate: '0 20px' }, { scale: '1.06', opacity: 1, translate: '0 -5px', offset: .7 }, { scale: '1', opacity: 1, translate: '0 0' }], { duration: 1400, delay: 1400 + n * 1800, fill: 'backwards' }));
        highlight($('.assistant-demo', root), 5300);
        break;
      case 24:
        sequence(root, '.memory-steps article', 1400, 1500);
        break;
      case 26:
        sequence(root, '.document-cards article', 1500, 1300);
        break;
      case 28:
        sequence(root, '.practice-path article', 1400, 1200);
        break;
      default:
        sequence(root, '.facts-grid .stat,.reference-grid article,.document-reference .text-point,.support-grid article', 1500, 750);
        if (root.dataset.guideTarget === 'form') targets = $$('.text-point', root).slice(0, 3);
        break;
    }
    guidePointer(root, targets.filter(Boolean));
  }

  const readSetting = () => { try { return localStorage.getItem('qualifica-vix-presentation-motion') === 'paused'; } catch { return false; } };
  effectsPaused = readSetting();
  const applyMotion = () => {
    document.body.classList.toggle('motion-paused', effectsPaused);
    document.body.classList.toggle('reduced-motion', reduced.matches);
    const button = $('[data-action="motion"]');
    button.setAttribute('aria-pressed', String(effectsPaused));
    button.title = effectsPaused ? 'Retomar animações (M)' : 'Pausar animações (M)';
    button.setAttribute('aria-label', button.title);
    sceneAnimations.forEach(animation => effectsPaused ? animation.pause() : animation.play());
  };
  reduced.addEventListener('change', () => { applyMotion(); if (reduced.matches) cancelScene(); else playScene(current); });
  applyMotion();
  function fit() {
    const style = getComputedStyle(stage);
    const availableWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = Math.max(.05, Math.min(availableWidth / 1600, availableHeight / 900));
    document.documentElement.style.setProperty('--scale', scale);
    document.documentElement.style.setProperty('--stage-width', `${1600 * scale}px`);
    document.documentElement.style.setProperty('--stage-height', `${900 * scale}px`);
  }
  new ResizeObserver(fit).observe(stage);
  window.addEventListener('resize', fit);
  window.addEventListener('fullscreenchange', fit);
  function updateNotes() {
    const slide = data.slides[current];
    $('#notes-title').textContent = slide.title;
    $('#notes-text').textContent = slide.speakerNotes;
    $('#notes-takeaway').textContent = slide.takeaway;
    const meta = $('#notes-meta');
    meta.replaceChildren();
    [`Slide ${current + 1} / ${slides.length}`, `${slide.durationSeconds} s de referência`, `Guia: p. ${slide.sourcePages.join(', ')}`].forEach(text => {
      const span = document.createElement('span'); span.textContent = text; meta.append(span);
    });
    $$('#notes-dialog [data-action="previous"]').forEach(b => b.disabled = current === 0);
    $$('#notes-dialog [data-action="next"]').forEach(b => b.disabled = current === slides.length - 1);
  }
  function updatePresenter() {
    if (!presenter || presenter.closed) { presenter = null; return; }
    try {
      const d = presenter.document, s = data.slides[current];
      d.querySelector('#presenter-title').textContent = s.title;
      d.querySelector('#presenter-count').textContent = `${current + 1} / ${slides.length} · ${s.chapter}`;
      d.querySelector('#presenter-notes').textContent = s.speakerNotes;
      d.querySelector('#presenter-takeaway').textContent = s.takeaway;
      d.querySelector('#presenter-next').textContent = data.slides[current + 1]?.title ?? 'Fim da apresentação';
      d.querySelector('#presenter-time').textContent = formatTime(Math.floor((Date.now() - started) / 1000));
      d.querySelector('[data-presenter="previous"]').disabled = current === 0;
      d.querySelector('[data-presenter="next"]').disabled = current === slides.length - 1;
    } catch { presenter = null; }
  }
  function goTo(index, { focus = false, hash = true } = {}) {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    const previous = current;
    slides.forEach((s, i) => {
      const active = i === next;
      s.classList.toggle('active', active);
      s.classList.toggle('leaving', i === previous && !active);
      s.inert = !active;
      if (active) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    current = next;
    if (practiceRunning && current !== 28) pausePractice();
    $('#current-number').textContent = String(current + 1).padStart(2, '0');
    $('#chapter-label').textContent = `${data.slides[current].appendix ? 'Consulta · ' : ''}${data.slides[current].chapter}`;
    $('#previous-button').disabled = current === 0;
    $('#next-button').disabled = current === slides.length - 1;
    $('#progress-bar').style.width = `${((current + 1) / slides.length) * 100}%`;
    $$('#slide-index [data-goto]').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.goto) === current)));
    $('#announcement').textContent = `Slide ${current + 1} de ${slides.length}. ${data.slides[current].title}`;
    document.title = `${current + 1}. ${data.slides[current].title} | Qualifica Vix`;
    if (hash) { try { history.replaceState(null, '', `#slide-${data.slides[current].id}`); } catch { location.hash = `slide-${data.slides[current].id}`; } }
    updateNotes(); updatePresenter(); playScene(current);
    if (focus) $('h1,h2', slides[current])?.focus({ preventScroll: true });
  }
  function closeDialogs() { dialogIds.forEach(id => { const d = document.getElementById(id); if (d.open) d.close(); }); }
  function showDialog(id) {
    closeDialogs();
    lastTrigger = document.activeElement;
    if (id === 'notes-dialog') updateNotes();
    const d = document.getElementById(id); d.showModal();
    if (id === 'index-dialog') { $('#index-filter').focus(); filterIndex(); }
  }
  dialogIds.forEach(id => {
    const dialog = document.getElementById(id);
    $('[data-close]', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      }
    });
    dialog.addEventListener('close', () => { if (lastTrigger?.isConnected && !lastTrigger.closest('[inert]')) lastTrigger.focus({ preventScroll: true }); });
  });
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function filterIndex() {
    const query = normalize($('#index-filter').value.trim()); let visible = 0;
    $$('#slide-index [data-goto]').forEach(button => {
      const s = data.slides[Number(button.dataset.goto)];
      const typeMatches = indexFilter === 'all' || (indexFilter === 'appendix' ? s.appendix : !s.appendix);
      const textMatches = normalize([s.title, s.chapter, s.kicker, s.subtitle, s.guideLine, ...s.bullets].join(' ')).includes(query);
      button.hidden = !typeMatches || !textMatches;
      if (!button.hidden) visible++;
    });
    $('#index-empty').hidden = visible > 0;
  }
  $('#index-filter').addEventListener('input', filterIndex);
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => {
    indexFilter = button.dataset.filter;
    $$('[data-filter]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    filterIndex();
  }));
  $$('[data-goto]').forEach(button => button.addEventListener('click', () => { closeDialogs(); goTo(Number(button.dataset.goto), { focus: true }); }));
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else $('#announcement').textContent = 'Seu navegador não oferece tela cheia por este botão. Use o recurso de tela cheia do navegador.';
    } catch { $('#announcement').textContent = 'A tela cheia foi bloqueada pelo navegador. Use o modo de tela cheia do próprio navegador.'; }
  }
  function blackout(force) {
    closeDialogs();
    const overlay = $('#blackout'); overlay.hidden = force ?? !overlay.hidden;
    if (!overlay.hidden) { stage.inert = true; $('.toolbar').inert = true; $('.app-header').inert = true; $('button', overlay).focus(); }
    else { stage.inert = false; $('.toolbar').inert = false; $('.app-header').inert = false; stage.focus({ preventScroll: true }); }
  }
  function openPresenter() {
    if (presenter && !presenter.closed) { presenter.focus(); return; }
    presenter = window.open('', 'qualifica-vix-apresentador', 'popup,width=1050,height=780');
    if (!presenter) { showDialog('notes-dialog'); $('#announcement').textContent = 'O navegador bloqueou o painel separado. As notas foram abertas nesta tela.'; return; }
    const d = presenter.document;
    d.open();
    d.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Apresentador · Qualifica Vix</title><link rel="icon" href="data:,"><style>*{box-sizing:border-box}body{margin:0;background:#f2f7ff;color:#102d50;font-family:system-ui,sans-serif;padding:34px;line-height:1.6}header{display:flex;justify-content:space-between;gap:20px;color:#0057d9;font-size:13px;font-weight:700}h1{font-size:34px;line-height:1.2;letter-spacing:-1px;margin:20px 0}#presenter-notes{font-size:22px;line-height:1.75}#presenter-takeaway{background:#fff0d9;border-left:5px solid #ff8500;padding:20px;font-size:19px;font-weight:700;margin:28px 0}.next{border-top:1px solid #cbdcf1;padding-top:20px;font-size:18px}.next small{font-size:11px;letter-spacing:2px;color:#537499;display:block;margin-bottom:7px}nav{display:flex;gap:14px;margin-top:25px}button{background:#0057d9;color:#fff;border:0;border-radius:10px;padding:15px 25px;cursor:pointer;font-size:16px}button:disabled{opacity:.35;cursor:default}button:focus-visible{outline:3px solid #ff8500;outline-offset:3px}.tip{font-size:13px;color:#627995;margin-top:25px}#presenter-time{font-variant-numeric:tabular-nums;color:#0a2f61}</style></head><body><header><span id="presenter-count"></span><span id="presenter-time"></span></header><h1 id="presenter-title"></h1><p id="presenter-notes"></p><div id="presenter-takeaway"></div><div class="next"><small>PRÓXIMO SLIDE</small><span id="presenter-next"></span></div><nav><button type="button" data-presenter="previous">← Anterior</button><button type="button" data-presenter="next">Próximo →</button></nav><p class="tip">Mova este painel para uma tela separada antes de compartilhar a apresentação com o público. As setas também controlam os slides.</p></body></html>`);
    d.close();
    d.querySelector('[data-presenter="previous"]').addEventListener('click', () => goTo(current - 1));
    d.querySelector('[data-presenter="next"]').addEventListener('click', () => goTo(current + 1));
    d.addEventListener('keydown', event => { if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); goTo(current + 1); } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); goTo(current - 1); } });
    updatePresenter();
  }
  function action(name) {
    switch (name) {
      case 'previous': goTo(current - 1); break;
      case 'next': goTo(current + 1); break;
      case 'index': showDialog('index-dialog'); break;
      case 'notes': showDialog('notes-dialog'); break;
      case 'help': showDialog('help-dialog'); break;
      case 'fullscreen': fullscreen(); break;
      case 'blackout': blackout(); break;
      case 'presenter': openPresenter(); break;
      case 'replay':
        if (effectsPaused || reduced.matches) { $('#announcement').textContent = effectsPaused ? 'As animações estão pausadas. Use M para retomar.' : 'A preferência por movimento reduzido está ativa.'; break; }
        playScene(current);
        slides[current].getAnimations({ subtree: true }).filter(animation => animation instanceof CSSAnimation).forEach(animation => { animation.currentTime = 0; animation.play(); });
        $('#announcement').textContent = 'Animações deste slide reiniciadas.';
        break;
      case 'motion': effectsPaused = !effectsPaused; applyMotion(); if (!effectsPaused && !sceneAnimations.length) playScene(current); try { localStorage.setItem('qualifica-vix-presentation-motion', effectsPaused ? 'paused' : 'running'); } catch {} break;
    }
  }
  $$('[data-action]').forEach(button => button.addEventListener('click', () => action(button.dataset.action)));
  $('.app-brand').addEventListener('click', event => { event.preventDefault(); closeDialogs(); goTo(0, { focus: true }); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('dialog[open]')) { event.preventDefault(); closeDialogs(); return; }
    if (event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const openDialog = $('dialog[open]');
    if (!$('#blackout').hidden) { if (['Escape', 'b', 'B', ' '].includes(event.key)) { event.preventDefault(); blackout(true); } return; }
    if (openDialog && openDialog.id !== 'notes-dialog') return;
    if (event.target.closest('button,a') && [' ', 'Enter'].includes(event.key)) return;
    const key = event.key.toLowerCase();
    const shortcuts = { arrowright:'next', pagedown:'next', ' ':'next', arrowleft:'previous', pageup:'previous', i:'index', n:'notes', p:'presenter', f:'fullscreen', m:'motion', r:'replay', b:'blackout', '?':'help', h:'help' };
    if (key === 'escape') { closeDialogs(); laserEnabled = false; document.body.classList.remove('laser-enabled'); return; }
    if (key === 'home' || key === 'end') { event.preventDefault(); goTo(key === 'home' ? 0 : slides.length - 1); return; }
    if (key === 'l') { event.preventDefault(); laserEnabled = !laserEnabled; document.body.classList.toggle('laser-enabled', laserEnabled); return; }
    if (shortcuts[key]) { event.preventDefault(); action(event.shiftKey && key === ' ' ? 'previous' : shortcuts[key]); }
  });
  stage.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' && !event.target.closest('button,a')) touchStart = { x: event.clientX, y: event.clientY }; });
  stage.addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y; touchStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) goTo(current + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => touchStart = null);
  stage.addEventListener('pointermove', event => { if (!laserEnabled) return; const laser = $('#laser'); laser.style.left = `${event.clientX}px`; laser.style.top = `${event.clientY}px`; laser.classList.add('visible'); });
  stage.addEventListener('pointerleave', () => $('#laser').classList.remove('visible'));
  function updatePractice() {
    $('#practice-clock').textContent = formatTime(practiceSeconds);
    $('#practice-toggle').firstChild.textContent = practiceRunning ? 'Pausar ' : practiceSeconds === 60 ? 'Iniciar 1 minuto ' : practiceSeconds === 0 ? 'Recomeçar ' : 'Continuar ';
  }
  function pausePractice() { if (practiceRunning) { practiceSeconds = Math.max(0, Math.ceil((practiceDeadline - Date.now()) / 1000)); practiceRunning = false; updatePractice(); } }
  $('#practice-toggle').addEventListener('click', () => {
    if (practiceRunning) { pausePractice(); return; }
    if (practiceSeconds === 0) practiceSeconds = 60;
    practiceDeadline = Date.now() + practiceSeconds * 1000; practiceRunning = true; updatePractice();
  });
  $('#practice-reset').addEventListener('click', () => { practiceRunning = false; practiceSeconds = 60; updatePractice(); $('#timer-status').textContent = 'Cronômetro reiniciado.'; });
  setInterval(() => {
    const elapsed = formatTime(Math.floor((Date.now() - started) / 1000)); $('#elapsed').textContent = elapsed;
    if (practiceRunning) {
      practiceSeconds = Math.max(0, Math.ceil((practiceDeadline - Date.now()) / 1000));
      if (practiceSeconds === 0) { practiceRunning = false; $('#timer-status').textContent = 'O minuto de prática terminou.'; }
      updatePractice();
    }
    updatePresenter();
  }, 250);
  function fromHash() { const index = data.slides.findIndex(s => location.hash === `#slide-${s.id}`); goTo(index < 0 ? 0 : index, { hash: false }); }
  window.addEventListener('hashchange', fromHash);
  const printMedia = matchMedia('print');
  printMedia.addEventListener('change', event => { if (event.matches) cancelScene(); else playScene(current); });
  window.addEventListener('beforeprint', cancelScene);
  window.addEventListener('afterprint', () => playScene(current));
  window.addEventListener('pagehide', () => { if (presenter && !presenter.closed) presenter.close(); });
  fromHash(); fit();
  document.fonts.ready.then(fit);
})();
