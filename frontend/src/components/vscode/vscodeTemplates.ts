// Готовые интерактивные шаблоны проектов (HTML+CSS+JS+картинки, Python)
// и встроенный банк практических задач с автопроверкой для VS Code редактора.

export interface TemplateFile {
  name: string
  content: string
  lang: string
}

export interface VSCodeTemplate {
  id: string
  title: string
  desc: string
  tags: string[]
  entryFile: string
  files: TemplateFile[]
}

export interface AutoTestItem {
  label?: string
  input?: string
  expected?: string
  hidden?: boolean
  type?: 'contains' | 'tag' | 'attr' | 'css_prop' | 'regex'
  value?: string
}

export interface PracticeCodeTask {
  id: string | number
  builtin?: boolean
  title: string
  description: string
  language: 'python' | 'javascript' | 'html' | 'css'
  starter_code: string
  max_score: number
  classroom?: number | null
  classroom_title?: string
  tests_count?: number
  tests?: AutoTestItem[]
  public_tests?: AutoTestItem[]
  my_best_score?: number | null
  my_passed?: boolean
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`
}

const IMG_AVATAR = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs>
  <rect width="160" height="160" rx="80" fill="url(#bg)"/>
  <circle cx="80" cy="62" r="28" fill="#cbd5e1"/>
  <path d="M32 142c6-30 26-44 48-44s42 14 48 44" fill="#94a3b8"/>
</svg>
`)

const IMG_COVER = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="0.6" stop-color="#1e3a8a"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs>
  <rect width="640" height="240" fill="url(#g)"/>
  <path d="M0 190 L140 110 L270 175 L410 85 L540 160 L640 115 L640 240 L0 240 Z" fill="rgba(255,255,255,0.08)"/>
  <path d="M0 210 L190 140 L330 200 L490 120 L640 185 L640 240 L0 240 Z" fill="rgba(255,255,255,0.06)"/>
</svg>
`)

const IMG_ROCKET = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M32 6 C42 18 44 34 42 48 L22 48 C20 34 22 18 32 6 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="2.5"/>
  <path d="M32 6 C37 12 39 18 40 22 L24 22 C25 18 27 12 32 6 Z" fill="#ef4444"/>
  <circle cx="32" cy="31" r="6" fill="#38bdf8" stroke="#0284c7" stroke-width="2"/>
  <path d="M22 38 L12 50 L22 48 Z" fill="#ef4444"/>
  <path d="M42 38 L52 50 L42 48 Z" fill="#ef4444"/>
  <path d="M26 48 L32 60 L38 48 Z" fill="#f59e0b"/>
</svg>
`)

const IMG_STAR = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <polygon points="24,4 29.8,16.5 43.5,18.2 33.4,27.8 36,41.4 24,34.7 12,41.4 14.6,27.8 4.5,18.2 18.2,16.5" fill="#facc15" stroke="#ca8a04" stroke-width="2" stroke-linejoin="round"/>
</svg>
`)

const IMG_MOUNTAINS = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#sky)"/>
  <circle cx="325" cy="56" r="24" fill="#fde047"/>
  <polygon points="0,260 110,95 225,260" fill="#334155"/>
  <polygon points="110,95 82,138 110,126 138,138" fill="#ffffff"/>
  <polygon points="145,260 270,70 400,260" fill="#1e293b"/>
  <polygon points="270,70 236,122 270,108 304,122" fill="#f8fafc"/>
  <rect y="220" width="400" height="40" fill="#0f766e"/>
</svg>
`)

const IMG_COSMOS = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
  <defs><linearGradient id="sp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#sp)"/>
  <circle cx="70" cy="50" r="2" fill="#fff"/><circle cx="150" cy="35" r="1.5" fill="#fff"/><circle cx="330" cy="48" r="2" fill="#fde047"/><circle cx="290" cy="210" r="1.8" fill="#fff"/><circle cx="55" cy="195" r="2" fill="#93c5fd"/>
  <ellipse cx="205" cy="135" rx="115" ry="28" fill="none" stroke="#93c5fd" stroke-width="6" opacity="0.65" transform="rotate(-14 205 135)"/>
  <circle cx="205" cy="135" r="46" fill="#f97316"/>
  <path d="M162 125 Q205 112 248 125" fill="none" stroke="#fed7aa" stroke-width="5" opacity="0.7"/>
