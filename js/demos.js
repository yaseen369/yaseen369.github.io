/* ==========================================================
   Live project demos
   - Recrify: re-rank candidates when the weights change (FLIP animation)
   - CleanCut: simulated waveform with flagged words, beep or mute
   - Timetable: drag classes into a week and catch time clashes
   ========================================================== */

/* ---------- Recrify ranking ---------- */
(function rankingDemo() {
  const root = document.querySelector('.demo-rank');
  if (!root) return;
  const slider = root.querySelector('input[type="range"]');
  const list = root.querySelector('.rank-list');
  const wResume = root.querySelector('.w-resume');
  const wInterview = root.querySelector('.w-interview');

  function update(animate) {
    const w = slider.value / 100;
    wResume.textContent = Math.round(w * 100) + '%';
    wInterview.textContent = Math.round((1 - w) * 100) + '%';

    const rows = [...list.children];
    // FLIP step 1: remember where each row is now.
    const before = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));

    rows.forEach((row) => {
      const score = Math.round(row.dataset.resume * w + row.dataset.interview * (1 - w));
      row.dataset.score = score;
      row.querySelector('.rank-score').textContent = score;
      row.querySelector('.rank-meter span').style.width = score + '%';
    });

    // Sort by final score and re-append in the new order.
    rows.sort((a, b) => b.dataset.score - a.dataset.score)
      .forEach((row, i) => {
        row.querySelector('.rank-pos').textContent = i + 1;
        list.appendChild(row);
      });

    if (!animate) return;
    // FLIP steps 2-4: jump back to the old spot, then slide to the new one.
    rows.forEach((row) => {
      const delta = before.get(row) - row.getBoundingClientRect().top;
      if (!delta) return;
      row.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
        { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    });
  }

  slider.addEventListener('input', () => update(true));
  update(false);
})();

