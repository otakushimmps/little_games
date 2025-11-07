(() => {
  'use strict';

  const board = document.getElementById('board');
  const ctx = board.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('high');
  const speedEl = document.getElementById('speed');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const modeSelect = document.getElementById('modeSelect');
  const playerNameEl = document.getElementById('playerName');
  const leaderboardEl = document.getElementById('leaderboard');

  // ---------- constants ----------
  const CELL = 20;
  const VIEW_COLS = Math.floor(board.width / CELL);
  const VIEW_ROWS = Math.floor(board.height / CELL);
  let WORLD_COLS = VIEW_COLS;
  let WORLD_ROWS = VIEW_ROWS;

  const STORAGE_KEY = 'snake.highscore.v1';
  const NAME_KEY = 'snake.playerName.v1';
  const BASE_TICK_MS = 140;
  const MIN_TICK_MS = Math.floor(BASE_TICK_MS / 1.5);

  const INFINITE_WORLD_SCALE = 10;
  const INFINITE_FOOD_BATCH = 9;
  const INFINITE_FOOD_CAP = 50;
  const INFINITE_FOOD_SPAWN_TICKS = 18;
  const VERSUS_FOOD_BASELINE = 3;
  const NORMAL_FOOD_BASELINE = 1;
  const INFINITE_MAX_AIS = 10;
  const AI_GLOBAL_SPAWN_TICKS = 45;
  const AI_SPAWN_DELAY_TICKS = 30;

  const FOOD_YELLOW = '#f6d14b';
  function shade(hex, percent) {
    const normalized = hex.replace('#', '');
    const num = parseInt(normalized, 16);
    const amt = Math.round(2.55 * percent);
    const clamp255 = v => Math.min(255, Math.max(0, v));
    const r = clamp255((num >> 16) + amt);
    const g = clamp255(((num >> 8) & 0xff) + amt);
    const b = clamp255((num & 0xff) + amt);
    return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
  }
  const FOOD_SHADES = { 1: FOOD_YELLOW, 2: shade(FOOD_YELLOW, -10), 5: shade(FOOD_YELLOW, -20), 10: shade(FOOD_YELLOW, -35) };

  const AI_COLORS = ['#60a5fa', '#22d3ee', '#06b6d4', '#14b8a6', '#10b981', '#34d399', '#84cc16', '#8b5cf6', '#a78bfa', '#d946ef', '#f472b6', '#fb7185', '#f43f5e', '#ef4444'];
  let aiColorCursor = 0;
  function pickNextColor(used = new Set()) {
    const taken = new Set(Array.from(used).map(c => String(c).toLowerCase()));
    for (let i = 0; i < AI_COLORS.length; i++) {
      const idx = (aiColorCursor + i) % AI_COLORS.length;
      const c = AI_COLORS[idx];
      if (!taken.has(c.toLowerCase())) { aiColorCursor = (idx + 1) % AI_COLORS.length; return c; }
    }
    const fallback = AI_COLORS[aiColorCursor % AI_COLORS.length];
    aiColorCursor = (aiColorCursor + 1) % AI_COLORS.length;
    return fallback;
  }

  const DIR = {
    ArrowUp: { x: 0, y: -1, name: 'up' },
    ArrowDown: { x: 0, y: 1, name: 'down' },
    ArrowLeft: { x: -1, y: 0, name: 'left' },
    ArrowRight: { x: 1, y: 0, name: 'right' },
    KeyW: { x: 0, y: -1, name: 'up' },
    KeyS: { x: 0, y: 1, name: 'down' },
    KeyA: { x: -1, y: 0, name: 'left' },
    KeyD: { x: 1, y: 0, name: 'right' },
  };

  // ---------- state ----------
  const state = {
    snake: [],
    dir: DIR.ArrowRight,
    nextDir: DIR.ArrowRight,
    foods: [],
    obstacles: [],
    score: 0,
    eatenByValue: {},
    high: Number(localStorage.getItem(STORAGE_KEY) || 0),
    tickMs: BASE_TICK_MS,
    running: false,
    timer: null,
    mode: 'normal',
    cam: { x: 0, y: 0 },
    ais: [],
    foodSpawnCd: 0,
    aiGlobalSpawnCd: 0,
    playerName: '',
    controlsEnabled: false,
    deaths: 0,
    growQueue: 0,
  };
  highEl.textContent = String(state.high);

  // ---------- utils ----------
  function normalizeMode(val) { const s = String(val || '').toLowerCase(); if (s.includes('inf')) return 'infinite'; if (s.includes('ver')) return 'versus'; return 'normal'; }
  function randInt(n) { return (Math.random() * n) | 0; }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function scheduleTick() { if (state.timer) clearTimeout(state.timer); state.timer = setTimeout(tick, state.tickMs); }
  function finalizeFrame() { maintainFoodBaseline(); updateCamera(); draw(); updateLeaderboard(); scheduleTick(); }

  function getCss(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function drawCell(x, y, color) {
    const pad = 2; const sx = x - state.cam.x; const sy = y - state.cam.y;
    if (sx < 0 || sy < 0 || sx >= VIEW_COLS || sy >= VIEW_ROWS) return;
    ctx.fillStyle = color; const rx = sx * CELL + pad; const ry = sy * CELL + pad; const size = CELL - pad * 2;
    roundRect(ctx, rx, ry, size, size, 4, true, false);
  }
  function drawCellRect(x, y, color) {
    const pad = 2; const sx = x - state.cam.x; const sy = y - state.cam.y;
    if (sx < 0 || sy < 0 || sx >= VIEW_COLS || sy >= VIEW_ROWS) return;
    ctx.fillStyle = color; const rx = sx * CELL + pad; const ry = sy * CELL + pad; const size = CELL - pad * 2;
    ctx.fillRect(rx, ry, size, size);
  }
  function roundRect(context, x, y, width, height, radius = 4, fill = true, stroke = false) {
    const r = Math.max(0, radius);
    if (typeof context.roundRect === 'function') { context.beginPath(); context.roundRect(x, y, width, height, r); }
    else { const rr = Math.min(r, width / 2, height / 2); context.beginPath(); context.moveTo(x + rr, y); context.lineTo(x + width - rr, y); context.quadraticCurveTo(x + width, y, x + width, y + rr); context.lineTo(x + width, y + height - rr); context.quadraticCurveTo(x + width, y + height, x + width - rr, y + height); context.lineTo(x + rr, y + height); context.quadraticCurveTo(x, y + height, x, y + height - rr); context.lineTo(x, y + rr); context.quadraticCurveTo(x, y, x + rr, y); }
    if (fill) context.fill(); if (stroke) context.stroke();
  }

  // ---------- world setup ----------
  function reset() {
    state.mode = normalizeMode(modeSelect?.value || 'normal');
    if (state.mode === 'infinite') { WORLD_COLS = VIEW_COLS * INFINITE_WORLD_SCALE; WORLD_ROWS = VIEW_ROWS * INFINITE_WORLD_SCALE; }
    else { WORLD_COLS = VIEW_COLS; WORLD_ROWS = VIEW_ROWS; }

    if (state.mode === 'infinite') { const cx = (WORLD_COLS / 2) | 0; const cy = (WORLD_ROWS / 2) | 0; state.snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }]; }
    else { state.snake = [{ x: 6, y: 12 }, { x: 5, y: 12 }, { x: 4, y: 12 }]; }
    state.dir = DIR.ArrowRight; state.nextDir = DIR.ArrowRight;

    state.obstacles = state.mode === 'infinite' ? generateObstacles() : [];
    state.foods = [];
    if (state.mode === 'infinite') { for (let i = 0; i < INFINITE_FOOD_BATCH; i++) state.foods.push(spawnFoodWithRules()); state.foodSpawnCd = INFINITE_FOOD_SPAWN_TICKS; }
    else { const count = state.mode === 'versus' ? VERSUS_FOOD_BASELINE : NORMAL_FOOD_BASELINE; for (let i = 0; i < count; i++) state.foods.push(spawnFood(1)); }

    state.score = 0; state.eatenByValue = {}; state.tickMs = BASE_TICK_MS; state.deaths = 0; state.growQueue = 0;
    updateCamera();

    state.ais = [];
    if (state.mode === 'infinite') { refillAIs(INFINITE_MAX_AIS, true); state.aiGlobalSpawnCd = AI_GLOBAL_SPAWN_TICKS; }
    else if (state.mode === 'versus') { state.ais.push(makeInactiveAI()); }

    scoreEl.textContent = '0'; updateSpeedLabel(); draw(); updateLeaderboard();
  }

  function generateObstacles() {
    const obs = []; const count = 30;
    for (let i = 0; i < count; i++) {
      const w = 1 + randInt(6), h = 1 + randInt(6);
      const x = clamp(randInt(WORLD_COLS - w - 1) + 1, 0, WORLD_COLS - w);
      const y = clamp(randInt(WORLD_ROWS - h - 1) + 1, 0, WORLD_ROWS - h);
      const type = Math.random() < 0.4 ? 'pool' : 'rock';
      const px = state.snake[0]?.x || 0; const py = state.snake[0]?.y || 0;
      if (x - 6 <= px && px <= x + w + 6 && y - 6 <= py && py <= y + h + 6) continue;
      obs.push({ x, y, w, h, type });
    }
    return obs;
  }

  // ---------- food ----------
  function foodColor(v) { return FOOD_SHADES[v] || FOOD_SHADES[1]; }
  function spawnFood(val = 1) {
    for (let i = 0; i < 500; i++) { const x = randInt(WORLD_COLS), y = randInt(WORLD_ROWS); if (!isBlocked(x, y) && !isOccupied(x, y)) return { x, y, v: val }; }
    return { x: 0, y: 0, v: val };
  }
  function countFoodsByValue() { const map = {}; for (const f of state.foods) { const v = f.v || 1; map[v] = (map[v] || 0) + 1; } return map; }
  function currentMaxPoints() { let max = state.score; for (const ai of state.ais) max = Math.max(max, ai.points || 0); return max; }
  function spawnFoodWithRules() {
    const maxPoints = currentMaxPoints(); const counts = countFoodsByValue(); const choices = []; const push = (v, w) => choices.push({ v, w });
    push(1, 6); if (maxPoints > 20 && (counts[2] || 0) < 15) push(2, 5); if (maxPoints > 50 && (counts[5] || 0) < 8) push(5, 3); if (maxPoints > 100 && (counts[10] || 0) < 3) push(10, 1);
    const total = choices.reduce((s, c) => s + c.w, 0); let r = Math.random() * total; for (const c of choices) { r -= c.w; if (r <= 0) return spawnFood(c.v); }
    return spawnFood(1);
  }

  function maintainFoodBaseline() {
    if (state.mode === 'infinite') {
      state.foodSpawnCd -= 1; if (state.foodSpawnCd <= 0 && state.foods.length < INFINITE_FOOD_CAP) { const remain = INFINITE_FOOD_CAP - state.foods.length; const batch = Math.min(INFINITE_FOOD_BATCH, remain); for (let i = 0; i < batch; i++) state.foods.push(spawnFoodWithRules()); state.foodSpawnCd = INFINITE_FOOD_SPAWN_TICKS; }
      state.aiGlobalSpawnCd -= 1; if (state.aiGlobalSpawnCd <= 0) { const active = state.ais.filter(ai => ai.active).length; if (active < INFINITE_MAX_AIS) { refillAIs(active + 1, true); } state.aiGlobalSpawnCd = AI_GLOBAL_SPAWN_TICKS; }
    } else { const baseline = state.mode === 'versus' ? VERSUS_FOOD_BASELINE : NORMAL_FOOD_BASELINE; while (state.foods.length < baseline) state.foods.push(spawnFood(1)); }
  }

  // ---------- AI ----------
  function makeInactiveAI() { return { id: nextAiId(), name: aiName(), points: 0, active: false, snake: [], dir: DIR.ArrowLeft, nextDir: DIR.ArrowLeft, spawnCd: AI_SPAWN_DELAY_TICKS, eatenByValue: {}, growQueue: 0, deaths: 0, color: pickNextColor(new Set([getCss('--snake') || '#34d399'])) }; }
  let aiCounter = 1; function nextAiId() { return aiCounter++; }
  function aiName() { return `AI-${(Math.random() * 900 | 0) + 100}`; }
  function spawnSnakeBody(length) {
    const dirs = [DIR.ArrowUp, DIR.ArrowDown, DIR.ArrowLeft, DIR.ArrowRight];
    for (let attempt = 0; attempt < 600; attempt++) {
      const head = { x: randInt(WORLD_COLS), y: randInt(WORLD_ROWS) };
      if (isBlocked(head.x, head.y) || isOccupied(head.x, head.y)) continue;
      const dir = dirs[randInt(dirs.length)]; const body = [head]; let ok = true;
      for (let i = 1; i < length; i++) { const nx = head.x - dir.x * i, ny = head.y - dir.y * i; if (nx < 0 || ny < 0 || nx >= WORLD_COLS || ny >= WORLD_ROWS) { ok = false; break; } if (isBlocked(nx, ny) || isOccupied(nx, ny)) { ok = false; break; } body.push({ x: nx, y: ny }); }
      if (ok) return { body, dir };
    }
    return { body: [{ x: 1, y: 1 }], dir: DIR.ArrowRight };
  }
  function spawnAI(opts = {}) {
    const length = opts.length || 3; const build = spawnSnakeBody(length);
    return { id: opts.id || nextAiId(), name: opts.name || aiName(), points: opts.points || 0, active: true, snake: build.body, dir: build.dir, nextDir: build.dir, spawnCd: AI_SPAWN_DELAY_TICKS, eatenByValue: { ...(opts.eatenByValue || {}) }, growQueue: opts.growQueue || 0, deaths: opts.deaths || 0, color: opts.color || pickNextColor(new Set()) };
  }
  function refillAIs(target, fresh) {
    const used = new Set(); const playerColor = (getCss('--snake') || '#34d399').trim(); used.add(playerColor.toLowerCase());
    for (const ai of state.ais) if (ai.color) used.add(String(ai.color).toLowerCase());
    while (state.ais.length < target) { const color = pickNextColor(used); used.add(color.toLowerCase()); const ai = spawnAI({ color }); if (!fresh) ai.spawnCd = AI_SPAWN_DELAY_TICKS; state.ais.push(ai); }
  }

  function dist(a, b) { if (!a || !b) return Infinity; return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function isOccupied(x, y) { if (state.snake.some(seg => seg.x === x && seg.y === y)) return true; for (const ai of state.ais) { if (!ai.active) continue; if (ai.snake.some(seg => seg.x === x && seg.y === y)) return true; } return false; }
  function isBlocked(x, y) { return state.obstacles.some(o => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h); }
  function collidesWall(pos) { return pos.x < 0 || pos.y < 0 || pos.x >= WORLD_COLS || pos.y >= WORLD_ROWS; }

  function openNeighbors(x, y) { let c = 0; if (x > 0 && !isBlocked(x - 1, y)) c++; if (x + 1 < WORLD_COLS && !isBlocked(x + 1, y)) c++; if (y > 0 && !isBlocked(x, y - 1)) c++; if (y + 1 < WORLD_ROWS && !isBlocked(x, y + 1)) c++; return c; }
  function foodDesirability(x, y) { let best = -Infinity; for (const f of state.foods) { const val = f.v || 1; const d = Math.abs(f.x - x) + Math.abs(f.y - y); const s = val * 6 - d * 1.2; if (s > best) best = s; } return best === -Infinity ? 0 : best; }
  function decideAiNext(ai) {
    const head = ai.snake[0]; const candidates = [];
    for (const dir of [DIR.ArrowUp, DIR.ArrowDown, DIR.ArrowLeft, DIR.ArrowRight]) {
      const nx = head.x + dir.x, ny = head.y + dir.y; if (nx < 0 || ny < 0 || nx >= WORLD_COLS || ny >= WORLD_ROWS) continue;
      const second = ai.snake[1]; if (second && nx === second.x && ny === second.y) continue; candidates.push(dir);
    }
    if (!candidates.length) return head;
    let bestDir = candidates[0], bestScore = -Infinity;
    for (const dir of candidates) { const nx = head.x + dir.x, ny = head.y + dir.y; let s = 0; s += foodDesirability(nx, ny); if (ai.snake.length > state.snake.length) s += 6 - dist({ x: nx, y: ny }, state.snake[0]); s += openNeighbors(nx, ny) * 0.2; s += Math.random() * 0.1; if (s > bestScore) { bestScore = s; bestDir = dir; } }
    ai.nextDir = bestDir; return { x: head.x + bestDir.x, y: head.y + bestDir.y };
  }

  // ---------- game loop ----------
  function start() { if (state.running) return; state.controlsEnabled = true; state.running = true; scheduleTick(); }
  function pause() { state.running = false; if (state.timer) clearTimeout(state.timer); state.timer = null; }

  function tick() {
    if (!state.running) return;
    if (state.mode !== 'normal') for (const ai of state.ais) { if (!ai.active) { ai.spawnCd -= 1; if (ai.spawnCd <= 0) Object.assign(ai, spawnAI({ id: ai.id, name: ai.name, color: ai.color })); } }

    // lock direction (no back into second)
    const head = state.snake[0], second = state.snake[1], desired = state.nextDir;
    if (!second || head.x + desired.x !== second.x || head.y + desired.y !== second.y) state.dir = desired;

    const next = { x: head.x + state.dir.x, y: head.y + state.dir.y };

    // lethal: wall / obstacle
    if (collidesWall(next)) { handlePlayerDeath(); finalizeFrame(); return; }
    if (isBlocked(next.x, next.y)) { handlePlayerDeath(); finalizeFrame(); return; }

    // check AI interactions before moving player
    if (state.mode !== 'normal') {
      for (let i = 0; i < state.ais.length; i++) {
        const ai = state.ais[i]; if (!ai.active) continue; const aiNext = decideAiNext(ai);
        // head-to-head resolution
        if (aiNext && next.x === aiNext.x && next.y === aiNext.y) { resolveHeadToHead(ai, i); finalizeFrame(); return; }
        // head (player) -> AI body: head dies
        if (ai.snake.some(seg => seg.x === next.x && seg.y === next.y)) { ai.points = (ai.points || 0) + 5; resolveBodyCollision(ai, i); finalizeFrame(); return; }
        ai.pendingMove = aiNext;
      }
    }

    // move player
    state.snake.unshift(next);

    // eat food
    const foodIdx = state.foods.findIndex(f => f.x === next.x && f.y === next.y);
    if (foodIdx >= 0) {
      const foodVal = state.foods[foodIdx].v || 1; state.foods[foodIdx] = state.mode === 'infinite' ? spawnFoodWithRules() : spawnFood(1);
      state.score += foodVal; scoreEl.textContent = String(state.score); state.eatenByValue[foodVal] = (state.eatenByValue[foodVal] || 0) + 1; state.growQueue += 1;
      if (state.tickMs > MIN_TICK_MS && state.score % 4 === 0) { state.tickMs = Math.max(MIN_TICK_MS, state.tickMs - 8); updateSpeedLabel(); }
    }

    if (state.growQueue > 0) state.growQueue -= 1; else state.snake.pop();

    // move AIs
    if (state.mode !== 'normal') {
      for (let i = 0; i < state.ais.length; i++) {
        const ai = state.ais[i]; if (!ai.active || !ai.pendingMove) continue; const move = ai.pendingMove; delete ai.pendingMove;
        if (collidesWall(move) || isBlocked(move.x, move.y)) { defeatAI(i); continue; }
        // self-pass allowed; do not check ai self
        // AI head -> player body: head dies
        if (state.snake.some(seg => seg.x === move.x && seg.y === move.y)) { state.score += 5; scoreEl.textContent = String(state.score); state.growQueue += 1; defeatAI(i); continue; }
        // AI head -> other AI body: head dies, other gets +5
        let collidedOther = false;
        for (let j = 0; j < state.ais.length; j++) { if (i === j) continue; const other = state.ais[j]; if (!other.active) continue; if (other.snake.some(seg => seg.x === move.x && seg.y === move.y)) { other.points = (other.points || 0) + 5; defeatAI(i); collidedOther = true; break; } }
        if (collidedOther) continue;
        ai.snake.unshift(move); ai.dir = ai.nextDir;
        const foodIdxAI = state.foods.findIndex(f => f.x === move.x && f.y === move.y);
        if (foodIdxAI >= 0) { const val = state.foods[foodIdxAI].v || 1; state.foods[foodIdxAI] = state.mode === 'infinite' ? spawnFoodWithRules() : spawnFood(1); ai.eatenByValue[val] = (ai.eatenByValue[val] || 0) + 1; ai.points = (ai.points || 0) + val; ai.growQueue = (ai.growQueue || 0) + 1; }
        if (ai.growQueue > 0) ai.growQueue -= 1; else ai.snake.pop();
      }
    }

    finalizeFrame();
  }

  function resolveHeadToHead(ai, index) {
    const playerLen = state.snake.length, aiLen = ai.snake.length;
    if (playerLen > aiLen) { defeatAI(index, true); state.score += 5; scoreEl.textContent = String(state.score); state.growQueue += 1; }
    else if (playerLen < aiLen) { ai.points += 5; handlePlayerDeath(); }
    else { defeatAI(index, false); handlePlayerDeath(); }
  }
  function resolveBodyCollision(ai, index) { handlePlayerDeath(); }

  // ---------- death / respawn ----------
  function splitCounts(map, ratio) {
    const drop = {}, keep = {}; let total = 0; const frac = [];
    for (const k of Object.keys(map || {})) { const count = map[k] | 0; total += count; const exact = count * ratio; const d = Math.floor(exact); drop[k] = d; keep[k] = count - d; frac.push({ k, frac: exact - d }); }
    let need = Math.floor(total * ratio) - Object.values(drop).reduce((a, b) => a + b, 0); frac.sort((a, b) => b.frac - a.frac);
    let idx = 0; while (need > 0 && frac.length) { const item = frac[idx % frac.length]; drop[item.k] = (drop[item.k] || 0) + 1; keep[item.k] = (keep[item.k] || 0) - 1; need--; idx++; }
    return { drop, keep };
  }
  function sumCounts(map) { let s = 0; for (const k of Object.keys(map || {})) s += map[k] | 0; return s; }
  function dropFoodsOverShapeWithValues(cells, valueCounts) {
    if (!cells || !cells.length) return; const entries = [];
    for (const key of Object.keys(valueCounts || {})) { const val = Number(key), count = valueCounts[key] | 0; for (let i = 0; i < count; i++) entries.push(val); }
    entries.sort((a, b) => b - a); const used = new Set(); let idx = 0;
    for (let i = 0; i < cells.length && idx < entries.length; i++) { const cell = cells[i]; const key = `${cell.x},${cell.y}`; if (used.has(key) || isBlocked(cell.x, cell.y)) continue; state.foods.push({ x: cell.x, y: cell.y, v: entries[idx], expireAt: Date.now() + 30000 }); used.add(key); idx++; }
  }
  function handlePlayerDeath() {
    state.deaths = (state.deaths || 0) + 1; const parts = splitCounts(state.eatenByValue || {}, 0.7);
    dropFoodsOverShapeWithValues(state.snake, parts.drop);
    const keepTotal = sumCounts(parts.keep); const body = spawnSnakeBody(3);
    state.snake = body.body; state.dir = body.dir; state.nextDir = body.dir; state.eatenByValue = parts.keep; state.growQueue = Math.max(0, keepTotal);
  }
  function defeatAI(index, reward) {
    const ai = state.ais[index]; if (!ai || !ai.active) return;
    const parts = splitCounts(ai.eatenByValue || {}, 0.7); dropFoodsOverShapeWithValues(ai.snake, parts.drop);
    const keepTotal = sumCounts(parts.keep);
    state.ais[index] = spawnAI({ id: ai.id, name: ai.name, points: reward ? ai.points : ai.points, eatenByValue: parts.keep, growQueue: Math.max(0, keepTotal), deaths: (ai.deaths || 0) + 1, color: ai.color });
  }

  // ---------- camera / draw ----------
  function updateCamera() { const head = state.snake[0]; if (!head) return; let cx = head.x - Math.floor(VIEW_COLS / 2); let cy = head.y - Math.floor(VIEW_ROWS / 2); cx = clamp(cx, 0, Math.max(0, WORLD_COLS - VIEW_COLS)); cy = clamp(cy, 0, Math.max(0, WORLD_ROWS - VIEW_ROWS)); state.cam.x = cx; state.cam.y = cy; }
  function drawRect(x, y, w, h, color) { const left = Math.max(x, state.cam.x); const top = Math.max(y, state.cam.y); const right = Math.min(x + w, state.cam.x + VIEW_COLS); const bottom = Math.min(y + h, state.cam.y + VIEW_ROWS); if (right <= left || bottom <= top) return; ctx.fillStyle = color; const sx = (left - state.cam.x) * CELL; const sy = (top - state.cam.y) * CELL; const sw = (right - left) * CELL; const sh = (bottom - top) * CELL; ctx.fillRect(sx, sy, sw, sh); }
  function drawWorldBorder() {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
    const vx0 = state.cam.x, vy0 = state.cam.y, vx1 = state.cam.x + VIEW_COLS, vy1 = state.cam.y + VIEW_ROWS;
    if (vy0 <= 0) { ctx.beginPath(); ctx.moveTo(0, (0 - vy0) * CELL + 1.5); ctx.lineTo(board.width, (0 - vy0) * CELL + 1.5); ctx.stroke(); }
    if (vy1 >= WORLD_ROWS) { ctx.beginPath(); ctx.moveTo(0, (WORLD_ROWS - vy0) * CELL - 1.5); ctx.lineTo(board.width, (WORLD_ROWS - vy0) * CELL - 1.5); ctx.stroke(); }
    if (vx0 <= 0) { ctx.beginPath(); ctx.moveTo(1.5, 0); ctx.lineTo(1.5, board.height); ctx.stroke(); }
    if (vx1 >= WORLD_COLS) { const x = (WORLD_COLS - vx0) * CELL - 1.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, board.height); ctx.stroke(); }
    ctx.restore();
  }
  function draw(showGameOver = false) {
    ctx.clearRect(0, 0, board.width, board.height); drawWorldBorder();
    for (const o of state.obstacles) drawRect(o.x, o.y, o.w, o.h, o.type === 'pool' ? '#3b82f6' : '#64748b');
    for (const f of state.foods) drawCell(f.x, f.y, foodColor(f.v || 1));
    let snakeBase = (getCss('--snake') || '#34d399').trim() || '#34d399'; const yellowBlock = ['#f6d14b', '#f59e0b', '#eab308', '#facc15']; if (yellowBlock.includes(snakeBase.toLowerCase())) snakeBase = '#34d399';
    for (let i = 0; i < state.snake.length; i++) { const seg = state.snake[i]; if (i === 0) { drawCell(seg.x, seg.y, shade(snakeBase, -10)); } else { drawCellRect(seg.x, seg.y, snakeBase); } }
    if (state.mode !== 'normal') for (const ai of state.ais) { if (!ai.active) continue; const base = ai.color || '#60a5fa'; for (let i = 0; i < ai.snake.length; i++) { const seg = ai.snake[i]; if (i === 0) drawCell(seg.x, seg.y, shade(base, -10)); else drawCellRect(seg.x, seg.y, ((i + (ai.id || 0)) % 2 === 0) ? shade(base, -12) : shade(base, 8)); } }
    updateSpeedLabel();
  }

  // ---------- UI ----------
  function updateSpeedLabel() { speedEl.textContent = `${(BASE_TICK_MS / state.tickMs).toFixed(1)}x`; }
  function escHtml(str) { return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function updateLeaderboard() {
    if (!leaderboardEl) return; if (!state.playerName) state.playerName = (localStorage.getItem(NAME_KEY) || '').trim();
    const entries = []; const playerColor = getCss('--snake') || '#34d399'; entries.push({ name: state.playerName || 'You', points: state.score, len: state.snake.length, deaths: state.deaths || 0, color: playerColor });
    for (const ai of state.ais) { if (!ai.active) continue; entries.push({ name: ai.name, points: ai.points || 0, len: ai.snake.length, deaths: ai.deaths || 0, color: ai.color || '#60a5fa' }); }
    entries.sort((a, b) => b.points - a.points);
    const rows = ['<h3>Leaderboard</h3>', '<div class="row head"><span>Name</span><span>Score</span><span>Len</span><span>Deaths</span></div>'];
    for (const e of entries) { const sw = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${escHtml(e.color || '#999')};margin-right:6px;"></span>`; rows.push(`<div class="row"><span>${sw}${escHtml(e.name)}</span><span>${e.points}</span><span>${e.len}</span><span>${e.deaths || 0}</span></div>`); }
    leaderboardEl.innerHTML = rows.join('');
  }

  startBtn.addEventListener('click', () => start());
  pauseBtn.addEventListener('click', () => state.running ? pause() : start());
  restartBtn.addEventListener('click', () => { reset(); start(); });
  modeSelect?.addEventListener('change', () => { pause(); reset(); });
  playerNameEl?.addEventListener('change', () => { const v = playerNameEl.value.trim(); state.playerName = v; localStorage.setItem(NAME_KEY, v); updateLeaderboard(); });

  window.addEventListener('keydown', (e) => {
    const target = e.target; const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (target && target.isContentEditable)) return;
    if (!state.controlsEnabled) return;
    if (e.code === 'Space') { state.running ? pause() : start(); e.preventDefault(); return; }
    if (e.code === 'KeyR') { reset(); start(); e.preventDefault(); return; }
    const dir = DIR[e.code]; if (dir) { state.nextDir = dir; e.preventDefault(); }
  });

  // Mobile controls: tap zones on the canvas
  function actByTap(pxCss, pyCss) {
    const rect = board.getBoundingClientRect();
    const scaleX = board.width / rect.width;
    const scaleY = board.height / rect.height;
    const x = (pxCss - rect.left) * scaleX;
    const y = (pyCss - rect.top) * scaleY;

    const cx = board.width / 2, cy = board.height / 2;
    const dx = x - cx, dy = y - cy;
    const dist = Math.hypot(dx, dy);
    const centerR = Math.min(board.width, board.height) * 0.18; // center circle ~18%

    if (dist <= centerR) {
      state.running ? pause() : start();
      return;
    }
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx >= ady) {
      state.nextDir = dx > 0 ? DIR.ArrowRight : DIR.ArrowLeft;
    } else {
      state.nextDir = dy > 0 ? DIR.ArrowDown : DIR.ArrowUp;
    }
  }

  // Mobile swipe on canvas
  let touchStart = null;
  function onTouchStart(ev) {
    const t = ev.touches ? ev.touches[0] : ev;
    touchStart = { x: t.clientX, y: t.clientY, handled: false };
  }
  function onTouchMove(ev) {
    if (!touchStart || touchStart.handled || !state.controlsEnabled) return;
    const t = ev.touches ? ev.touches[0] : ev;
    const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const TH = 24; // px threshold
    if (adx < TH && ady < TH) return;
    if (adx > ady) { state.nextDir = dx > 0 ? DIR.ArrowRight : DIR.ArrowLeft; }
    else { state.nextDir = dy > 0 ? DIR.ArrowDown : DIR.ArrowUp; }
    touchStart.handled = true;
    ev.preventDefault();
  }
  function onTouchEnd(ev) {
    // Treat as a tap if not handled as swipe
    if (touchStart && !touchStart.handled) {
      const t = (ev.changedTouches && ev.changedTouches[0]) ? ev.changedTouches[0] : (ev.touches ? ev.touches[0] : null);
      const px = t ? t.clientX : touchStart.x; const py = t ? t.clientY : touchStart.y;
      actByTap(px, py);
    }
    touchStart = null;
  }
  board.addEventListener('touchstart', onTouchStart, { passive: true });
  board.addEventListener('touchmove', onTouchMove, { passive: false });
  board.addEventListener('touchend', onTouchEnd, { passive: true });

  // Also allow mouse click/tap on canvas
  board.addEventListener('click', (e) => { actByTap(e.clientX, e.clientY); });

  // Touch buttons (two-column layout below the board)
  const touchButtons = document.querySelector('.touch');
  if (touchButtons) {
    touchButtons.addEventListener('click', (e) => {
      if (!state.controlsEnabled) return;
      const btn = e.target.closest('button[data-dir]');
      if (!btn) return;
      const val = String(btn.getAttribute('data-dir') || '').toLowerCase();
      const mapping = { up: DIR.ArrowUp, down: DIR.ArrowDown, left: DIR.ArrowLeft, right: DIR.ArrowRight };
      const d = mapping[val]; if (d) state.nextDir = d;
    });
  }

  // init
  state.playerName = (localStorage.getItem(NAME_KEY) || '').trim(); if (playerNameEl) playerNameEl.value = state.playerName;
  reset();
})();