</svg>
`)

const IMG_OCEAN = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
  <defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#fef08a"/></linearGradient></defs>
  <rect width="400" height="150" fill="url(#sun)"/>
  <circle cx="200" cy="138" r="36" fill="#fff7ed"/>
  <rect y="140" width="400" height="120" fill="#0369a1"/>
  <path d="M0 165 Q50 155 100 165 T200 165 T300 165 T400 165" fill="none" stroke="#38bdf8" stroke-width="5"/>
  <path d="M0 198 Q50 188 100 198 T200 198 T300 198 T400 198" fill="none" stroke="#7dd3fc" stroke-width="4" opacity="0.7"/>
</svg>
`)

export const VSCODE_TEMPLATES: VSCodeTemplate[] = [
  {
    id: 'card-portfolio',
    title: 'Визитка с обложкой и аватаром',
    desc: 'Современная карточка профиля: загрузка картинок через HTML <img> и CSS background-image + смена темы на JS.',
    tags: ['HTML', 'CSS', 'JS', 'IMG'],
    entryFile: 'index.html',
    files: [
      {
        name: 'index.html',
        lang: 'html',
        content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Моя визитка</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="card">
    <div class="cover"></div>
    <div class="body">
      <img src="avatar.svg" alt="Аватар" class="avatar" />
      <div class="row">
        <div>
          <h1>Алихан С.</h1>
          <p class="role">Ученик • Web & Python разработчик</p>
        </div>
        <button id="themeBtn" type="button">Тёмная тема</button>
      </div>
      <p class="bio">Изучаю HTML, CSS, JavaScript и базы данных PostgreSQL. Загрузи своё фото и поменяй src="avatar.svg" на имя своей картинки!</p>
      <div class="skills">
        <span>HTML5</span><span>CSS3</span><span>JavaScript</span><span>Python</span>
      </div>
      <div class="actions">
        <button id="likeBtn" type="button" class="primary">Поддержать (<span id="likes">12</span>)</button>
      </div>
    </div>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        name: 'style.css',
        lang: 'css',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
  background: #f1f5f9;
  color: #0f172a;
  transition: background .25s, color .25s;
}
body.dark { background: #0f172a; color: #f8fafc; }
.card {
  width: 100%;
  max-width: 460px;
  border-radius: 20px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}
body.dark .card { background: #1e293b; border-color: #334155; }
.cover {
  height: 135px;
  background-image: url('cover.svg');
  background-size: cover;
  background-position: center;
}
.body { padding: 0 24px 24px; }
.avatar {
  width: 84px; height: 84px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  margin-top: -42px;
  object-fit: cover;
  background: #1e293b;
}
body.dark .avatar { border-color: #1e293b; }
.row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-top: 10px; }
h1 { font-size: 22px; }
.role { font-size: 13px; color: #64748b; margin-top: 2px; }
body.dark .role { color: #94a3b8; }
.bio { font-size: 14px; line-height: 1.55; margin-top: 14px; color: #334155; }
body.dark .bio { color: #cbd5e1; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.skills span {
  padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
  background: #e2e8f0; color: #1e293b;
}
body.dark .skills span { background: #334155; color: #e2e8f0; }
button {
  padding: 8px 14px; border-radius: 10px; border: 1px solid #cbd5e1;
  background: transparent; color: inherit; font-weight: 600; font-size: 13px; cursor: pointer;
}
.actions { margin-top: 18px; }
.primary { width: 100%; background: #2563eb; color: #fff; border-color: #2563eb; padding: 11px; }
.primary:hover { background: #1d4ed8; }`,
      },
      {
        name: 'app.js',
        lang: 'javascript',
        content: `const themeBtn = document.getElementById('themeBtn');
const likeBtn = document.getElementById('likeBtn');
const likesEl = document.getElementById('likes');
let likes = 12;

themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  themeBtn.textContent = isDark ? 'Светлая тема' : 'Тёмная тема';
  console.log('Тема переключена:', isDark ? 'dark' : 'light');
});

likeBtn.addEventListener('click', () => {
  likes += 1;
  likesEl.textContent = String(likes);
  console.log('Лайков:', likes);
});`,
      },
      { name: 'avatar.svg', lang: 'image', content: IMG_AVATAR },
      { name: 'cover.svg', lang: 'image', content: IMG_COVER },
    ],
  },
  {
    id: 'canvas-game',
    title: 'Мини-игра на Canvas с картинками',
    desc: 'Аркада «Собери звёзды»: загрузка rocket.svg и star.svg через JS new Image(), управление стрелками и касанием.',
    tags: ['HTML', 'CSS', 'JS', 'Canvas', 'IMG'],
    entryFile: 'index.html',
    files: [
      {
        name: 'index.html',
        lang: 'html',
        content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Собери звёзды</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="wrap">
    <div class="hud">
      <span>Счёт: <b id="score">0</b></span>
      <button id="restartBtn" type="button">Сначала</button>
    </div>
    <canvas id="game" width="420" height="320"></canvas>
    <div class="controls">
      <button type="button" id="leftBtn">◀ Влево</button>
      <button type="button" id="rightBtn">Вправо ▶</button>
    </div>
    <p class="hint">Управление: стрелки ◀ ▶ на клавиатуре или кнопки снизу</p>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        name: 'style.css',
        lang: 'css',
        content: `body {
  margin: 0; min-height: 100vh; display: grid; place-items: center;
  background: #0b1120; color: #f8fafc; font-family: system-ui, sans-serif; padding: 12px;
}
.wrap { width: 100%; max-width: 440px; text-align: center; }
.hud { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 16px; }
canvas {
  width: 100%; height: auto; border-radius: 14px;
  border: 2px solid #1e293b; background: #0f172a; display: block;
}
.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
button {
  padding: 10px 14px; border-radius: 10px; border: 1px solid #334155;
  background: #1e293b; color: #f8fafc; font-weight: 700; cursor: pointer;
}
button:active { background: #2563eb; }
.hint { margin-top: 8px; font-size: 12px; color: #94a3b8; }`,
      },
      {
        name: 'app.js',
        lang: 'javascript',
        content: `const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

// Загружаем картинки проекта прямо в JavaScript!
const rocketImg = new Image();
rocketImg.src = 'rocket.svg';

const starImg = new Image();
starImg.src = 'star.svg';

let score = 0;
const player = { x: 185, y: 252, w: 48, h: 48, speed: 5 };
const keys = { left: false, right: false };
let stars = [];

function spawnStar() {
  stars.push({ x: Math.random() * (canvas.width - 34), y: -32, size: 32, vy: 2 + Math.random() * 2 });
}

function reset() {
  score = 0;
  scoreEl.textContent = '0';
  player.x = 185;
  stars = [];
  for (let i = 0; i < 3; i++) spawnStar();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

const bindHold = (id, side) => {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', () => (keys[side] = true));
  el.addEventListener('pointerup', () => (keys[side] = false));
  el.addEventListener('pointerleave', () => (keys[side] = false));
};
bindHold('leftBtn', 'left');
bindHold('rightBtn', 'right');
document.getElementById('restartBtn').addEventListener('click', reset);

function loop() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (keys.left) player.x = Math.max(4, player.x - player.speed);
  if (keys.right) player.x = Math.min(canvas.width - player.w - 4, player.x + player.speed);

  if (Math.random() < 0.03) spawnStar();

  stars = stars.filter((st) => {
    st.y += st.vy;
    const hit =
      st.x < player.x + player.w - 6 &&
      st.x + st.size > player.x + 6 &&
      st.y < player.y + player.h - 6 &&
      st.y + st.size > player.y + 6;
    if (hit) {
      score += 10;
      scoreEl.textContent = String(score);
      return false;
    }
    if (starImg.complete) ctx.drawImage(starImg, st.x, st.y, st.size, st.size);
    return st.y < canvas.height + 20;
  });

  if (rocketImg.complete) ctx.drawImage(rocketImg, player.x, player.y, player.w, player.h);
  requestAnimationFrame(loop);
}

reset();
loop();`,
      },
      { name: 'rocket.svg', lang: 'image', content: IMG_ROCKET },
      { name: 'star.svg', lang: 'image', content: IMG_STAR },
    ],
  },
  {
    id: 'calculator',
    title: 'Калькулятор с историей',
    desc: 'Интерактивный калькулятор на CSS Grid и JavaScript с поддержкой клавиатуры и списком вычислений.',
    tags: ['HTML', 'CSS', 'JS'],
    entryFile: 'index.html',
    files: [
      {
        name: 'index.html',
        lang: 'html',
        content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Калькулятор</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="calc">
    <div id="expr" class="expr"></div>
    <input id="display" value="0" readonly />
    <div class="keys">
      <button data-act="clear" class="fn">C</button>
      <button data-act="back" class="fn">⌫</button>
      <button data-val="%" class="fn">%</button>
      <button data-val="/" class="op">÷</button>
      <button data-val="7">7</button><button data-val="8">8</button><button data-val="9">9</button><button data-val="*" class="op">×</button>
      <button data-val="4">4</button><button data-val="5">5</button><button data-val="6">6</button><button data-val="-" class="op">−</button>
      <button data-val="1">1</button><button data-val="2">2</button><button data-val="3">3</button><button data-val="+" class="op">+</button>
      <button data-val="0" class="wide">0</button><button data-val=".">.</button><button data-act="eq" class="eq">=</button>
    </div>
    <ul id="history" class="history"></ul>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        name: 'style.css',
        lang: 'css',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { min-height: 100vh; display: grid; place-items: center; background: #0f172a; font-family: system-ui, sans-serif; padding: 16px; }
.calc { width: 100%; max-width: 320px; background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 18px; color: #fff; }
.expr { min-height: 20px; text-align: right; color: #94a3b8; font-size: 13px; margin-bottom: 4px; }
#display { width: 100%; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 12px; padding: 14px; font-size: 28px; font-weight: 700; text-align: right; margin-bottom: 14px; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
button { height: 52px; border: 0; border-radius: 12px; background: #334155; color: #fff; font-size: 18px; font-weight: 600; cursor: pointer; }
button:hover { filter: brightness(1.12); }
.fn { background: #475569; }
.op { background: #2563eb; }
.eq { background: #10b981; }
.wide { grid-column: span 2; }
.history { list-style: none; margin-top: 14px; max-height: 90px; overflow-y: auto; font-size: 12px; color: #cbd5e1; }
.history li { padding: 4px 0; border-top: 1px solid #334155; text-align: right; }`,
      },
      {
        name: 'app.js',
        lang: 'javascript',
        content: `const display = document.getElementById('display');
const exprEl = document.getElementById('expr');
const historyEl = document.getElementById('history');
let current = '';

// Безопасный парсер арифметических выражений (+, -, *, /, %, скобки) без eval/Function
function safeCalc(expr) {
  const tokens = String(expr).replace(/\\s+/g, '').match(/(\\d+\\.?\\d*|\\.\\d+|[-()+*/%])/g);
  if (!tokens || tokens.join('') !== String(expr).replace(/\\s+/g, '')) {
    throw new Error('Некорректный ввод');
  }
  let pos = 0;
  function parseExpr() {
    let val = parseTerm();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  }
  function parseTerm() {
    let val = parseFactor();
    while (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%') {
      const op = tokens[pos++];
      const right = parseFactor();
      if ((op === '/' || op === '%') && right === 0) throw new Error('Деление на 0');
      val = op === '*' ? val * right : op === '/' ? val / right : val % right;
    }
    return val;
  }
  function parseFactor() {
    if (tokens[pos] === '+') { pos++; return parseFactor(); }
    if (tokens[pos] === '-') { pos++; return -parseFactor(); }
    if (tokens[pos] === '(') {
      pos++;
      const val = parseExpr();
      if (tokens[pos] !== ')') throw new Error('Скобки');
      pos++;
      return val;
    }
    const num = Number(tokens[pos++]);
    if (Number.isNaN(num)) throw new Error('Число');
    return num;
  }
  const result = parseExpr();
  if (pos !== tokens.length || !Number.isFinite(result)) throw new Error('Ошибка');
  return result;
}

function update(v) {
  current = v;
  display.value = current || '0';
}

function evaluateCurrent() {
  if (!current) return;
  try {
    const res = Number(safeCalc(current).toFixed(8));
    exprEl.textContent = current + ' =';
    const li = document.createElement('li');
    li.textContent = current + ' = ' + res;
    historyEl.prepend(li);
    update(String(res));
  } catch {
    display.value = 'Ошибка';
    current = '';
  }
}

document.querySelector('.keys').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  const val = btn.dataset.val;
  if (act === 'clear') { exprEl.textContent = ''; update(''); return; }
  if (act === 'back') { update(current.slice(0, -1)); return; }
  if (act === 'eq') { evaluateCurrent(); return; }
  if (val) update(current + val);
});

window.addEventListener('keydown', (e) => {
  if ('0123456789+-*/.%()'.includes(e.key)) { update(current + e.key); }
  else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); evaluateCurrent(); }
  else if (e.key === 'Backspace') { update(current.slice(0, -1)); }
  else if (e.key === 'Escape') { exprEl.textContent = ''; update(''); }
});`,
      },
    ],
  },
  {
    id: 'photo-gallery',
    title: 'Галерея фото с фильтрами',
    desc: 'Адаптивная сетка фотографий с фильтрацией по категориям и увеличением в модальном окне.',
    tags: ['HTML', 'CSS', 'JS', 'IMG'],
    entryFile: 'index.html',
    files: [
      {
        name: 'index.html',
        lang: 'html',
        content: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Галерея</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <h1>Фотогалерея</h1>
    <div class="tabs">
      <button class="active" data-cat="all">Все</button>
      <button data-cat="nature">Природа</button>
      <button data-cat="space">Космос</button>
    </div>
  </header>
  <section id="grid" class="grid">
    <figure data-cat="nature"><img src="mountains.svg" alt="Горы Ала-Тоо" /><figcaption>Горы Ала-Тоо</figcaption></figure>
    <figure data-cat="space"><img src="cosmos.svg" alt="Сатурн" /><figcaption>Космос и Сатурн</figcaption></figure>
    <figure data-cat="nature"><img src="ocean.svg" alt="Закат на озере" /><figcaption>Закат на воде</figcaption></figure>
  </section>
  <div id="lightbox" class="lightbox hidden">
    <img id="lbImg" alt="" />
    <p id="lbCap"></p>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
      },
      {
        name: 'style.css',
        lang: 'css',
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; }
header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }
.tabs { display: flex; gap: 6px; }
.tabs button { padding: 7px 14px; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-weight: 600; font-size: 13px; }
.tabs button.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
figure { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; cursor: pointer; transition: transform .2s; }
figure:hover { transform: translateY(-3px); }
figure img { width: 100%; height: 150px; object-fit: cover; display: block; }
figcaption { padding: 10px 12px; font-weight: 600; font-size: 14px; }
.hidden { display: none !important; }
.lightbox { position: fixed; inset: 0; background: rgba(15,23,42,.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; color: #fff; }
.lightbox img { max-width: 90%; max-height: 75vh; border-radius: 12px; }`,
      },
      {
        name: 'app.js',
        lang: 'javascript',
        content: `const tabs = document.querySelectorAll('.tabs button');
const cards = document.querySelectorAll('#grid figure');
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCap = document.getElementById('lbCap');

tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabs.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    cards.forEach((c) => {
      c.classList.toggle('hidden', cat !== 'all' && c.dataset.cat !== cat);
    });
  });
});

cards.forEach((c) => {
  c.addEventListener('click', () => {
    const img = c.querySelector('img');
    lbImg.src = img.src;
    lbCap.textContent = c.querySelector('figcaption').textContent;
    lb.classList.remove('hidden');
  });
});

lb.addEventListener('click', () => lb.classList.add('hidden'));`,
      },
      { name: 'mountains.svg', lang: 'image', content: IMG_MOUNTAINS },
      { name: 'cosmos.svg', lang: 'image', content: IMG_COSMOS },
      { name: 'ocean.svg', lang: 'image', content: IMG_OCEAN },
    ],
  },
  {
    id: 'python-stats',
    title: 'Python: Анализ оценок класса',
    desc: 'Готовый учебный скрипт на Python: словари, расчёт среднего балла, поиск отличников и текстовая диаграмма.',
    tags: ['Python'],
    entryFile: 'main.py',
    files: [
      {
        name: 'main.py',
        lang: 'python',
        content: `grades = {
    "Айдана": [5, 5, 4, 5],
    "Алихан": [4, 5, 5, 5],
    "Иван":   [4, 4, 3, 4],
    "Мария":  [5, 4, 5, 5],
}

print("=== Успеваемость класса ===")
best_name, best_avg = "", 0.0

for name, marks in grades.items():
    avg = sum(marks) / len(marks)
    bar = "█" * int(round(avg * 4))
    print(f"{name:<8} | средний: {avg:.2f} | {bar}")
    if avg > best_avg:
        best_name, best_avg = name, avg

print(f"\\nЛидер класса: {best_name} ({best_avg:.2f})")
`,
      },
    ],
  },
]

export const BUILTIN_CODE_TASKS: PracticeCodeTask[] = [
  {
    id: 'builtin-py-sum',
    builtin: true,
    title: 'Сумма двух чисел',
    description: 'Считайте два целых числа (каждое с новой строки через input()) и выведите их сумму.',
    language: 'python',
    starter_code: `a = int(input())\nb = int(input())\n# Выведите сумму a + b\nprint(a + b)\n`,
    max_score: 100,
    tests: [
      { label: 'Тест 1 (2 + 3)', input: '2\n3\n', expected: '5' },
      { label: 'Тест 2 (отрицательные)', input: '-10\n25\n', expected: '15' },
      { label: 'Тест 3 (скрытый)', input: '1234\n5678\n', expected: '6912', hidden: true },
    ],
  },
  {
    id: 'builtin-py-even',
    builtin: true,
    title: 'Чётное или нечётное',
    description: 'Считайте целое число n. Выведите "EVEN", если число чётное, иначе "ODD".',
    language: 'python',
    starter_code: `n = int(input())\n# Проверьте чётность n\n`,
    max_score: 100,
    tests: [
      { label: 'Тест 1 (4)', input: '4\n', expected: 'EVEN' },
      { label: 'Тест 2 (7)', input: '7\n', expected: 'ODD' },
      { label: 'Тест 3 (0)', input: '0\n', expected: 'EVEN' },
      { label: 'Тест 4 (скрытый)', input: '-13\n', expected: 'ODD', hidden: true },
    ],
  },
  {
    id: 'builtin-py-max3',
    builtin: true,
    title: 'Максимум из трёх чисел',
    description: 'Даны три числа (по одному в строке). Выведите наибольшее из них.',
    language: 'python',
    starter_code: `a = int(input())\nb = int(input())\nc = int(input())\n# Выведите максимальное число\n`,
    max_score: 100,
    tests: [
      { label: 'Тест 1', input: '5\n12\n8\n', expected: '12' },
      { label: 'Тест 2 (равные)', input: '7\n7\n7\n', expected: '7' },
      { label: 'Тест 3 (скрытый)', input: '-5\n-2\n-9\n', expected: '-2', hidden: true },
    ],
  },
  {
    id: 'builtin-js-fact',
    builtin: true,
    title: 'Факториал числа (JS)',
    description: 'Напишите функцию factorial(n) и выведите через console.log факториалы для 5 и 7 (каждый с новой строки).',
    language: 'javascript',
    starter_code: `function factorial(n) {\n  // верните n!\n  let res = 1;\n  for (let i = 2; i <= n; i++) res *= i;\n  return res;\n}\n\nconsole.log(factorial(5));\nconsole.log(factorial(7));\n`,
    max_score: 100,
    tests: [
      { label: 'Тест 1 (5! и 7!)', input: '', expected: '120\n5040' },
    ],
  },
  {
    id: 'builtin-html-card',
    builtin: true,
    title: 'Карточка товара (HTML + CSS)',
    description: 'Сверстайте карточку: добавьте заголовок <h1>, изображение <img>, кнопку <button> и скругление углов border-radius в CSS.',
    language: 'html',
    starter_code: `<!DOCTYPE html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8" />\n  <style>\n    .card { padding: 16px; border: 1px solid #cbd5e1; border-radius: 12px; max-width: 320px; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>Учебный ноутбук</h1>\n    <!-- Добавьте тег <img> и <button> -->\n  </div>\n</body>\n</html>`,
    max_score: 100,
    tests: [
      { label: 'Есть заголовок <h1>', type: 'tag', value: 'h1' },
      { label: 'Есть изображение <img>', type: 'tag', value: 'img' },
      { label: 'Есть кнопка <button>', type: 'tag', value: 'button' },
      { label: 'Стилизован border-radius', type: 'css_prop', value: 'border-radius' },
    ],
  },
]
