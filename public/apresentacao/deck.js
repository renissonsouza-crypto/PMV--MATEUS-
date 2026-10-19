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
  const readSetting = () => { try { return localStorage.getItem('qualifica-vix-presentation-motion') === 'paused'; } catch { return false; } };
  effectsPaused = readSetting();
  const applyMotion = () => {
    document.body.classList.toggle('motion-paused', effectsPaused);
    document.body.classList.toggle('reduced-motion', reduced.matches);
    const button = $('[data-action="motion"]');
    button.setAttribute('aria-pressed', String(effectsPaused));
    button.title = effectsPaused ? 'Retomar efeitos contínuos (M)' : 'Pausar efeitos contínuos (M)';
    button.setAttribute('aria-label', button.title);
  };
  reduced.addEventListener('change', applyMotion);
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
    updateNotes(); updatePresenter();
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
      const textMatches = normalize([s.title, s.chapter, s.kicker, ...s.bullets].join(' ')).includes(query);
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
      case 'motion': effectsPaused = !effectsPaused; applyMotion(); try { localStorage.setItem('qualifica-vix-presentation-motion', effectsPaused ? 'paused' : 'running'); } catch {} break;
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
    const shortcuts = { arrowright:'next', pagedown:'next', ' ':'next', arrowleft:'previous', pageup:'previous', i:'index', n:'notes', p:'presenter', f:'fullscreen', m:'motion', b:'blackout', '?':'help', h:'help' };
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
  window.addEventListener('pagehide', () => { if (presenter && !presenter.closed) presenter.close(); });
  fromHash(); fit();
  document.fonts.ready.then(fit);
})();
