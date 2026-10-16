/* ==========================================================
   "Fix my bugs" game
   30 seconds. Click bugs to squash them (+1, combos add more).
   Green "feature" diamonds must be left alone (−3).
   Everything is drawn on one canvas with requestAnimationFrame.
   ========================================================== */
(function () {
  const root = document.querySelector('.game');
  if (!root) return;
  const canvas = root.querySelector('.game-canvas');
  const ctx = canvas.getContext('2d');
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

  const GAME_SECONDS = 30;
  const BUG_NAMES = ['null', 'CORS', 'off-by-one', '404', 'typo', 'race condition', 'memory leak', 'merge conflict', 'NaN', 'timeout', 'undefined', 'infinite loop'];
  const BUG_COLORS = ['#D9534A', '#E4C988', '#F2A18F', '#E07A5F'];
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
    'const clashes = classes.filter((c) => overlaps(c, next));',
  ];

  let W = 0, H = 0, dpr = 1;
  let state = 'idle';            // idle | countdown | playing | over
  let bugs = [], effects = [];
  let score = 0, squashed = 0, broken = 0, combo = 0, lastHit = 0, bestCombo = 0;
  let timeLeft = GAME_SECONDS, spawnTimer = 0, elapsed = 0, countdown = 0;
  let lastFrame = 0, raf = 0;
  const isTouch = matchMedia('(hover: none)').matches;

  function readBest() { try { return +localStorage.getItem('yaseen-bug-best') || 0; } catch { return 0; } }
  function writeBest(v) { try { localStorage.setItem('yaseen-bug-best', v); } catch { /* private mode */ } }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state !== 'playing') draw();
  }

  /* ---------- spawning ---------- */
  function spawn() {
    const isFeature = Math.random() < 0.18;
    const edge = (Math.random() * 4) | 0;   // enter from a random edge
    const pad = 30;
    let x, y;
    if (edge === 0) { x = Math.random() * W; y = -pad; }
    else if (edge === 1) { x = W + pad; y = Math.random() * H; }
    else if (edge === 2) { x = Math.random() * W; y = H + pad; }
    else { x = -pad; y = Math.random() * H; }
    // Head roughly toward the middle, then wander.
    const angle = Math.atan2(H / 2 - y, W / 2 - x) + (Math.random() - 0.5) * 1.2;
    const speed = (isFeature ? 40 : 55 + Math.random() * 45) * (1 + elapsed / 30);   // faster over time
    bugs.push({
      x, y, angle, speed,
      turn: (Math.random() - 0.5) * 2,
      size: isTouch ? 17 : 14,
      feature: isFeature,
      name: isFeature ? 'feature' : BUG_NAMES[(Math.random() * BUG_NAMES.length) | 0],
      color: BUG_COLORS[(Math.random() * BUG_COLORS.length) | 0],
      phase: Math.random() * 10,
      life: isFeature ? 5 : 99,     // features wander off after a few seconds
      inside: false,
    });
  }

  /* ---------- update ---------- */
  function update(dt) {
    elapsed += dt;
    timeLeft = Math.max(0, GAME_SECONDS - elapsed);
    spawnTimer -= dt;
    // Bigger boards get more bugs, so a wide desktop screen doesn't feel empty.
    const areaK = Math.max(0.7, Math.sqrt((W * H) / (700 * 450)));
    const interval = Math.max(0.2, (0.9 - elapsed * 0.022) / areaK);
    if (spawnTimer <= 0 && bugs.length < Math.round(14 * areaK)) { spawn(); spawnTimer = interval; }
    if (combo && performance.now() - lastHit > 1400) combo = 0;

    for (const b of bugs) {
      b.turn += (Math.random() - 0.5) * 4 * dt;
      b.turn = Math.max(-1.6, Math.min(1.6, b.turn));
      b.angle += b.turn * dt;
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.phase += dt * b.speed * 0.25;
      b.life -= dt;
      const inBounds = b.x > 0 && b.x < W && b.y > 0 && b.y < H;
      if (inBounds) b.inside = true;
      // Bounce off the walls once a bug has come inside.
      if (b.inside && b.life > 0) {
        if (b.x < 12 || b.x > W - 12) { b.angle = Math.PI - b.angle; b.x = Math.max(12, Math.min(W - 12, b.x)); }
        if (b.y < 12 || b.y > H - 12) { b.angle = -b.angle; b.y = Math.max(12, Math.min(H - 12, b.y)); }
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

  function drawBug(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    const s = b.size;
    if (b.feature) {
      // A glowing teal diamond: leave it alone.
      ctx.rotate(-b.angle + Math.sin(b.phase * .2) * .2);
      ctx.shadowColor = '#3CC9C0'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#3CC9C0';
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * .8, 0); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0F1A33';
      ctx.font = `800 ${s * .9}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✓', 0, 1);
    } else {
      // Legs wiggle with the walk cycle.
      ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const swing = Math.sin(b.phase + i * 2) * 4;
        ctx.beginPath(); ctx.moveTo(i * s * .45, 0); ctx.lineTo(i * s * .45 + swing, -s * 1.05); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i * s * .45, 0); ctx.lineTo(i * s * .45 - swing, s * 1.05); ctx.stroke();
      }
      // Antennae
      ctx.beginPath(); ctx.moveTo(s * .9, -s * .2); ctx.lineTo(s * 1.45, -s * .6); ctx.moveTo(s * .9, s * .2); ctx.lineTo(s * 1.45, s * .6); ctx.stroke();
      // Body and head
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.ellipse(-s * .1, 0, s * .85, s * .62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * .8, 0, s * .36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(15,26,51,.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-s * .9, 0); ctx.lineTo(s * .55, 0); ctx.stroke();
    }
    ctx.restore();
    // Label under the bug (not rotated, so it stays readable).
    ctx.font = `600 ${isTouch ? 11 : 11}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = b.feature ? '#3CC9C0' : 'rgba(243,245,244,.75)';
    ctx.fillText(b.name, b.x, b.y + b.size + 6);
    ctx.textAlign = 'left';
  }

  function drawEffects() {
    for (const e of effects) {
      const k = e.t / e.dur;
      if (e.type === 'splat') {
        for (const p of e.parts) {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = e.color;
          ctx.beginPath(); ctx.arc(e.x + p.dx * k * 40, e.y + p.dy * k * 40, p.r * (1 - k * .5), 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === 'text') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = e.color;
        ctx.font = '800 20px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(e.text, e.x, e.y - k * 36);
        ctx.textAlign = 'left';
      } else if (e.type === 'flash') {
        ctx.globalAlpha = (1 - k) * .25;
        ctx.fillStyle = '#D9534A';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawCode();
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
    hud.combo.textContent = combo > 1 ? `Combo ×${combo}` : '';
    root.classList.toggle('is-hurry', state === 'playing' && timeLeft < 6);
  }

  /* ---------- input ---------- */
  function hit(e) {
    if (state !== 'playing') return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const reach = isTouch || e.pointerType === 'touch' ? 34 : 24;
    // Pick the closest bug within reach.
    let best = null, bestD = reach;
    for (const b of bugs) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) { best = b; bestD = d; }
    }
    if (!best) { combo = 0; return; }
    bugs.splice(bugs.indexOf(best), 1);
    if (best.feature) {
      score = Math.max(0, score - 3); broken++; combo = 0;
      effects.push({ type: 'flash', t: 0, dur: .35 });
      effects.push({ type: 'text', text: '−3 broke a feature', color: '#FF8A80', x: best.x, y: best.y, t: 0, dur: .9 });
    } else {
      const now = performance.now();
      combo = now - lastHit < 1400 ? combo + 1 : 1;
      lastHit = now;
      bestCombo = Math.max(bestCombo, combo);
      const pts = combo >= 5 ? 3 : combo >= 3 ? 2 : 1;
      score += pts; squashed++;
      effects.push({ type: 'splat', x: best.x, y: best.y, color: best.color, t: 0, dur: .45,
        parts: Array.from({ length: 9 }, () => ({ dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1, r: 2 + Math.random() * 3 })) });
      effects.push({ type: 'text', text: '+' + pts, color: '#3CC9C0', x: best.x, y: best.y - 10, t: 0, dur: .7 });
    }
    renderHud();
  }
  canvas.addEventListener('pointerdown', hit);

  /* ---------- game flow ---------- */
  function loop(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (state === 'countdown') {
      countdown -= dt;
      if (countdown <= -0.4) { state = 'playing'; root.classList.add('is-playing'); }
    } else if (state === 'playing') {
      update(dt);
    }
    renderHud();
    draw();
    if (state === 'countdown' || state === 'playing') raf = requestAnimationFrame(loop);
  }

  function start() {
    bugs = []; effects = [];
    score = 0; squashed = 0; broken = 0; combo = 0; bestCombo = 0;
    elapsed = 0; timeLeft = GAME_SECONDS; spawnTimer = 0; countdown = 3;
    startScreen.hidden = true; endScreen.hidden = true;
    state = 'countdown';
    root.classList.remove('is-over');
    lastFrame = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    canvas.focus({ preventScroll: true });
  }

  function rank(s) {
    if (s >= 90) return 'Production saver';
    if (s >= 50) return 'Senior bug hunter';
    if (s >= 20) return 'Junior debugger';
    return 'Intern on day one';
  }

  function endGame() {
    state = 'over';
    combo = 0;
    root.classList.remove('is-playing', 'is-hurry');
    root.classList.add('is-over');
    const prev = readBest();
    const isBest = score > prev;
    if (isBest) writeBest(score);
    endTitle.textContent = rank(score);
    endStats.textContent = `You scored ${score}: ${squashed} bug${squashed === 1 ? '' : 's'} squashed, ${broken} feature${broken === 1 ? '' : 's'} broken, best combo ×${bestCombo || 0}.`;
    endBest.textContent = isBest ? (prev ? `New personal best. Your old best was ${prev}.` : 'That is your first score. Can you beat it?') : `Your best is ${prev}.`;
    endScreen.hidden = false;
    endScreen.querySelector('.game-again').focus({ preventScroll: true });
  }

  startBtn.addEventListener('click', start);
  againBtn.addEventListener('click', start);

  shareBtn.addEventListener('click', async () => {
    const text = `I scored ${score} (${rank(score)}) fixing bugs on Yaseen's portfolio. Beat that: https://yaseen369.github.io/#game`;
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
