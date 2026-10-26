/* ==========================================================
   Live project demos
   - Tabs shared by the demo cards
   - Recrify: re-rank candidates (FLIP animation) and build the HR report
   - CleanCut: simulated waveform with flagged words, beep or mute
   - Performance Tester: a simulated load test, plus a real report
   - Activity system: the Turkish and English versions side by side
   ========================================================== */
const reduceMotionDemos = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- tabs ---------- */
document.querySelectorAll('.tabs').forEach((list) => {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  function select(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    list.dispatchEvent(new CustomEvent('tabchange', { detail: tab.id }));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (step) { e.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length], true); }
    });
  });
});

/* ---------- Recrify ranking and HR report ---------- */
(function rankingDemo() {
  const root = document.querySelector('.demo-rank');
  if (!root) return;
  const slider = root.querySelector('input[type="range"]');
  const list = root.querySelector('.rank-list');
  const wResume = root.querySelector('.w-resume');
  const wInterview = root.querySelector('.w-interview');
  const report = root.querySelector('.report');
  const tbody = report.querySelector('tbody');
  const conclusion = report.querySelector('.report-conclusion');

  function update(animate) {
    const w = slider.value / 100;
    const pr = Math.round(w * 100) + '%';
    const pi = Math.round((1 - w) * 100) + '%';
    wResume.textContent = pr;
    wInterview.textContent = pi;
    report.querySelector('.r-w').textContent = pr;
    report.querySelector('.r-wi').textContent = pi;

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

    renderReport(rows);

    if (!animate || list.offsetParent === null) return;
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

  // The same table Recrify writes into the report it sends to HR.
  function data(rows) {
    return rows.map((r, i) => ({
      rank: i + 1,
      name: r.querySelector('.rank-name').textContent,
      email: r.dataset.email,
      final: +r.dataset.score,
      resume: +r.dataset.resume,
      interview: +r.dataset.interview,
    }));
  }
  function renderReport(rows) {
    const d = data(rows);
    tbody.innerHTML = d.map((c) =>
      `<tr><td>${c.rank}</td><td>${c.name}</td><td>${c.email}</td><td><b>${c.final}/100</b></td><td>${c.resume}/100</td><td>${c.interview}/100</td></tr>`
    ).join('');
    const top = d[0];
    conclusion.textContent = `The #1 ranked applicant is ${top.name} with a final score of ${top.final}/100. ` +
      `Their resume score is ${top.resume}/100 and their interview score is ${top.interview}/100.`;
  }

  report.querySelector('.report-download').addEventListener('click', () => {
    const d = data([...list.children]);
    const lines = [['Rank', 'Candidate', 'Email', 'Final score', 'Resume score', 'Interview score'],
      ...d.map((c) => [c.rank, c.name, c.email, c.final, c.resume, c.interview])];
    const csv = lines.map((l) => l.join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'ranked_applicants_report.csv' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

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

/* ---------- Performance Tester ---------- */
(function perfDemo() {
  const root = document.querySelector('.demo-perf');
  if (!root) return;
  const canvas = root.querySelector('.perf-chart');
  const ctx = canvas.getContext('2d');
  const log = root.querySelector('.perf-log');
  const startBtn = root.querySelector('.perf-start');
  const LEVELS = [1, 5, 10, 20];
  const MAX_LINES = 7;
  let results = [];           // { users, avg, p95, passed, total }
  let grow = 1;               // 0..1 for the bar being drawn right now
  let running = false;
  let w = 0, h = 0;

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  new ResizeObserver(size).observe(canvas);

  function niceMax(v) {
    const steps = [200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000];
    return steps.find((s) => s >= v) || Math.ceil(v / 500) * 500;
  }

  function draw() {
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const L = 48, R = 10, T = 28, B = 24;
    const cw = w - L - R, ch = h - T - B;
    const top = niceMax(Math.max(400, ...results.map((r) => r.p95)));
    ctx.font = '600 11px "Bricolage Grotesque", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    // grid
    for (let i = 0; i <= 4; i++) {
      const y = T + ch - (ch * i) / 4;
      ctx.fillStyle = '#1E2B4D';
      ctx.fillRect(L, Math.round(y), cw, 1);
      ctx.fillStyle = '#6B7A93';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round((top * i) / 4) + (i === 4 ? ' ms' : ''), L - 8, y);
    }
    // legend
    ctx.textAlign = 'left';
    [['Average', '#3CC9C0'], ['95th percentile', '#E4C988']].forEach(([label, c], i) => {
      const x = L + i * 96;
      ctx.fillStyle = c; ctx.fillRect(x, 8, 10, 10);
      ctx.fillStyle = '#C4CDDB'; ctx.fillText(label, x + 15, 13);
    });
    // bars
    const gw = cw / LEVELS.length;
    const bw = Math.min(26, gw * 0.26);
    LEVELS.forEach((u, i) => {
      const cx = L + gw * i + gw / 2;
      ctx.fillStyle = '#93A0B5';
      ctx.textAlign = 'center';
      ctx.fillText(u === 1 ? '1 user' : u + ' users', cx, h - 10);
      const r = results[i];
      if (!r) return;
      const k = i === results.length - 1 ? grow : 1;
      [[r.avg, '#3CC9C0', -bw - 2], [r.p95, '#E4C988', 2]].forEach(([v, c, dx]) => {
        const bh = (v / top) * ch * k;
        ctx.fillStyle = c;
        ctx.fillRect(cx + dx, T + ch - bh, bw, bh);
      });
    });
    if (!results.length) {
      ctx.fillStyle = '#6B7A93';
      ctx.textAlign = 'center';
      ctx.font = '600 13px "Bricolage Grotesque", system-ui, sans-serif';
      ctx.fillText('Press "Run load test" to start', L + cw / 2, T + ch / 2);
    }
  }

  function line(html, cls) {
    const el = document.createElement('span');
    el.className = 'pl' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    log.appendChild(el);
    while (log.children.length > MAX_LINES) log.firstChild.remove();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotionDemos ? 0 : ms));
  function tween(ms) {
    return new Promise((resolve) => {
      if (reduceMotionDemos) { grow = 1; draw(); resolve(); return; }
      const t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / ms);
        grow = 1 - Math.pow(1 - p, 3);
        draw();
        if (p < 1) requestAnimationFrame(step); else resolve();
      })(t0);
    });
  }

  async function run() {
    if (running) return;
    running = true;
    startBtn.disabled = true;
    startBtn.textContent = 'Running...';
    results = [];
    log.textContent = '';
    draw();
    line('$ python web-tester.py --url https://demo-api.example --test load', 'dim');
    // Response time grows with the number of users, like a real server under load.
    const base = 95 + Math.random() * 40;
    for (const u of LEVELS) {
      const total = u * 6;
      line(`[load] ${u} ${u === 1 ? 'user ' : 'users'} sending ${total} requests...`);
      await wait(250);
      const avg = Math.round(base * (1 + 0.04 * u + 0.0022 * u * u) + Math.random() * 18);
      const p95 = Math.round(avg * (1.3 + Math.random() * 0.3));
      const failed = u >= 20 ? Math.floor(Math.random() * 4) : 0;
      results.push({ users: u, avg, p95, passed: total - failed, total });
      grow = 0;
      await tween(650);
      const pct = Math.round(((total - failed) / total) * 100);
      line(`       avg ${avg} ms, p95 ${p95} ms, <span class="${failed ? 'bad' : 'ok'}">${total - failed}/${total} passed (${pct}%)</span>`);
    }
    await wait(250);
    line('[failure] 15 broken endpoints injected, <span class="ok">15 flagged</span>');
    await wait(350);
    line('[report] saved results.db, enhanced_summary.csv and report.pdf', 'dim');
    running = false;
    startBtn.disabled = false;
    startBtn.textContent = 'Run again';
  }
  startBtn.addEventListener('click', run);
  line('Ready. This tab simulates a target so you can see the steps.', 'dim');
})();

/* ---------- Activity & Project Management: Turkish and English versions ---------- */
(function archDemo() {
  const root = document.querySelector('.demo-arch');
  if (!root) return;
  const stage = root.querySelector('.arch');
  const detail = root.querySelector('.arch-detail');
  const names = root.querySelector('.arch-renames');
  const btns = [...root.querySelectorAll('.seg-btn')];

  // Class and page names are taken from the real code of each version.
  const VERSIONS = {
    tr: {
      intro: 'The Turkish version is a Java EE web app. Pick a box to see what each part does.',
      layers: [
        ['Pages', [
          ['faaliyet.jsp', 'The activity form, where a user logs a day of work: date, hours, project, work done and location. On success it shows "Faaliyetiniz başarıyla eklenmiştir" (your activity was added successfully).'],
          ['tarihSor.jsp', 'Asks for a date range and a project before listing activities. "Tarih sor" means "ask for the date".'],
          ['faaliyetSonuc.jsp', 'Lists the activities found for that date range, where each one can be edited or deleted.'],
          ['faaliyetRapor.jsp', 'The activity report page.'],
        ]],
        ['Servlet', [
          ['FaaliyetServlet', 'Adds, updates, lists and deletes activities. It reads and checks each form, keeps the user\'s lists in the session and chooses the next page.'],
          ['FormVerifier', 'Checks every form field by type, such as dates and text, before anything is saved. Errors come back as Hata, Turkish for "error".'],
        ]],
        ['Data', [
          ['FaaliyetDS', 'The data source the servlet calls: faaliyetEkle (add), faaliyetGuncelle (update), faaliyetGoster (list) and faaliyetSil (delete).'],
        ]],
        ['Model', [
          ['Faaliyet', 'An activity, with fields such as tarih (date), calismaSaati (work hours) and projeKod (project code).'],
          ['Kullanici', 'A user account.'],
          ['Proje', 'A project with its code and name.'],
        ]],
      ],
    },
    en: {
      intro: 'The English version has one job per layer, and each layer only talks to the one below. Pick a box to see what it does.',
      layers: [
        ['Wiring', [
          ['AppConfig', 'Creates each DAO and the service once and hands them out, so no class builds its own dependencies.'],
        ]],
        ['Service', [
          ['ActivityService', 'addActivity checks the data with ValidationUtil, makes sure the project and the user exist, then saves through ActivityDAO. Anything wrong is thrown as an ActivityException with a clear message.'],
        ]],
        ['Rules', [
          ['ValidationUtil', 'Every check in one place: isValidString, isValidProjectCode (P followed by three digits) and isValidDate (no dates in the future).'],
          ['ActivityException', 'One exception type for business errors, so every problem reaches the user with a clear message.'],
        ]],
        ['Data', [
          ['ActivityDAO', 'saveActivity, getAllActivities and getActivityByProjectCode. Storage details stay inside this layer.'],
          ['ProjectDAO', 'Saves projects and finds one by its code.'],
          ['UserDAO', 'Saves users and checks a password with verifyUser.'],
        ]],
        ['Model', [
          ['Activity', 'An activity, with fields such as date, workHours, projectCode and workLocation.'],
          ['Project', 'A project with its code and name.'],
          ['User', 'A user, with password checking kept inside the class.'],
        ]],
      ],
    },
  };
  const PAIRS = [['Faaliyet', 'Activity'], ['Kullanici', 'User'], ['Proje', 'Project'], ['tarih', 'date'], ['calismaSaati', 'workHours'], ['projeKod', 'projectCode']];

  names.innerHTML = '<span class="arch-renames-label">Same names in both</span>' +
    PAIRS.map(([tr, en]) => `<span class="rename"><span class="tr" lang="tr">${tr}</span> <span aria-hidden="true">=</span><span class="sr-only">is</span> <b>${en}</b></span>`).join('');

  function render(v) {
    const ver = VERSIONS[v];
    stage.dataset.v = v;
    let n = 0;
    stage.innerHTML = ver.layers.map(([label, boxes], li) =>
      (li ? '<span class="arch-arrow" aria-hidden="true"></span>' : '') +
      `<div class="arch-layer"><span class="arch-label">${label}</span><div class="arch-boxes">` +
      boxes.map(([name]) => `<button type="button" class="arch-box" style="--i:${n++}" aria-pressed="false">${name}</button>`).join('') +
      '</div></div>'
    ).join('');
    detail.textContent = ver.intro;
    const lookup = Object.fromEntries(ver.layers.flatMap(([, boxes]) => boxes.map(([name, text]) => [name, text])));
    stage.querySelectorAll('.arch-box').forEach((b) => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      stage.querySelectorAll('.arch-box').forEach((x) => { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); });
      if (on) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
      detail.innerHTML = on ? `<b>${b.textContent}</b> ${lookup[b.textContent]}` : ver.intro;
    }));
  }
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
    render(b.dataset.v);
  }));
  render('en');
})();