/* ---------- CleanCut censor ---------- */
(function censorDemo() {
  const root = document.querySelector('.demo-censor');
  if (!root) return;
  const canvas = root.querySelector('.wave');
  const ctx = canvas.getContext('2d');
  const transcriptEl = root.querySelector('.transcript');
  const playBtn = root.querySelector('.censor-play');
  const soundBtn = root.querySelector('.censor-sound');
  const modeBtns = root.querySelectorAll('.seg-btn');

  // A short fake clip. Times are in seconds, like Whisper's word timestamps.
  // Flagged words are never shown as text, only as a blocked-out bar.
  const DURATION = 7;
  const words = [
    ['The', 0.2], ['build', 0.5], ['failed', 0.9], ['again,', 1.3], ['this', 1.8],
    ['#', 2.15, true], ['bug', 2.6], ['is', 2.9], ['back.', 3.1], ['What', 3.7],
    ['a', 3.95], ['#', 4.15, true], ['morning,', 4.6], ['time', 5.2], ['for', 5.5], ['coffee.', 5.75],
  ].map(([text, start, bad], i, arr) => ({
    text, start, bad: !!bad,
    end: i < arr.length - 1 ? arr[i + 1][1] - 0.05 : start + 0.6,
  }));

  transcriptEl.innerHTML = words
    .map((w, i) => `<span class="tw${w.bad ? ' bad' : ''}" data-i="${i}">${w.bad ? 'xxxx' : w.text}</span>`)
    .join(' ');
  const wordEls = transcriptEl.querySelectorAll('.tw');

  // Fake amplitudes: a smooth noise envelope, louder where words are.
  const BARS = 120;
  const amps = Array.from({ length: BARS }, (_, i) => {
    const t = (i / BARS) * DURATION;
    const inWord = words.some((w) => t >= w.start && t <= w.end);
    const base = inWord ? 0.45 + 0.4 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) : 0.06 + 0.05 * Math.abs(Math.sin(i));
    return Math.min(base, 1);
  });

  let mode = 'beep';
  let playing = false;
  let soundOn = false;
  let t = 0;
  let last = 0;
  let w = 0, h = 0;

  // Web Audio beep, created only after the visitor turns sound on.
  let audio = null, osc = null, gain = null;
  function ensureAudio() {
    if (audio) return;
    audio = new (window.AudioContext || window.webkitAudioContext)();
    osc = audio.createOscillator();
    gain = audio.createGain();
    osc.frequency.value = 1000;
    gain.gain.value = 0;
    osc.connect(gain).connect(audio.destination);
    osc.start();
  }
  function setBeep(on) {
    if (!gain) return;
    const target = on && soundOn && mode === 'beep' && playing ? 0.08 : 0;
    gain.gain.setTargetAtTime(target, audio.currentTime, 0.01);
  }

  function size() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const barW = w / BARS;
    const flagged = (time) => words.find((wd) => wd.bad && time >= wd.start && time <= wd.end);
    for (let i = 0; i < BARS; i++) {
      const time = (i / BARS) * DURATION;
      const isBad = !!flagged(time);
      const played = time <= t;
      let amp = amps[i];
      if (isBad && mode === 'mute') amp = 0.03;
      const bh = Math.max(2, amp * (h - 24));
      ctx.fillStyle = isBad ? (mode === 'beep' ? '#D9534A' : '#5A6577') : played ? '#3CC9C0' : '#33456E';
      ctx.fillRect(i * barW + 1, (h - bh) / 2, Math.max(1, barW - 2), bh);
    }
    // Playhead
    const x = (t / DURATION) * w;
    ctx.fillStyle = '#F3F5F4';
    ctx.fillRect(x - 1, 6, 2, h - 12);
  }

  function updateWords() {
    let inBad = false;
    words.forEach((wd, i) => {
      wordEls[i].classList.toggle('said', t >= wd.start);
      if (wd.bad && t >= wd.start && t <= wd.end) inBad = true;
    });
    setBeep(inBad);
  }

  function tick(now) {
    if (!playing) return;
    t += (now - last) / 1000;
    last = now;
    if (t > DURATION) t = 0;
    updateWords();
    draw();
    requestAnimationFrame(tick);
  }

  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', playing);
    if (playing) { last = performance.now(); requestAnimationFrame(tick); }
    else setBeep(false);
  });

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn) { ensureAudio(); audio.resume(); }
    soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', soundOn);
    setBeep(false);
  });

  modeBtns.forEach((btn) => btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    modeBtns.forEach((b) => {
      b.classList.toggle('is-on', b === btn);
      b.setAttribute('aria-pressed', b === btn);
    });
    draw();
  }));

  // Pause when scrolled away, so it doesn't beep off-screen.
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting && playing) playBtn.click();
  }).observe(root);

  window.addEventListener('resize', size);
  size();
})();

