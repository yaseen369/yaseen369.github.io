/* ==========================================================
   Quiet interactions
   Nothing here moves on its own. Every effect answers something
   the visitor does: pointing, focusing, clicking or a key press.
   ========================================================== */
(function () {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const smooth = reduceMotion ? 'auto' : 'smooth';

  /* ---------- reading progress (thin line at the very top) ---------- */
  const progress = $('.read-progress span');
  function updateProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  }
  addEventListener('scroll', updateProgress, { passive: true });
  addEventListener('resize', updateProgress);
  updateProgress();

  /* ---------- go to a project, wherever it lives ---------- */
  const work = $('.work');
  const panels = $$('.panel');
  function flash(el) {
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1800);
  }
  function goTo(id) {
    if (id === 'top') { scrollTo({ top: 0, behavior: smooth }); return; }
    const el = document.getElementById(id);
    if (!el) return;
    const i = panels.indexOf(el);
    if (i >= 0 && work.classList.contains('is-horizontal')) {
      // In the sideways section, scroll to the point where that panel is centred.
      const top = work.getBoundingClientRect().top + scrollY;
      const travel = work.offsetHeight - innerHeight;
      scrollTo({ top: top + travel * (i / (panels.length - 1)), behavior: smooth });
      setTimeout(() => flash($('.demo', el) || el), reduceMotion ? 0 : 700);
      return;
    }
    el.scrollIntoView({ behavior: smooth, block: 'center' });
    setTimeout(() => flash($('.demo', el) || el), reduceMotion ? 0 : 600);
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (btn) goTo(btn.dataset.go);
  });

  /* ---------- tooltips for tech tags and terms ---------- */
  const tip = $('#tip');
  let tipFor = null;
  let tipShownAt = 0;
  function showTip(el) {
    tipFor = el;
    tipShownAt = performance.now();
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    el.setAttribute('aria-describedby', 'tip');
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.width / 2;
    x = clamp(x, 10, innerWidth - t.width - 10);
    let y = r.top - t.height - 10;
    const below = y < 10;
    if (below) y = r.bottom + 10;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.toggle('is-below', below);
    requestAnimationFrame(() => tip.classList.add('is-on'));
  }
  function hideTip() {
    if (!tipFor) return;
    tipFor.removeAttribute('aria-describedby');
    tipFor = null;
    tip.classList.remove('is-on');
    tip.hidden = true;
  }
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-tip]');
    if (el && el !== tipFor) showTip(el);
  });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && el === tipFor && !el.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) showTip(el);
  });
  document.addEventListener('focusout', (e) => { if (e.target === tipFor) hideTip(); });
  // On touch, a tap toggles the tip.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) { if (tipFor && !e.target.closest('#tip')) hideTip(); return; }
    if (matchMedia('(hover: none)').matches) {
      // A tap also focuses the element, which already opened the tip; only a second tap closes it.
      if (el !== tipFor) showTip(el);
      else if (performance.now() - tipShownAt > 350) hideTip();
    }
  });
  addEventListener('scroll', () => { if (tipFor && !tipFor.matches(':focus')) hideTip(); }, { passive: true });

  /* ---------- skills: point at one to see where it was used ---------- */
  const NAMES = {
    recrify: 'Recrify', cleancut: 'CleanCut', perf: 'the Performance Tester',
    activity: 'the Activity & Project system', itcenter: 'my IT Center training',
    bootcamp: 'StudyBuddy at the bootcamp', top: 'this website',
  };
  const readout = $('.skill-used');
  const defaultText = readout ? readout.textContent : '';
  let pinned = null;
  function describe(btn) {
    const ids = btn.dataset.used.split(' ');
    const links = ids.map((id) => `<button type="button" class="go" data-go="${id}">${NAMES[id]}</button>`);
    const list = links.length > 1 ? links.slice(0, -1).join(', ') + ' and ' + links[links.length - 1] : links[0];
    readout.innerHTML = `<b>${btn.textContent}</b> is in ${list}.`;
  }
  $$('.skill').forEach((btn) => {
    btn.addEventListener('pointerenter', () => describe(btn));
    btn.addEventListener('focus', () => describe(btn));
    btn.addEventListener('pointerleave', () => { if (pinned) describe(pinned); else readout.textContent = defaultText; });
    btn.addEventListener('click', () => {
      if (pinned) pinned.setAttribute('aria-pressed', 'false');
      pinned = pinned === btn ? null : btn;
      if (pinned) { pinned.setAttribute('aria-pressed', 'true'); describe(pinned); }
    });
  });

  /* ---------- headings: letters near the pointer get lighter ---------- */
  if (finePointer && !reduceMotion) {
    const heads = $$('h2.split, .panel h3');
    heads.forEach((h) => {
      // Wrap each character (inside the word spans made by main.js) so it can change weight.
      const targets = $$('.word > span', h);
      (targets.length ? targets : [h]).forEach((node) => {
        node.innerHTML = [...node.textContent].map((c) => (c === ' ' ? ' ' : `<span class="ch">${c}</span>`)).join('');
      });
    });
    const chars = $$('h2.split .ch, .panel h3 .ch');
    let px = -9999, py = -9999, raf = 0;
    const RADIUS = 170;
    function lens() {
      raf = 0;
      for (const ch of chars) {
        const r = ch.getBoundingClientRect();
        if (r.bottom < -50 || r.top > innerHeight + 50) continue;
        const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
        const k = clamp(1 - d / RADIUS, 0, 1);
        if (k > 0) {
          ch.style.fontVariationSettings = `"wght" ${Math.round(760 - k * 380)}`;
          ch.dataset.on = '1';
        } else if (ch.dataset.on) {
          ch.style.fontVariationSettings = '';
          delete ch.dataset.on;
        }
      }
    }
    addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(lens); }, { passive: true });
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(lens); }, { passive: true });
  }

  /* ---------- demo cards: a slight tilt and a soft light under the pointer ---------- */
  if (finePointer && !reduceMotion) {
    $$('.demo').forEach((card) => {
      let pressed = false;
      // Freeze the card where it is while a button is held, so a click never
      // lands on a control that slid out from under the pointer.
      card.addEventListener('pointerdown', () => {
        pressed = true;
        card.style.transition = 'none';
        card.style.transform = getComputedStyle(card).transform;
      });
      addEventListener('pointerup', () => {
        if (!pressed) return;
        pressed = false;
        requestAnimationFrame(() => (card.style.transition = ''));
      });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', x * 100 + '%');
        card.style.setProperty('--my', y * 100 + '%');
        if (pressed) return;      // hold still while dragging or using the slider
        card.style.transform = `perspective(1400px) rotateX(${(0.5 - y) * 3}deg) rotateY(${(x - 0.5) * 3}deg)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- numbers: point at one to roll it again ---------- */
  if (!reduceMotion) {
    $$('.num').forEach((num) => {
      let last = 0;
      num.addEventListener('pointerenter', () => {
        if (performance.now() - last < 1500) return;
        last = performance.now();
        $$('.digit-strip', num).forEach((s) => {
          s.style.transition = 'none';
          s.style.transform = 'translateY(0)';
          void s.offsetWidth;
          s.style.transition = '';
          s.style.transform = `translateY(-${s.dataset.d}em)`;
        });
      });
    });
  }

  /* ---------- keyboard shortcuts ---------- */
  const panel = $('.shortcuts');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  let toastTimer;
  function say(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2000);
  }
  function togglePanel(force) {
    const open = force ?? panel.hidden;
    panel.hidden = !open;
  }
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') { togglePanel(false); hideTip(); return; }
    if (e.key === '?') { togglePanel(); return; }
    const go = { w: 'work', e: 'experience', g: 'game' }[k];
    if (go) { document.getElementById(go).scrollIntoView({ behavior: smooth }); togglePanel(false); return; }
    if (k === 't') { scrollTo({ top: 0, behavior: smooth }); togglePanel(false); return; }
    if (k === 'd') {
      $('.theme-toggle').click();
      say(document.documentElement.dataset.theme === 'dark' ? 'Dark mode on' : 'Light mode on');
      togglePanel(false);
      return;
    }
    if (k === 'c') {
      const email = $('.email-copy').dataset.email;
      navigator.clipboard.writeText(email).then(() => say('Email copied: ' + email), () => say(email));
      togglePanel(false);
    }
  });
})();
