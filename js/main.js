/* ==========================================================
   Page interactions
   Everything is plain JavaScript. Scroll effects read the
   scroll position once per frame (requestAnimationFrame).
   ========================================================== */
(function () {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  /* ---------- custom cursor ---------- */
  if (finePointer && !reduceMotion) {
    document.documentElement.classList.add('has-cursor');
    const cursor = $('.cursor');
    const dot = $('.cursor-dot');
    const ring = $('.cursor-ring');
    const label = $('.cursor-label');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));

    // Show a word inside the ring over elements with data-cursor.
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-cursor]');
      if (el) { label.textContent = el.dataset.cursor; cursor.classList.add('is-label'); }
    });
    document.addEventListener('pointerout', (e) => {
      const el = e.target.closest('[data-cursor]');
      if (el && !el.contains(e.relatedTarget)) cursor.classList.remove('is-label');
    });

    (function follow() {
      rx += (mx - rx) * 0.18;     // the ring trails the dot a little
      ry += (my - ry) * 0.18;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
        setTimeout(() => (el.style.transition = ''), 500);
      });
    });
  }

  /* ---------- text splitting helpers ---------- */
  // Wrap each word so it can animate on its own.
  function splitWords(el, cls) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w, i) => `<span class="${cls}" style="--i:${i}"><span>${w}</span></span>`).join(' ');
    return $$('.' + cls, el);
  }

  // Group words into visual lines (by their top offset) for the hero reveal.
  function splitLines(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="tmp">${w}</span>`).join(' ');
    const lines = [];
    let top = null;
    $$('.tmp', el).forEach((s) => {
      if (s.offsetTop !== top) { lines.push([]); top = s.offsetTop; }
      lines[lines.length - 1].push(s.textContent);
    });
    el.innerHTML = lines.map((l, i) => `<span class="line"><span style="transition-delay:${0.25 + i * 0.12}s">${l.join(' ')}</span></span>`).join('');
  }

  const hasFonts = document.fonts && document.fonts.ready;
  (hasFonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve()).then(() => {
    $$('.reveal-lines').forEach((el) => {
      splitLines(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    });
  });

  // Headings: words slide up when they enter the screen.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: 0.3 });
  $$('.split').forEach((el) => { splitWords(el, 'word'); io.observe(el); });

  // Intro paragraph: each word lights up as it passes the middle of the screen.
  const scrubWords = [];
  $$('.scrub-text').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
    scrubWords.push(...$$('.w', el));
  });

  /* ---------- horizontal work section ---------- */
  const work = $('.work');
  const track = $('.work-track');
  const bar = $('.work-progress-bar');
  const countNow = $('.work-count-now');
  const panels = $$('.panel');
  const wide = matchMedia('(min-width: 1000px)');
  let horizontal = false;
  let travel = 0;

  function setupHorizontal() {
    horizontal = wide.matches && !reduceMotion;
    work.classList.toggle('is-horizontal', horizontal);
    track.style.transform = '';
    panels.forEach((p) => (p.style.width = ''));
    if (!horizontal) { work.style.height = ''; return; }
    // Each panel is one screen wide (clientWidth leaves out the scrollbar).
    const vw = document.documentElement.clientWidth;
    panels.forEach((p) => (p.style.width = vw + 'px'));
    // The section is as tall as the sideways distance, plus one screen.
    travel = track.scrollWidth - vw;
    work.style.height = travel + innerHeight + 'px';
  }

  /* ---------- timeline ---------- */
  const timeline = $('.timeline');
  const fill = $('.timeline-fill');
  const tlItems = $$('.tl-item');

  /* ---------- nav ---------- */
  const nav = $('#nav');
  const darkSections = $$('.hero, .contact');
  const navLinks = $$('.nav ul a');
  let lastY = scrollY;

  /* ---------- one scroll handler for everything ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      const vh = innerHeight;

      // Nav: hide when scrolling down, show when scrolling up.
      nav.classList.toggle('is-hidden', y > lastY && y > vh * 0.6);
      nav.classList.toggle('is-solid', y > 40);
      const overDark = darkSections.some((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= 40 && r.bottom > 40;
      });
      nav.classList.toggle('on-dark', overDark);
      lastY = y;

      // Current section in the nav.
      navLinks.forEach((a) => {
        const sec = $(a.getAttribute('href'));
        const r = sec.getBoundingClientRect();
        a.classList.toggle('is-current', r.top < vh * 0.4 && r.bottom > vh * 0.4);
      });

      // Intro words.
      const mid = vh * 0.62;
      scrubWords.forEach((w) => w.classList.toggle('on', w.getBoundingClientRect().top < mid));

      // Work: translate the track sideways as you scroll down.
      if (horizontal) {
        const r = work.getBoundingClientRect();
        const p = clamp(-r.top / (r.height - vh), 0, 1);
        track.style.transform = `translate3d(${-p * travel}px, 0, 0)`;
        bar.style.transform = `scaleX(${(1 + p * (panels.length - 1)) / panels.length})`;
        countNow.textContent = Math.min(panels.length, Math.round(p * (panels.length - 1)) + 1);
      }

      // Timeline: fill the line up to the middle of the screen.
      const tr = timeline.getBoundingClientRect();
      const tp = clamp((vh * 0.6 - tr.top) / tr.height, 0, 1);
      fill.style.setProperty('--fill', tp);
      tlItems.forEach((it) => it.classList.toggle('is-reached', it.getBoundingClientRect().top < vh * 0.6));
    });
  }

  /* ---------- odometer numbers ---------- */
  $$('.odo').forEach((el) => {
    const value = el.dataset.value;
    el.setAttribute('aria-label', value);
    el.innerHTML = [...value].map((d) =>
      `<span class="digit" aria-hidden="true"><span class="digit-strip" data-d="${d}">${'0123456789'.split('').map((n) => `<span>${n}</span>`).join('')}</span></span>`
    ).join('');
    const strips = $$('.digit-strip', el);
    const roll = () => strips.forEach((s) => (s.style.transform = `translateY(-${s.dataset.d}em)`));
    if (reduceMotion) { roll(); return; }
    new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { roll(); obs.disconnect(); }
    }, { threshold: 0.6 }).observe(el);
  });

  /* ---------- contact: letters react to the cursor ---------- */
  const flex = $('.flex-type');
  if (flex) {
    const text = flex.textContent;
    flex.setAttribute('aria-label', text);
    flex.innerHTML = text.split(' ').map((word) =>
      `<span style="white-space:nowrap" aria-hidden="true">${[...word].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`
    ).join(' ');
    const chars = $$('.ch', flex);
    if (finePointer && !reduceMotion) {
      let fx = -9999, fy = -9999, active = false, raf = 0;
      const contact = $('.contact');
      contact.addEventListener('pointermove', (e) => {
        fx = e.clientX; fy = e.clientY; active = true;
        if (!raf) raf = requestAnimationFrame(updateFlex);
      });
      contact.addEventListener('pointerleave', () => { active = false; if (!raf) raf = requestAnimationFrame(updateFlex); });
      function updateFlex() {
        raf = 0;
        chars.forEach((ch) => {
          const r = ch.getBoundingClientRect();
          const d = Math.hypot(fx - (r.left + r.width / 2), fy - (r.top + r.height / 2));
          const k = active ? clamp(1 - d / 320, 0, 1) : 0;   // 1 = right under the cursor
          ch.style.setProperty('--w', Math.round(300 + k * 500));
          ch.style.setProperty('--wd', Math.round(100 - k * 25));
        });
      }
    }
  }

  /* ---------- copy email ---------- */
  const emailBtn = $('.email-copy');
  if (emailBtn) {
    const state = $('.email-state', emailBtn);
    emailBtn.addEventListener('click', async () => {
      const email = emailBtn.dataset.email;
      try {
        await navigator.clipboard.writeText(email);
        state.textContent = 'Copied to clipboard';
      } catch {
        location.href = 'mailto:' + email;   // fall back to the email app
        return;
      }
      emailBtn.classList.add('is-copied');
      setTimeout(() => { state.textContent = 'Click to copy'; emailBtn.classList.remove('is-copied'); }, 2200);
    });
  }

  /* ---------- live clock (Riyadh) ---------- */
  const clocks = $$('.clock');
  function tickClock() {
    clocks.forEach((c) => {
      c.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.dataset.tz }).format(new Date());
    });
  }
  tickClock();
  setInterval(tickClock, 15000);

  /* ---------- a hello for anyone who opens DevTools ---------- */
  console.log('%cHey, you opened the console.', 'font: 700 16px system-ui; color: #0E7C7B');
  console.log('This site is plain HTML, CSS and JavaScript. The code is here: https://github.com/yaseen369/yaseen369.github.io\nIf you are hiring, I would love to hear from you: yassin.freelance.eng@gmail.com');

  /* ---------- start ---------- */
  setupHorizontal();
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { setupHorizontal(); onScroll(); }, 150); });
  // Fonts can change widths after load, so measure again once they arrive.
  if (hasFonts) document.fonts.ready.then(() => { setupHorizontal(); onScroll(); });
})();
