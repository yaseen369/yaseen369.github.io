/* ==========================================================
   Hero particles
   1. Draw the word "YASEEN" on a hidden canvas.
   2. Sample its pixels to get a list of target points.
   3. Every frame, each particle springs toward its target,
      and is pushed away if the pointer is close.
   ========================================================== */
(function () {
  const canvas = document.querySelector('.hero-canvas');
  if (!canvas) return;
  const hero = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WORD = 'YASEEN';
  const COLORS = ['#3CC9C0', '#3CC9C0', '#D7E6E4', '#D7E6E4', '#D7E6E4', '#E4C988'];

  let particles = [];
  let width = 0, height = 0, dpr = 1;
  let pointer = { x: -9999, y: -9999, active: false };
  let running = false;
  let frameId = 0;

  // Work out where the word goes and sample points from it.
  function buildTargets() {
    const off = document.createElement('canvas');
    const octx = off.getContext('2d');
    off.width = width;
    off.height = height;

    const isNarrow = width < 640;
    // Fit the word to ~88% of the width, but keep it in the top part of the hero.
    let fontSize = Math.min(width * (isNarrow ? .26 : .235), height * .42);
    octx.font = `800 ${fontSize}px "Bricolage Grotesque", "Arial Narrow", Arial, sans-serif`;
    const measured = octx.measureText(WORD).width;
    if (measured > width * .9) {
      fontSize *= (width * .9) / measured;
      octx.font = `800 ${fontSize}px "Bricolage Grotesque", "Arial Narrow", Arial, sans-serif`;
    }
    octx.fillStyle = '#fff';
    octx.textBaseline = 'middle';
    const textWidth = octx.measureText(WORD).width;
    const x = Math.max(width * .04, (width - textWidth) / 2 - width * .02);
    const y = height * (isNarrow ? .38 : .33);
    octx.fillText(WORD, x, y);

    // Sample every `gap` pixels. Fewer points on small screens keeps it smooth.
    const gap = isNarrow ? 4 : width > 1600 ? 7 : 6;
    const data = octx.getImageData(0, 0, width, height).data;
    const targets = [];
    for (let py = 0; py < height; py += gap) {
      for (let px = 0; px < width; px += gap) {
        if (data[(py * width + px) * 4 + 3] > 128) targets.push({ x: px, y: py });
      }
    }
    return targets;
  }

  function createParticles() {
    const targets = buildTargets();
    particles = targets.map((t) => ({
      tx: t.x, ty: t.y,
      // Start scattered so the word "assembles" on load.
      x: reduceMotion ? t.x : Math.random() * width,
      y: reduceMotion ? t.y : Math.random() * height,
      vx: 0, vy: 0,
      r: Math.random() * 1.1 + 1.1,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    }));
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createParticles();
    if (reduceMotion) draw();
  }

  const RADIUS = 110;        // how far the pointer reaches
  const PUSH = 7;            // how hard it pushes
  const SPRING = 0.045;      // pull back toward the target
  const FRICTION = 0.86;

  function step() {
    for (const p of particles) {
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dist2 = dx * dx + dy * dy;
      if (pointer.active && dist2 < RADIUS * RADIUS) {
        const dist = Math.sqrt(dist2) || 1;
        const force = (1 - dist / RADIUS) * PUSH;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      p.vx += (p.tx - p.x) * SPRING;
      p.vy += (p.ty - p.y) * SPRING;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    // Group by colour so we change fillStyle only a few times per frame.
    for (const color of new Set(COLORS)) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const p of particles) {
        if (p.c !== color) continue;
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  function loop() {
    step();
    draw();
    frameId = requestAnimationFrame(loop);
  }

  function start() { if (!running && !reduceMotion) { running = true; loop(); } }
  function stop() { running = false; cancelAnimationFrame(frameId); }

  // Pointer tracking (mouse and touch both send pointer events).
  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
  }
  hero.addEventListener('pointermove', setPointer);
  hero.addEventListener('pointerdown', setPointer);
  hero.addEventListener('pointerleave', () => { pointer.active = false; });
  hero.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointer.active = false; });

  // Only animate while the hero is on screen.
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()))
    .observe(hero);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Ignore the small height change when a mobile address bar hides.
      const rect = hero.getBoundingClientRect();
      if (Math.abs(rect.width - width) < 2 && Math.abs(rect.height - height) < 120) return;
      resize();
    }, 150);
  });

  // Wait for the display font so the word is drawn in the right typeface.
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('800 100px "Bricolage Grotesque"'), new Promise((r) => setTimeout(r, 1500))])
    : Promise.resolve();
  fontReady.then(() => { resize(); start(); });
})();
