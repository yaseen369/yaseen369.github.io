/* ==========================================================
   "Fix my bugs" game
   15 seconds. Click bugs to squash them (+1, combos add more).
   Every bug belongs to a programming language and carries a
   real error. Green "feature" diamonds must be left alone (−3).
   Extras: a coffee that slows every bug, and a "legacy code"
   boss that takes four hits (+10).
   Everything is drawn on one canvas with requestAnimationFrame.
   ========================================================== */
(function () {
  const root = document.querySelector('.game');
  if (!root) return;
  const canvas = root.querySelector('.game-canvas');
  const ctx = canvas.getContext('2d');
  const board = root.querySelector('.game-board');
  const hud = {
    score: root.querySelector('.hud-score'),
    time: root.querySelector('.hud-time'),
    combo: root.querySelector('.hud-combo'),
  };
  const startScreen = root.querySelector('.game-start');
  const endScreen = root.querySelector('.game-end');
  const startBtn = root.querySelector('.game-play');
  const againBtn = root.querySelector('.game-again');
  const shareBtn = root.querySelector('.game-share');
  const endTitle = root.querySelector('.end-rank');
  const endStats = root.querySelector('.end-stats');
  const endBest = root.querySelector('.end-best');

  // A speech bubble for the jokes, drawn as HTML so long lines wrap nicely.
  const quip = document.createElement('p');
  quip.className = 'game-quip';
  quip.setAttribute('aria-hidden', 'true');
  board.appendChild(quip);

  const GAME_SECONDS = 15;

  /* ---------- the cast ---------- */
  // Each error comes with the line shown when you squash it.
  const LANGS = [
    { tag: 'PY', color: '#7FB2E5', errors: [
      ['IndentationError', 'Four spaces. Not tabs. Never tabs.'],
      ['KeyError', 'The key was in the other dict all along.'],
      ["'NoneType' has no attribute", 'None of your business anymore.'],
    ] },
    { tag: 'JS', color: '#E4C988', errors: [
      ['undefined is not a function', 'Defined. Finally.'],
      ['NaN', 'NaN is still not equal to NaN. You are, though.'],
      ['CORS error', 'Access-Control-Allow-Origin: you.'],
    ] },
    { tag: 'JAVA', color: '#F2A18F', errors: [
      ['NullPointerException', 'Null checked. Gosling would be proud.'],
      ['OutOfMemoryError', 'Garbage collected. Personally.'],
      ['ClassCastException', 'Cast removed from the production.'],
    ] },
    { tag: 'C++', color: '#B4BCFF', errors: [
      ['Segmentation fault', 'Core dumped. Bug dumped harder.'],
      ['memory leak', 'Leak plugged. The RAM sends its thanks.'],
      ['dangling pointer', 'It was pointing at you. Not anymore.'],
    ] },
    { tag: 'SQL', color: '#D2B0E6', errors: [
      ['DELETE without WHERE', 'You just saved the production database.'],
      ['deadlock', 'Unlocked. Both transactions owe you lunch.'],
      ['syntax error near ","', 'One comma. Two hours. Fixed in one click.'],
    ] },
    { tag: 'TS', color: '#8FC1EC', errors: [
      ["Type 'any' is not allowed", 'Strictly typed. Strictly squashed.'],
      ['Object is possibly undefined', 'Possibly squashed. Definitely squashed.'],
    ] },
    { tag: 'CSS', color: '#F5B7A5', errors: [
      ['div not centered', 'Centered. Both ways. On the first try.'],
      ['z-index: 99999', 'Sent to the back, where it belongs.'],
    ] },
  ];
  const GENERIC = [
    'Works on my machine now.',
    'One less ticket in Jira.',
    "git commit -m 'fixed it, I think'",
    'Your rubber duck approves.',
    'QA will never know.',
    'Ship it.',
  ];
  const FEATURES = ['login', 'dark mode', 'checkout', 'search', 'payments', 'sign up', 'the logo'];
  const ROASTS = [
    (f) => `You broke ${f}. The product manager is typing...`,
    (f) => `That was ${f}. It was the only thing that worked.`,
    (f) => `Bold move deleting ${f}. Rolling back to Friday's build.`,
    () => "That's not a bug, that's a feature. It says so on the diamond.",
    () => 'git blame says: you.',
    () => 'Your manager would like a quick call.',
    () => 'Who approved this pull request?',
    (f) => `Customers noticed ${f} was gone in four seconds.`,
  ];
  // Body shapes. Speeds are relative: flies are fast and twitchy, worms are slow.
  const KINDS = [
    { kind: 'beetle', speed: 1, twitch: 1 },
    { kind: 'spider', speed: 1.15, twitch: 1.2 },
    { kind: 'ladybug', speed: 0.95, twitch: 0.8 },
    { kind: 'worm', speed: 0.72, twitch: 0.6 },
    { kind: 'fly', speed: 1.35, twitch: 2.4 },
  ];
  const BODY = { beetle: '#E07A5F', spider: '#C8553D', ladybug: '#D9534A', worm: '#F2A18F', fly: '#9AA8BF' };

  // Faint code in the background, so the board looks like an editor.
  const CODE = [
    'def final_score(resume, interview, w=0.6):',
    '    return round(resume * w + interview * (1 - w))',
    '',
    'async def interview(ws: WebSocket):',
    '    await ws.accept()',
    '    for q in questions[:limit]:',
    '        await ws.send_json({"question": q})',
    '        answer = await ws.receive_text()',
    '        feedback = await llm.review(q, answer)',
    '',
    'app.post("/api/transcribe", upload.single("video"), async (req, res) => {',
    '  const words = await whisper(req.file);',
    '  res.json({ words, flagged: findProfanity(words) });',
    '});',
    '',
    'if (!ValidationUtil.isValidProjectCode(code)) throw new ActivityException(msg);',
  ];

  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  let W = 0, H = 0, dpr = 1;
  let state = 'idle';            // idle | countdown | playing | over
  let bugs = [], effects = [];
  let score = 0, squashed = 0, broken = 0, combo = 0, lastHit = 0, bestCombo = 0;
  let timeLeft = GAME_SECONDS, spawnTimer = 0, elapsed = 0, countdown = 0;
  let slowUntil = 0, coffeeAt = 0, bossAt = 0, bossDone = false, coffees = 0;
  let quipTimer = 0, swingPhase = 0;
  let lastFrame = 0, raf = 0;
  const isTouch = matchMedia('(hover: none)').matches;

  function readBest() { try { return +localStorage.getItem('yaseen-bug-best-15') || 0; } catch { return 0; } }
  function writeBest(v) { try { localStorage.setItem('yaseen-bug-best-15', v); } catch { /* private mode */ } }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state !== 'playing') draw();
  }

  function say(text, tone) {
    quip.textContent = text;
    quip.className = 'game-quip is-on' + (tone ? ' is-' + tone : '');
    clearTimeout(quipTimer);
    quipTimer = setTimeout(() => quip.classList.remove('is-on'), tone === 'roast' ? 2200 : 1500);
  }
  function hush() { clearTimeout(quipTimer); quip.className = 'game-quip'; }

  /* ---------- spawning ---------- */
  function entry(pad) {
    const edge = (Math.random() * 4) | 0;   // enter from a random edge
    if (edge === 0) return [Math.random() * W, -pad];
    if (edge === 1) return [W + pad, Math.random() * H];
    if (edge === 2) return [Math.random() * W, H + pad];
    return [-pad, Math.random() * H];
  }
  function spawn(type) {
    const isFeature = type ? false : Math.random() < 0.2;
    const [x, y] = entry(30);
    // Head roughly toward the middle, then wander.
    const angle = Math.atan2(H / 2 - y, W / 2 - x) + (Math.random() - 0.5) * 1.2;
    const ramp = 1 + elapsed / 20;          // everything speeds up as the clock runs down
    const base = { x, y, angle, turn: (Math.random() - 0.5) * 2, phase: Math.random() * 10, inside: false };
    if (type === 'coffee') {
      bugs.push({ ...base, type: 'coffee', speed: 45, size: isTouch ? 16 : 14, label: 'coffee', life: 3.8, twitch: .4 });
      return;
    }
    if (type === 'boss') {
      bugs.push({ ...base, type: 'boss', speed: 55, size: isTouch ? 34 : 30, hp: 4, label: 'legacy code', tag: 'LEGACY',
        tagColor: '#C4CDDB', color: '#B5483E', life: 99, twitch: .7, kind: 'beetle' });
      return;
    }
    if (isFeature) {
      bugs.push({ ...base, type: 'feature', speed: 55 * ramp, size: isTouch ? 17 : 14, label: pick(FEATURES), life: 3.5, twitch: 1 });
      return;
    }
    const lang = pick(LANGS);
    const [error, line] = pick(lang.errors);
    const k = pick(KINDS);
    bugs.push({
      ...base, type: 'bug', kind: k.kind, twitch: k.twitch,
      speed: (70 + Math.random() * 50) * k.speed * ramp,
      size: isTouch ? 17 : 16,
      tag: lang.tag, tagColor: lang.color, color: BODY[k.kind],
      label: error, line, life: 99,
    });
  }

  /* ---------- update ---------- */
  function update(dt) {
    elapsed += dt;
    timeLeft = Math.max(0, GAME_SECONDS - elapsed);
    spawnTimer -= dt;
    // Bigger boards get more bugs, so a wide desktop screen doesn't feel empty.
    const areaK = Math.max(0.7, Math.sqrt((W * H) / (700 * 450)));
    const interval = Math.max(0.15, (0.55 - elapsed * 0.022) / areaK);
    if (spawnTimer <= 0 && bugs.length < Math.round(16 * areaK)) { spawn(); spawnTimer = interval; }
    if (coffeeAt && elapsed >= coffeeAt) { spawn('coffee'); coffeeAt = 0; }
    if (bossAt && elapsed >= bossAt) { spawn('boss'); bossAt = 0; say('Legacy code has entered the chat. It takes four hits.', 'perk'); }
    if (combo && performance.now() - lastHit > 1300) combo = 0;
    const slow = performance.now() < slowUntil ? 0.4 : 1;

    for (const b of bugs) {
      b.turn += (Math.random() - 0.5) * 4 * b.twitch * dt;
      b.turn = Math.max(-1.6 * b.twitch, Math.min(1.6 * b.twitch, b.turn));
      b.angle += b.turn * dt;
      // Until it has come onto the board, keep it heading inward.
      if (!b.inside && b.life > 0) b.angle = Math.atan2(H / 2 - b.y, W / 2 - b.x) + Math.sin(b.phase * .15) * .5;
      const v = b.speed * (b.type === 'coffee' ? 1 : slow);
      b.x += Math.cos(b.angle) * v * dt;
      b.y += Math.sin(b.angle) * v * dt;
      b.phase += dt * v * 0.25;
      b.life -= dt;
      const inBounds = b.x > 0 && b.x < W && b.y > 0 && b.y < H;
      if (inBounds) b.inside = true;
      // Bounce off the walls once a bug has come inside.
      const m = Math.max(12, b.size);
      if (b.inside && b.life > 0) {
        if (b.x < m || b.x > W - m) { b.angle = Math.PI - b.angle; b.x = Math.max(m, Math.min(W - m, b.x)); }
        if (b.y < m || b.y > H - m) { b.angle = -b.angle; b.y = Math.max(m, Math.min(H - m, b.y)); }
      }
    }
    // Drop bugs that have left the board for good.
    bugs = bugs.filter((b) => b.life > 0 || (b.x > -60 && b.x < W + 60 && b.y > -60 && b.y < H + 60));

    for (const e of effects) e.t += dt;
    effects = effects.filter((e) => e.t < e.dur);

    if (timeLeft <= 0) endGame();
  }

  /* ---------- drawing ---------- */
  function drawCode() {
    ctx.font = `${W < 520 ? 11 : 13}px ui-monospace, "SFMono-Regular", Consolas, monospace`;
    ctx.textBaseline = 'top';
    const lh = W < 520 ? 17 : 21;
    for (let i = 0; i * lh < H; i++) {
      const line = CODE[i % CODE.length];
      ctx.fillStyle = 'rgba(147,160,181,.16)';
      ctx.fillText(String(i + 1).padStart(2, ' '), 12, 14 + i * lh);
      ctx.fillStyle = 'rgba(147,160,181,.22)';
      ctx.fillText(line, 44, 14 + i * lh);
    }
  }

  // All bodies face +x (the direction of travel).
  function legs(s, color, n, len, bend) {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * s * (1.1 / n) * 1.6;
      for (const side of [-1, 1]) {
        const swing = Math.sin(swingPhase + i * 2 + (side > 0 ? Math.PI : 0)) * 4;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        if (bend) ctx.quadraticCurveTo(lx + swing * .5, side * s * len * .9, lx + swing + lx * .4, side * s * len);
        else ctx.lineTo(lx + swing, side * s * len);
        ctx.stroke();
      }
    }
  }
  const SHAPES = {
    beetle(s, c) {
      legs(s, c, 3, 1.05);
      ctx.beginPath(); ctx.moveTo(s * .9, -s * .2); ctx.lineTo(s * 1.45, -s * .6); ctx.moveTo(s * .9, s * .2); ctx.lineTo(s * 1.45, s * .6); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(-s * .1, 0, s * .85, s * .62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * .8, 0, s * .36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(15,26,51,.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-s * .9, 0); ctx.lineTo(s * .55, 0); ctx.stroke();
    },
    spider(s, c) {
      legs(s, c, 4, 1.25, true);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(-s * .25, 0, s * .6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * .5, 0, s * .32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F3F5F4';
      ctx.beginPath(); ctx.arc(s * .66, -s * .12, s * .07, 0, Math.PI * 2); ctx.arc(s * .66, s * .12, s * .07, 0, Math.PI * 2); ctx.fill();
    },
    ladybug(s, c) {
      legs(s, '#3A2A2A', 3, .95);
      ctx.fillStyle = '#2B1E22';
      ctx.beginPath(); ctx.arc(s * .72, 0, s * .34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(-s * .05, 0, s * .78, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2B1E22'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-s * .83, 0); ctx.lineTo(s * .7, 0); ctx.stroke();
      ctx.fillStyle = '#2B1E22';
      [[-.35, -.38], [-.35, .38], [.2, -.32], [.2, .32], [-.62, 0]].forEach(([dx, dy]) => {
        ctx.beginPath(); ctx.arc(s * dx, s * dy, s * .12, 0, Math.PI * 2); ctx.fill();
      });
    },
    worm(s, c, b) {
      for (let k = 5; k >= 0; k--) {
        const x = -k * s * .42;
        const y = Math.sin(b.phase * .6 - k * .9) * s * .32;
        ctx.fillStyle = k % 2 ? c : '#E89580';
        ctx.beginPath(); ctx.arc(x, y, s * .42 * (1 - k * .07), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#0F1A33';
      const hy = Math.sin(b.phase * .6) * s * .32;
      ctx.beginPath(); ctx.arc(s * .15, hy - s * .14, s * .07, 0, Math.PI * 2); ctx.arc(s * .15, hy + s * .14, s * .07, 0, Math.PI * 2); ctx.fill();
    },
    fly(s, c, b) {
      const flap = .35 + Math.abs(Math.sin(b.phase * 3)) * .65;
      ctx.fillStyle = 'rgba(220,232,245,.55)';
      ctx.beginPath(); ctx.ellipse(-s * .15, -s * .55, s * .55, s * .3 * flap, -.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-s * .15, s * .55, s * .55, s * .3 * flap, .4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(-s * .1, 0, s * .62, s * .36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#B5483E';
      ctx.beginPath(); ctx.arc(s * .5, -s * .14, s * .16, 0, Math.PI * 2); ctx.arc(s * .5, s * .14, s * .16, 0, Math.PI * 2); ctx.fill();
    },
  };

  function badge(text, x, y, color, big) {
    ctx.font = `800 ${big ? 12 : 9.5}px "Bricolage Grotesque", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + (big ? 12 : 8);
    const h = big ? 18 : 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 4); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = '#0F1A33';
    ctx.fillText(text, x, y + .5);
  }

  function drawCoffee(b) {
    const s = b.size;
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(b.phase) * 2);
    ctx.shadowColor = '#E4C988'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#E4C988';
    ctx.beginPath(); ctx.moveTo(-s * .7, -s * .5); ctx.lineTo(s * .7, -s * .5); ctx.lineTo(s * .5, s * .7); ctx.lineTo(-s * .5, s * .7); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#E4C988'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s * .78, s * .05, s * .3, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(243,245,244,.6)'; ctx.lineWidth = 1.6;
    for (const dx of [-.25, .15]) {
      ctx.beginPath();
      ctx.moveTo(s * dx, -s * .7);
      ctx.quadraticCurveTo(s * (dx + .2), -s * 1.0, s * dx, -s * 1.3 - Math.sin(b.phase) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBug(b) {
    const s = b.size;
    if (b.type === 'coffee') { drawCoffee(b); }
    else if (b.type === 'feature') {
      // A glowing teal diamond: leave it alone.
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.sin(b.phase * .2) * .2);
      ctx.shadowColor = '#3CC9C0'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#3CC9C0';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * .8, 0); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0F1A33';
      ctx.font = `800 ${s * .9}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✓', 0, 1);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      swingPhase = b.phase;
      SHAPES[b.kind](s, b.color, b);
      ctx.restore();
      // The language badge floats above the bug like a name tag and never rotates.
      const by = b.y - s * (b.type === 'boss' ? .9 : 1.1) - 9;
      badge(b.tag, b.x, by, b.tagColor, b.type === 'boss');
      if (b.type === 'boss') {
        const w = s * 2.2;
        ctx.fillStyle = 'rgba(15,26,51,.8)';
        ctx.fillRect(b.x - w / 2, by - 20, w, 6);
        ctx.fillStyle = '#FF8A80';
        ctx.fillRect(b.x - w / 2, by - 20, w * (b.hp / 4), 6);
      }
    }
    // Label under the bug (not rotated, so it stays readable).
    ctx.font = `600 ${b.type === 'boss' ? 12 : 11}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = b.type === 'feature' ? '#3CC9C0' : b.type === 'coffee' ? '#E4C988' : 'rgba(243,245,244,.75)';
    const text = b.type === 'feature' ? 'feature: ' + b.label : b.label;
    // Keep labels inside the board, even when the bug is at an edge.
    const half = ctx.measureText(text).width / 2 + 6;
    ctx.fillText(text, Math.max(half, Math.min(W - half, b.x)), b.y + s + 6);
    ctx.textAlign = 'left';
  }

  function drawEffects() {
    for (const e of effects) {
      const k = e.t / e.dur;
      if (e.type === 'splat') {
        for (const p of e.parts) {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = e.color;
          ctx.beginPath(); ctx.arc(e.x + p.dx * k * e.spread, e.y + p.dy * k * e.spread, p.r * (1 - k * .5), 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === 'text') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = e.color;
        ctx.font = '800 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(e.text, e.x, e.y - k * 36);
        ctx.textAlign = 'left';
      } else if (e.type === 'flash') {
        ctx.globalAlpha = (1 - k) * .25;
        ctx.fillStyle = e.color || '#D9534A';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawCode();
    if (performance.now() < slowUntil && state === 'playing') {
      ctx.fillStyle = 'rgba(228,201,136,.06)';
      ctx.fillRect(0, 0, W, H);
    }
    for (const b of bugs) drawBug(b);
    drawEffects();
    if (state === 'countdown') {
      ctx.fillStyle = 'rgba(15,26,51,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#F3F5F4';
      ctx.font = `800 ${Math.min(W, H) * .32}px "Bricolage Grotesque", system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(countdown) || 'Go', W / 2, H / 2);
      ctx.textAlign = 'left';
    }
  }

  function renderHud() {
    hud.score.textContent = score;
    hud.time.textContent = timeLeft.toFixed(1);
    const slow = state === 'playing' && performance.now() < slowUntil;
    hud.combo.textContent = combo > 1 ? `Combo ×${combo}` : slow ? 'Coffee: bugs slowed' : '';
    root.classList.toggle('is-hurry', state === 'playing' && timeLeft < 4);
  }

  /* ---------- input ---------- */
  function splat(b, n, spread) {
    effects.push({ type: 'splat', x: b.x, y: b.y, color: b.color || '#E4C988', t: 0, dur: .45, spread,
      parts: Array.from({ length: n }, () => ({ dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1, r: 2 + Math.random() * 3 })) });
  }
  function hit(e) {
    if (state !== 'playing') return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const reach = isTouch || e.pointerType === 'touch' ? 34 : 24;
    // Pick the closest thing within reach (big things are easier to hit).
    let best = null, bestD = Infinity;
    for (const b of bugs) {
      const d = Math.hypot(b.x - x, b.y - y) - (b.type === 'boss' ? b.size * .6 : 0);
      if (d < reach && d < bestD) { best = b; bestD = d; }
    }
    if (!best) { combo = 0; return; }

    if (best.type === 'coffee') {
      bugs.splice(bugs.indexOf(best), 1);
      slowUntil = performance.now() + 3000; coffees++;
      effects.push({ type: 'flash', color: '#E4C988', t: 0, dur: .4 });
      say('Coffee break. Every bug now moves at Monday-morning speed.', 'perk');
      renderHud();
      return;
    }

    if (best.type === 'feature') {
      bugs.splice(bugs.indexOf(best), 1);
      score = Math.max(0, score - 3); broken++; combo = 0;
      effects.push({ type: 'flash', t: 0, dur: .35 });
      effects.push({ type: 'text', text: '−3', color: '#FF8A80', x: best.x, y: best.y, t: 0, dur: .9 });
      say(pick(ROASTS)(best.label), 'roast');
      renderHud();
      return;
    }

    const now = performance.now();
    combo = now - lastHit < 1300 ? combo + 1 : 1;
    lastHit = now;
    bestCombo = Math.max(bestCombo, combo);
    const pts = combo >= 5 ? 3 : combo >= 3 ? 2 : 1;

    if (best.type === 'boss') {
      best.hp--;
      best.size *= .9;
      splat(best, 6, 30);
      if (best.hp > 0) {
        score += pts;
        best.label = `legacy code ${4 - best.hp}/4`;
        effects.push({ type: 'text', text: '+' + pts, color: '#3CC9C0', x: best.x, y: best.y - 24, t: 0, dur: .7 });
        const BOSS_LINES = ['It has no tests. It fights back.', 'Written in 2003. Commented never.', 'One more hit. It is begging for a rewrite.'];
        say(BOSS_LINES[3 - best.hp], 'perk');
        renderHud();
        return;
      }
      bugs.splice(bugs.indexOf(best), 1);
      score += 10; squashed++; bossDone = true;
      splat(best, 18, 70);
      effects.push({ type: 'text', text: '+10 refactored', color: '#E4C988', x: best.x, y: best.y - 10, t: 0, dur: 1.1 });
      say('You refactored 2,000 lines of legacy code. Nobody will ever thank you.', 'perk');
      renderHud();
      return;
    }

    bugs.splice(bugs.indexOf(best), 1);
    score += pts; squashed++;
    splat(best, 9, 40);
    effects.push({ type: 'text', text: '+' + pts, color: '#3CC9C0', x: best.x, y: best.y - 10, t: 0, dur: .7 });
    if (combo === 5) say('Combo ×5. Are you a 10x engineer?', 'perk');
    else if (combo === 10) say('Combo ×10. Recruiters are already in your inbox.', 'perk');
    else say(Math.random() < .8 ? best.line : pick(GENERIC));
    renderHud();
  }
  canvas.addEventListener('pointerdown', hit);

  /* ---------- game flow ---------- */
  function loop(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (state === 'countdown') {
      countdown -= dt;
      if (countdown <= -0.4) {
        state = 'playing';
        root.classList.add('is-playing');
        for (let i = 0; i < 3; i++) spawn();   // start with a few on the board
      }
    } else if (state === 'playing') {
      update(dt);
    }
    renderHud();
    draw();
    if (state === 'countdown' || state === 'playing') raf = requestAnimationFrame(loop);
  }

  function start() {
    bugs = []; effects = [];
    score = 0; squashed = 0; broken = 0; combo = 0; bestCombo = 0; coffees = 0;
    elapsed = 0; timeLeft = GAME_SECONDS; spawnTimer = 0.3; countdown = 3;
    slowUntil = 0; bossDone = false;
    coffeeAt = 3.5 + Math.random() * 3;      // one coffee early on
    bossAt = 7 + Math.random() * 1.5;        // the boss shows up halfway
    hush();
    startScreen.hidden = true; endScreen.hidden = true;
    state = 'countdown';
    root.classList.remove('is-over');
    lastFrame = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    canvas.focus({ preventScroll: true });
  }

  const RANKS = [
    [45, 'Production saver', 'You may now deploy on a Friday.'],
    [28, 'Senior bug hunter', 'Code review: approved, no comments.'],
    [14, 'Junior debugger', 'Promising. Still debugs with print statements.'],
    [0, 'Intern on day one', "Don't worry, everyone breaks production once."],
  ];
  const rankOf = (s) => RANKS.find(([min]) => s >= min);

  function endGame() {
    state = 'over';
    combo = 0;
    hush();
    root.classList.remove('is-playing', 'is-hurry');
    root.classList.add('is-over');
    const prev = readBest();
    const isBest = score > prev;
    if (isBest) writeBest(score);
    const [, title, joke] = rankOf(score);
    endTitle.textContent = title;
    endStats.textContent = `${joke} You scored ${score}: ${squashed} bug${squashed === 1 ? '' : 's'} squashed, ` +
      `${broken} feature${broken === 1 ? '' : 's'} broken, best combo ×${bestCombo || 0}` +
      (bossDone ? ', and the legacy code is refactored.' : '.');
    endBest.textContent = isBest ? (prev ? `New personal best. Your old best was ${prev}.` : 'That is your first score. Can you beat it?') : `Your best is ${prev}.`;
    endScreen.hidden = false;
    renderHud();
    endScreen.querySelector('.game-again').focus({ preventScroll: true });
  }

  startBtn.addEventListener('click', start);
  againBtn.addEventListener('click', start);

  shareBtn.addEventListener('click', async () => {
    const text = `I scored ${score} (${rankOf(score)[1]}) in 15 seconds fixing bugs on Yaseen's portfolio. Beat that: https://yaseen369.github.io/#game`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = 'Copied, now paste it anywhere';
      setTimeout(() => (shareBtn.textContent = 'Challenge a friend'), 2400);
    } catch { /* share sheet closed */ }
  });

  // Stop if the visitor scrolls away mid-game (ends the round fairly).
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting && (state === 'playing' || state === 'countdown')) endGame();
  }, { threshold: 0.15 }).observe(canvas);

  // Show the personal best on the start screen if there is one.
  const best = readBest();
  if (best) root.querySelector('.start-best').textContent = `Your best so far: ${best}.`;

  addEventListener('resize', resize);
  resize();
})();