/* ---------- Timetable builder ---------- */
(function timetableDemo() {
  const root = document.querySelector('.demo-tt');
  if (!root) return;
  const coursesEl = root.querySelector('.tt-courses');
  const grid = root.querySelector('.tt-grid');
  const status = root.querySelector('.tt-status');
  const resetBtn = root.querySelector('.demo-reset');

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const TIMES = ['09:00', '11:00', '13:00', '15:00'];
  // Each class has a fixed slot, just like rows from the university's Excel sheet.
  // SWE401 and MTH251 share Tuesday 11:00 on purpose, to show a clash.
  const COURSES = [
    { code: 'SWE401', day: 0, time: 0, color: '#3CC9C0' },
    { code: 'SWE401', day: 2, time: 0, color: '#3CC9C0', label: 'SWE401 lab' },
    { code: 'AII435', day: 1, time: 1, color: '#E4C988' },
    { code: 'MTH251', day: 1, time: 1, color: '#F2A18F' },
    { code: 'ECC413', day: 3, time: 2, color: '#B9C6F5' },
    { code: 'SWE302', day: 4, time: 3, color: '#D7E6E4' },
  ];

  let placed = new Map(); // "day-time" -> course

  // Build the grid: header row, then time rows.
  function buildGrid() {
    grid.innerHTML = '<span></span>' + DAYS.map((d) => `<span class="tt-h">${d}</span>`).join('');
    TIMES.forEach((time, ti) => {
      grid.insertAdjacentHTML('beforeend', `<span class="tt-t">${time}</span>`);
      DAYS.forEach((_, di) => {
        grid.insertAdjacentHTML('beforeend', `<div class="tt-cell" data-key="${di}-${ti}" aria-label="${DAY_NAMES[di]} ${time}"></div>`);
      });
    });
  }

  function buildChips() {
    coursesEl.innerHTML = '';
    COURSES.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tt-chip';
      btn.dataset.i = i;
      btn.style.background = c.color;
      btn.setAttribute('role', 'listitem');
      btn.innerHTML = `${c.label || c.code}<small>${DAYS[c.day]} ${TIMES[c.time]}</small>`;
      btn.setAttribute('data-cursor', 'Drag');
      coursesEl.appendChild(btn);
    });
  }

  function say(text, isClash) {
    status.textContent = text;
    status.classList.toggle('is-clash', !!isClash);
  }

  // Try to place a course. Returns true if it fit.
  function place(i, chip) {
    const c = COURSES[i];
    const key = `${c.day}-${c.time}`;
    const cell = grid.querySelector(`[data-key="${key}"]`);
    const existing = placed.get(key);
    if (existing) {
      cell.classList.remove('is-clash');
      void cell.offsetWidth; // restart the shake animation
      cell.classList.add('is-clash');
      say(`Clash: ${c.label || c.code} overlaps ${existing.label || existing.code} on ${DAY_NAMES[c.day]} at ${TIMES[c.time]}.`, true);
      return false;
    }
    placed.set(key, c);
    cell.innerHTML = `<button type="button" class="tt-placed" style="background:${c.color}" data-cursor="Remove" aria-label="Remove ${c.label || c.code}">${c.label || c.code}</button>`;
    cell.querySelector('.tt-placed').addEventListener('click', () => {
      placed.delete(key);
      cell.innerHTML = '';
      chip.hidden = false;
      say(`Removed ${c.label || c.code}.`);
    });
    chip.hidden = true;
    const left = COURSES.length - placed.size;
    say(left ? `Added ${c.label || c.code}. ${left} left to place.` : 'Every class is placed. No clashes.');
    return true;
  }

  // Drag with pointer events (works for mouse, pen and touch).
  let drag = null;
  coursesEl.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest('.tt-chip');
    if (!chip) return;
    const rect = chip.getBoundingClientRect();
    drag = { chip, i: +chip.dataset.i, startX: e.clientX, startY: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false, clone: null };
    chip.setPointerCapture(e.pointerId);
  });

  coursesEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.clone = drag.chip.cloneNode(true);
      drag.clone.classList.add('is-dragging');
      drag.clone.style.width = drag.chip.offsetWidth + 'px';
      document.body.appendChild(drag.clone);
      drag.chip.classList.add('is-ghost');
      grid.classList.add('is-over');
      const c = COURSES[drag.i];
      grid.querySelector(`[data-key="${c.day}-${c.time}"]`).classList.add('is-target');
    }
    drag.clone.style.left = e.clientX - drag.dx + 'px';
    drag.clone.style.top = e.clientY - drag.dy + 'px';
  });

  function endDrag(e) {
    if (!drag) return;
    const { chip, i, moved, clone } = drag;
    drag = null;
    grid.classList.remove('is-over');
    grid.querySelectorAll('.is-target').forEach((c) => c.classList.remove('is-target'));
    chip.classList.remove('is-ghost');
    if (clone) clone.remove();
    if (!moved) { place(i, chip); return; }  // a plain click/tap adds it too
    const r = grid.getBoundingClientRect();
    const overGrid = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (overGrid) place(i, chip);
    else say('Drop the class anywhere on the grid. It goes to its scheduled slot.');
  }
  coursesEl.addEventListener('pointerup', endDrag);
  coursesEl.addEventListener('pointercancel', endDrag);
  // Keyboard: Enter/Space on a chip fires a click with no pointer.
  coursesEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.tt-chip');
    if (chip && e.detail === 0) place(+chip.dataset.i, chip);
  });

  function reset() {
    placed = new Map();
    buildGrid();
    buildChips();
    say('Drag a class onto the grid, or press it to add.');
  }
  resetBtn.addEventListener('click', reset);
  reset();
})();
