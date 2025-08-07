/*
  SKY learns Deutsch - Canvas-only interactive learning app
  - Home menu with animated UI
  - Activities: Flashcards, Quiz, Diary, Maus & Käse Game (snake variant)
  - Tracks progress in localStorage under key 'skyDeutschProgress'
  - Uses Web Speech API for TTS (German A1 words) during game and flashcards
*/

(() => {
  const canvas = document.getElementById('appCanvas');
  const ctx = canvas.getContext('2d');

  // Handle high-DPI scaling
  function resizeCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = { width: window.innerWidth, height: window.innerHeight };
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  // Ensure keyboard focus for arrow keys
  setTimeout(() => { try { canvas.focus(); } catch {} }, 0);

  // App State
  const State = {
    route: 'home', // 'home' | 'flashcards' | 'quiz' | 'diary' | 'game'
    subroute: null,
    now: 0,
    mouse: { x: 0, y: 0, down: false },
    keys: {},
    transition: { active: false, t: 0, from: 'home', to: 'home' },
    toast: null,
  };

  // Progress Tracking
  const STORAGE_KEY = 'skyDeutschProgress';
  const defaultProgress = {
    name: 'SKY',
    streakDays: 0,
    lastVisit: null,
    totalCheeseEaten: 0,
    flashcardsReviewed: 0,
    quizBest: 0,
    diaryEntries: [], // { dateISO, text }
    learnedWords: [], // array of german words announced in game/flashcards
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultProgress };
      const parsed = JSON.parse(raw);
      return { ...defaultProgress, ...parsed };
    } catch (e) {
      return { ...defaultProgress };
    }
  }

  function saveProgress(p) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {}
  }

  let progress = loadProgress();

  // Update streak
  (function updateStreak() {
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!progress.lastVisit) {
      progress.streakDays = 1;
    } else {
      const last = new Date(progress.lastVisit);
      const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      const diffDays = Math.round((todayDate - lastDate) / 86400000);
      if (diffDays === 1) progress.streakDays += 1;
      else if (diffDays > 1) progress.streakDays = 1;
    }
    progress.lastVisit = today.toISOString();
    saveProgress(progress);
  })();

  // Colors & Style
  const Colors = {
    bg: '#0f1020',
    card: '#14162e',
    cardAccent: '#2b2e6b',
    text: '#f2f3ff',
    textDim: '#aab',
    primary: '#6c9eff',
    accent: '#ffd166',
    success: '#6cffb2',
    danger: '#ff6c8f',
  };

  // Utility drawing
  function fillRoundedRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    roundRectPath(x, y, w, h, r);
    ctx.fill();
  }
  function strokeRoundedRect(x, y, w, h, r, color, lw = 2) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    roundRectPath(x, y, w, h, r);
    ctx.stroke();
  }
  function roundRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function drawText(text, x, y, size = 18, color = Colors.text, align = 'left', fontWeight = 500) {
    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }
  function drawCentered(text, x, y, size = 18, color = Colors.text, fontWeight = 600) {
    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function drawGlow(x, y, radius, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color + 'aa');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Routing helpers
  function navigate(to) {
    if (State.route === to) return;
    State.transition = { active: true, t: 0, from: State.route, to };
  }

  // Input handling
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    State.mouse.x = e.clientX - rect.left;
    State.mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', () => State.mouse.down = true);
  canvas.addEventListener('mouseup', () => State.mouse.down = false);
  window.addEventListener('keydown', (e) => {
    State.keys[e.key] = true;
    if (State.route === 'game') e.preventDefault();
  }, { passive: false });
  window.addEventListener('keyup', (e) => { State.keys[e.key] = false; });
  canvas.addEventListener('touchstart', (e) => {
    State.mouse.down = true;
    if (e.touches && e.touches[0]) {
      const rect = canvas.getBoundingClientRect();
      State.mouse.x = e.touches[0].clientX - rect.left;
      State.mouse.y = e.touches[0].clientY - rect.top;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      const rect = canvas.getBoundingClientRect();
      State.mouse.x = e.touches[0].clientX - rect.left;
      State.mouse.y = e.touches[0].clientY - rect.top;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => State.mouse.down = false);

  // Buttons (canvas-based)
  function button(x, y, w, h, label, options = {}) {
    const { icon = null, hot = false } = options;
    const radius = 14;
    const hovered = State.mouse.x >= x && State.mouse.x <= x + w && State.mouse.y >= y && State.mouse.y <= y + h;
    const bg = hovered ? shade(Colors.card, 1.1) : Colors.card;
    fillRoundedRect(x, y, w, h, radius, bg);
    strokeRoundedRect(x, y, w, h, radius, Colors.cardAccent, 2);

    if (icon) icon(x + 18, y + h / 2, 22);

    drawText(label, x + (icon ? 48 : 20), y + h / 2 + 6, 20, Colors.text);

    if (hot) {
      drawGlow(x + w - 24, y + 24, 16, Colors.accent);
      fillRoundedRect(x + w - 32, y + 12, 16, 8, 4, Colors.accent);
    }

    const clicked = hovered && State.mouse.down;
    return { hovered, clicked };
  }

  function shade(hex, factor) {
    const c = parseInt(hex.slice(1), 16);
    let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    r = Math.min(255, Math.max(0, Math.floor(r * factor)));
    g = Math.min(255, Math.max(0, Math.floor(g * factor)));
    b = Math.min(255, Math.max(0, Math.floor(b * factor)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // TTS (German)
  const TTS = {
    enabled: true,
    voice: null,
    pickVoice() {
      try {
        const voices = speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return;
        // Prefer de-DE voice with name including 'Evan', else any de-DE
        const candidates = voices.filter(v => (v.lang || '').toLowerCase() === 'de-de');
        const evan = candidates.find(v => (v.name || '').toLowerCase().includes('evan'));
        this.voice = evan || candidates[0] || null;
      } catch {}
    },
    speak(text, rate = 0.95) {
      try {
        if (!this.enabled) return;
        if (!this.voice) this.pickVoice();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'de-DE';
        utter.rate = rate;
        if (this.voice) utter.voice = this.voice;
        speechSynthesis.cancel();
        speechSynthesis.speak(utter);
      } catch {}
    },
  };
  // Populate voices when available
  try {
    window.speechSynthesis.onvoiceschanged = () => TTS.pickVoice();
    TTS.pickVoice();
  } catch {}

  // Word bank (A1)
  const WORDS = [
    { de: 'Hallo', en: 'Hello' },
    { de: 'Danke', en: 'Thank you' },
    { de: 'Bitte', en: 'Please/You are welcome' },
    { de: 'Ja', en: 'Yes' },
    { de: 'Nein', en: 'No' },
    { de: 'Guten Morgen', en: 'Good morning' },
    { de: 'Gute Nacht', en: 'Good night' },
    { de: 'Tschüss', en: 'Bye' },
    { de: 'Wie geht’s?', en: 'How are you?' },
    { de: 'Ich heiße SKY', en: 'My name is SKY' },
    { de: 'Ich', en: 'I' },
    { de: 'Du', en: 'You' },
    { de: 'Er', en: 'He' },
    { de: 'Sie', en: 'She/They' },
    { de: 'Wir', en: 'We' },
    { de: 'Es', en: 'It' },
    { de: 'Haus', en: 'House' },
    { de: 'Wasser', en: 'Water' },
    { de: 'Brot', en: 'Bread' },
    { de: 'Milch', en: 'Milk' },
    { de: 'Kaffee', en: 'Coffee' },
    { de: 'Tee', en: 'Tea' },
    { de: 'Apfel', en: 'Apple' },
    { de: 'Käse', en: 'Cheese' },
    { de: 'Katze', en: 'Cat' },
    { de: 'Hund', en: 'Dog' },
    { de: 'Buch', en: 'Book' },
    { de: 'Schule', en: 'School' },
    { de: 'Lehrer', en: 'Teacher' },
    { de: 'Student', en: 'Student' },
    { de: 'Fußball', en: 'Football' },
    { de: 'Auto', en: 'Car' },
    { de: 'Zug', en: 'Train' },
    { de: 'Straße', en: 'Street' },
    { de: 'Stadt', en: 'City' },
    { de: 'Freund', en: 'Friend' },
    { de: 'Familie', en: 'Family' },
    { de: 'Essen', en: 'Food' },
    { de: 'Trinken', en: 'Drink' },
    { de: 'Lernen', en: 'Learn' },
    { de: 'Sprechen', en: 'Speak' },
  ];

  function randomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  // Scenes
  function drawBackground(t) {
    // Animated gradient stars background
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#10122a');
    g.addColorStop(1, '#0b0c1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // floating orbs
    for (let i = 0; i < 6; i++) {
      const ox = (Math.sin(t * 0.0003 + i) * 0.4 + 0.5) * w;
      const oy = (Math.cos(t * 0.00025 + i * 1.3) * 0.4 + 0.5) * h;
      drawGlow(ox, oy, 180 + (i % 3) * 60, i % 2 === 0 ? Colors.primary : Colors.accent);
    }
  }

  function header() {
    const w = canvas.clientWidth;
    drawText('Hallo, SKY 👋', 36, 60, 32, Colors.text, 'left', 700);
    drawText(`Streak: ${progress.streakDays} day(s)`, 36, 90, 16, Colors.textDim);
    drawText(`Cheese eaten: ${progress.totalCheeseEaten}  •  Flashcards: ${progress.flashcardsReviewed}  •  Quiz best: ${progress.quizBest}%`, 36, 112, 14, Colors.textDim);

    // top-right mini menu
    const mw = 180, mh = 44;
    const bx = w - mw - 36, by = 28;
    const b = button(bx, by, mw, mh, 'Diary ✍️');
    if (b.clicked) { State.mouse.down = false; navigate('diary'); }
  }

  function home() {
    header();

    const w = canvas.clientWidth, h = canvas.clientHeight;

    const grid = [
      { label: 'Maus & Käse 🧀', route: 'game', desc: 'Arrow keys. Eat cheese. Learn words.', hot: true },
      { label: 'Flashcards 🗂️', route: 'flashcards', desc: 'A1 essentials with TTS.' },
      { label: 'Quiz ❓', route: 'quiz', desc: 'Quick checks to cement memory.' },
      { label: 'Diary ✍️', route: 'diary', desc: 'Track feelings and notes.' },
    ];

    const cx = w / 2, cy = h / 2 + 20;
    const col = 2, pad = 24, bw = Math.min(360, (w - 36 * 2 - pad) / col), bh = 120;

    grid.forEach((item, i) => {
      const gx = cx - (bw + pad) + (i % 2) * (bw + pad);
      const gy = cy - (bh + pad) + Math.floor(i / 2) * (bh + pad);
      fillRoundedRect(gx, gy, bw, bh, 18, Colors.card);
      strokeRoundedRect(gx, gy, bw, bh, 18, Colors.cardAccent, 2);
      drawText(item.label, gx + 20, gy + 42, 24);
      drawText(item.desc, gx + 20, gy + 72, 16, Colors.textDim);

      // enter button
      const b = button(gx + bw - 132, gy + bh - 56, 112, 40, 'Start ▶', { hot: item.hot });
      if (b.clicked) { State.mouse.down = false; navigate(item.route); }
    });
  }

  // Flashcards
  let flashIndex = 0;
  function flashcards() {
    header();
    const w = canvas.clientWidth, h = canvas.clientHeight;

    const card = WORDS[flashIndex % WORDS.length];
    const cardW = Math.min(520, w - 72);
    const cardH = 300;
    const x = (w - cardW) / 2;
    const y = h / 2 - cardH / 2;

    fillRoundedRect(x, y, cardW, cardH, 20, Colors.card);
    strokeRoundedRect(x, y, cardW, cardH, 20, Colors.cardAccent);

    drawCentered(card.de, w / 2, y + 110, 36);
    drawCentered(card.en, w / 2, y + 170, 20, Colors.textDim);

    const bSpeak = button(x + 24, y + cardH - 64, 120, 44, 'Speak 🔊');
    const bPrev = button(x + cardW / 2 - 160, y + cardH - 64, 120, 44, 'Prev ◀');
    const bNext = button(x + cardW / 2 + 40, y + cardH - 64, 120, 44, 'Next ▶');
    const bBack = button(x + cardW - 124, y + cardH - 64, 100, 44, 'Home');

    if (bSpeak.clicked) {
      State.mouse.down = false;
      TTS.speak(card.de);
      if (!progress.learnedWords.includes(card.de)) progress.learnedWords.push(card.de);
      progress.flashcardsReviewed += 1;
      saveProgress(progress);
    }
    if (bPrev.clicked) { State.mouse.down = false; flashIndex = (flashIndex - 1 + WORDS.length) % WORDS.length; }
    if (bNext.clicked) { State.mouse.down = false; flashIndex = (flashIndex + 1) % WORDS.length; }
    if (bBack.clicked) { State.mouse.down = false; navigate('home'); }
  }

  // Quiz
  let quizState = null;
  function initQuiz() {
    const word = randomWord();
    const options = [word.en];
    while (options.length < 4) {
      const other = WORDS[Math.floor(Math.random() * WORDS.length)].en;
      if (!options.includes(other)) options.push(other);
    }
    // Shuffle options
    options.sort(() => Math.random() - 0.5);
    quizState = { word, options, selected: null, correct: null, score: 0, total: 0 };
  }

  function quiz() {
    if (!quizState) initQuiz();
    header();
    const w = canvas.clientWidth, h = canvas.clientHeight;

    const cardW = Math.min(640, w - 72);
    const cardH = 360;
    const x = (w - cardW) / 2;
    const y = h / 2 - cardH / 2;

    fillRoundedRect(x, y, cardW, cardH, 20, Colors.card);
    strokeRoundedRect(x, y, cardW, cardH, 20, Colors.cardAccent);

    drawCentered(`What does "${quizState.word.de}" mean?`, w / 2, y + 80, 24);

    const bw = cardW - 48;
    quizState.options.forEach((opt, i) => {
      const by = y + 120 + i * 56;
      const b = button(x + 24, by, bw, 44, opt);
      if (b.clicked) {
        State.mouse.down = false;
        const isCorrect = opt === quizState.word.en;
        quizState.selected = opt;
        quizState.correct = isCorrect;
        quizState.total += 1;
        if (isCorrect) quizState.score += 1;
        progress.quizBest = Math.max(progress.quizBest, Math.round((quizState.score / quizState.total) * 100));
        saveProgress(progress);
        // Next question after short delay
        setTimeout(() => initQuiz(), 400);
      }
    });

    const bBack = button(x + cardW - 124, y + cardH - 56, 100, 40, 'Home');
    if (bBack.clicked) { State.mouse.down = false; quizState = null; navigate('home'); }
  }

  // Diary
  let diaryDraft = '';
  function diary() {
    header();
    const w = canvas.clientWidth, h = canvas.clientHeight;

    const cardW = Math.min(800, w - 72);
    const cardH = Math.min(480, h - 180);
    const x = (w - cardW) / 2;
    const y = h / 2 - cardH / 2 + 20;

    fillRoundedRect(x, y, cardW, cardH, 20, Colors.card);
    strokeRoundedRect(x, y, cardW, cardH, 20, Colors.cardAccent);
    drawText('Diary (English or German) – today', x + 20, y + 36, 20);

    // Multiline input simulation
    const padding = 16;
    const textX = x + 20;
    const textY = y + 64;
    const textW = cardW - 40;
    const textH = cardH - 140;

    fillRoundedRect(textX, textY, textW, textH, 14, '#10122a');
    strokeRoundedRect(textX, textY, textW, textH, 14, Colors.cardAccent, 1.5);

    // Render text with wrapping
    renderMultilineText(diaryDraft, textX + padding, textY + padding, textW - padding * 2, 18);

    const bSave = button(x + 20, y + cardH - 56, 120, 40, 'Save 💾');
    const bBack = button(x + cardW - 124, y + cardH - 56, 100, 40, 'Home');

    if (bSave.clicked) {
      State.mouse.down = false;
      const todayISO = new Date().toISOString();
      if (diaryDraft.trim().length > 0) {
        progress.diaryEntries.unshift({ dateISO: todayISO, text: diaryDraft.trim() });
        if (progress.diaryEntries.length > 50) progress.diaryEntries.pop();
        diaryDraft = '';
        saveProgress(progress);
        showToast('Diary saved!');
      } else {
        showToast('Write something first.');
      }
    }
    if (bBack.clicked) { State.mouse.down = false; navigate('home'); }

    // Recent entries sidebar
    const sideW = Math.min(360, w - cardW - 80);
    if (sideW > 220) {
      const sx = x + cardW + 20;
      const sy = y;
      const sh = cardH;
      fillRoundedRect(sx, sy, sideW, sh, 16, Colors.card);
      strokeRoundedRect(sx, sy, sideW, sh, 16, Colors.cardAccent);
      drawText('Recent entries', sx + 16, sy + 32, 18);
      const lineH = 56;
      const max = Math.floor((sh - 64) / lineH);
      progress.diaryEntries.slice(0, max).forEach((e, i) => {
        const dy = sy + 56 + i * lineH;
        drawText(new Date(e.dateISO).toLocaleDateString(), sx + 16, dy, 14, Colors.textDim);
        drawText(e.text.slice(0, 28) + (e.text.length > 28 ? '…' : ''), sx + 16, dy + 18, 16);
      });
    }
  }

  // Text input capture for diary
  window.addEventListener('keydown', (e) => {
    if (State.route !== 'diary') return;
    if (e.key === 'Backspace') {
      diaryDraft = diaryDraft.slice(0, -1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      diaryDraft += '\n';
      e.preventDefault();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      diaryDraft += e.key;
      e.preventDefault();
    }
  });

  function renderMultilineText(text, x, y, maxWidth, fontSize) {
    ctx.fillStyle = Colors.text;
    ctx.font = `500 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = [];
    const paragraphs = text.split('\n');
    paragraphs.forEach((para) => {
      const words = para.split(' ');
      let line = '';
      words.forEach((word) => {
        const test = line.length ? line + ' ' + word : word;
        const width = ctx.measureText(test).width;
        if (width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      lines.push(line);
    });

    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * (fontSize + 6));
    });
  }

  // Maus & Käse (Snake-like)
  const game = {
    gridSize: 24,
    cols: 0,
    rows: 0,
    cells: [],
    mouseBody: [], // array of {x,y}
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    cheese: { x: 0, y: 0 },
    movedAt: 0,
    speedMs: 140,
    alive: true,
    score: 0,
    announceCooldown: 0,
    currentWord: null,
  };

  function resetGame() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    game.cols = Math.floor((w - 72) / game.gridSize);
    game.rows = Math.floor((h - 160) / game.gridSize);
    const sx = Math.floor(game.cols / 2);
    const sy = Math.floor(game.rows / 2);
    game.mouseBody = [{ x: sx, y: sy }];
    game.dir = { x: 1, y: 0 };
    game.nextDir = { x: 1, y: 0 };
    game.cheese = spawnFood();
    game.movedAt = 0;
    game.speedMs = 140;
    game.alive = true;
    game.score = 0;
    game.currentWord = null;
  }

  function spawnFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * game.cols),
        y: Math.floor(Math.random() * game.rows),
      };
    } while (game.mouseBody.some(p => p.x === pos.x && p.y === pos.y));
    return pos;
  }

  function handleGameInput() {
    if (State.keys.ArrowUp && game.dir.y !== 1) game.nextDir = { x: 0, y: -1 };
    else if (State.keys.ArrowDown && game.dir.y !== -1) game.nextDir = { x: 0, y: 1 };
    else if (State.keys.ArrowLeft && game.dir.x !== 1) game.nextDir = { x: -1, y: 0 };
    else if (State.keys.ArrowRight && game.dir.x !== -1) game.nextDir = { x: 1, y: 0 };
  }

  function stepGame(now) {
    if (!game.alive) return;
    if (now - game.movedAt < game.speedMs) return;
    game.movedAt = now;
    game.dir = game.nextDir;

    const head = { ...game.mouseBody[0] };
    head.x += game.dir.x;
    head.y += game.dir.y;

    // wrap around edges for smoother play
    if (head.x < 0) head.x = game.cols - 1;
    if (head.x >= game.cols) head.x = 0;
    if (head.y < 0) head.y = game.rows - 1;
    if (head.y >= game.rows) head.y = 0;

    // collision with self
    if (game.mouseBody.some((p) => p.x === head.x && p.y === head.y)) {
      game.alive = false;
      return;
    }

    game.mouseBody.unshift(head);

    // cheese
    if (head.x === game.cheese.x && head.y === game.cheese.y) {
      game.score += 1;
      progress.totalCheeseEaten += 1;
      const w = randomWord();
      game.currentWord = w;
      if (!progress.learnedWords.includes(w.de)) progress.learnedWords.push(w.de);
      saveProgress(progress);
      TTS.speak(`${w.de}. ${w.en}`);
      // increase speed slightly
      game.speedMs = Math.max(70, game.speedMs - 4);
      game.cheese = spawnFood();
    } else {
      game.mouseBody.pop();
    }
  }

  function drawGame() {
    header();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const boardX = 36, boardY = 140;
    const boardW = game.cols * game.gridSize;
    const boardH = game.rows * game.gridSize;

    fillRoundedRect(boardX - 8, boardY - 8, boardW + 16, boardH + 16, 18, Colors.card);
    strokeRoundedRect(boardX - 8, boardY - 8, boardW + 16, boardH + 16, 18, Colors.cardAccent);

    // grid
    ctx.strokeStyle = '#1d203f';
    ctx.lineWidth = 1;
    for (let i = 0; i <= game.cols; i++) {
      const x = boardX + i * game.gridSize;
      ctx.beginPath();
      ctx.moveTo(x, boardY);
      ctx.lineTo(x, boardY + boardH);
      ctx.stroke();
    }
    for (let j = 0; j <= game.rows; j++) {
      const y = boardY + j * game.gridSize;
      ctx.beginPath();
      ctx.moveTo(boardX, y);
      ctx.lineTo(boardX + boardW, y);
      ctx.stroke();
    }

    // cheese
    drawCheese(boardX + game.cheese.x * game.gridSize, boardY + game.cheese.y * game.gridSize, game.gridSize);

    // mouse body
    for (let i = game.mouseBody.length - 1; i >= 0; i--) {
      const seg = game.mouseBody[i];
      const x = boardX + seg.x * game.gridSize;
      const y = boardY + seg.y * game.gridSize;
      const size = game.gridSize - 4;
      const r = Math.min(10, size / 2);
      fillRoundedRect(x + 2, y + 2, size, size, r, i === 0 ? Colors.accent : Colors.primary);
    }

    // HUD
    drawText(`Score: ${game.score}`, boardX, boardY - 16, 16, Colors.textDim);

    // current word overlay
    if (game.currentWord) {
      const label = `${game.currentWord.de} – ${game.currentWord.en}`;
      const bw = Math.min(420, w - 72);
      const bx = (w - bw) / 2;
      const by = boardY - 44;
      fillRoundedRect(bx, by - 26, bw, 32, 12, '#131533');
      drawCentered(label, w / 2, by - 10, 16, Colors.text);
    }

    const bBack = button(boardX + boardW - 120, boardY - 44, 100, 32, 'Home');
    if (bBack.clicked) { State.mouse.down = false; navigate('home'); }

    if (!game.alive) {
      const overlayW = 360, overlayH = 220;
      const ox = (w - overlayW) / 2, oy = (h - overlayH) / 2;
      fillRoundedRect(ox, oy, overlayW, overlayH, 18, Colors.card);
      strokeRoundedRect(ox, oy, overlayW, overlayH, 18, Colors.cardAccent);
      drawCentered('Maus crashed! 🐭💥', w / 2, oy + 60, 22);
      drawCentered(`Score: ${game.score}`, w / 2, oy + 100, 18, Colors.textDim);
      const bR = button(ox + 20, oy + overlayH - 64, 140, 44, 'Restart');
      const bH = button(ox + overlayW - 160, oy + overlayH - 64, 140, 44, 'Home');
      if (bR.clicked) { State.mouse.down = false; resetGame(); }
      if (bH.clicked) { State.mouse.down = false; navigate('home'); }
    }
  }

  function drawCheese(x, y, size) {
    const s = size - 6;
    const px = x + 3, py = y + 3;
    ctx.fillStyle = '#ffdb70';
    ctx.beginPath();
    ctx.moveTo(px, py + s);
    ctx.lineTo(px + s, py + s);
    ctx.lineTo(px + s, py);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e3b94e';
    ctx.beginPath();
    ctx.arc(px + s * 0.3, py + s * 0.6, s * 0.1, 0, Math.PI * 2);
    ctx.arc(px + s * 0.6, py + s * 0.3, s * 0.08, 0, Math.PI * 2);
    ctx.arc(px + s * 0.7, py + s * 0.75, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Toasts
  function showToast(message, duration = 1400) {
    State.toast = { message, until: performance.now() + duration };
  }
  function drawToast(now) {
    if (!State.toast) return;
    if (now > State.toast.until) { State.toast = null; return; }
    const w = canvas.clientWidth;
    const msg = State.toast.message;
    const bw = Math.min(480, w - 80);
    const bx = (w - bw) / 2;
    const by = 24;
    fillRoundedRect(bx, by, bw, 40, 10, '#15183aee');
    drawCentered(msg, w / 2, by + 20, 16);
  }

  // Transitions
  function drawTransition() {
    if (!State.transition.active) return false;
    State.transition.t += 0.06;
    const t = Math.min(1, State.transition.t);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = `rgba(10,12,24,${Math.sin(t * Math.PI)})`;
    ctx.fillRect(0, 0, w, h);
    if (t >= 1) {
      State.route = State.transition.to;
      State.transition.active = false;
      if (State.route === 'game') { try { canvas.focus(); } catch {} ; resetGame(); }
    }
    return true;
  }

  // Main loop
  function loop(now) {
    State.now = now;
    drawBackground(now);

    switch (State.route) {
      case 'home':
        home();
        break;
      case 'flashcards':
        flashcards();
        break;
      case 'quiz':
        quiz();
        break;
      case 'diary':
        diary();
        break;
      case 'game':
        handleGameInput();
        stepGame(now);
        drawGame();
        break;
    }

    drawToast(now);
    if (!drawTransition()) {
      // draw route title floating tag
      const tag = `Deutsch for SKY – ${State.route}`;
      const w = canvas.clientWidth;
      fillRoundedRect(w - 240, 20, 220, 26, 10, '#14163a');
      drawText(tag, w - 230, 39, 12, Colors.textDim);
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();