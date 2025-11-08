(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const board = $('#board');
  const ui = {
    start: $('#startBtn'),
    pause: $('#pauseBtn'),
    score: $('#score'),
    time: $('#time'),
    hits: $('#hits'),
    shots: $('#shots'),
    boardSize: $('#boardSize'),
    difficulty: $('#difficulty'),
    duration: $('#duration')
  };

  const state = {
    running: false,
    paused: false,
    score: 0,
    hits: 0,
    shots: 0,
    timeLeft: 60,
    holes: [],
    timers: new Set(),
    popTimer: 0,
    config: {
      // 放慢整體節奏：出現間隔與停留時間皆延長
      easy:   { popMs: [1400, 1900], friendChance: 0.16, upMs: [1200, 1600] },
      normal: { popMs: [1100, 1500], friendChance: 0.20, upMs: [900, 1300] },
      hard:   { popMs: [800, 1200],  friendChance: 0.24, upMs: [750, 1000] }
    }
  };

  function rand(min, max){ return Math.floor(Math.random()*(max-min+1))+min }
  function choose(arr){ return arr[Math.floor(Math.random()*arr.length)] }

  function setText(el, v){ el.textContent = String(v) }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)) }

  function clearTimers(){
    for(const t of state.timers){ clearTimeout(t); clearInterval(t) }
    state.timers.clear();
    if (state.popTimer) { clearInterval(state.popTimer); state.popTimer = 0 }
  }

  function computeGrid(){
    const val = ui.boardSize?.value || '3x3';
    let cols = 3, rows = 3;
    if (val === '4x3') { cols = 4; rows = 3; }
    if (val === '4x4') { cols = 4; rows = 4; }
    // 若選 4x3 且為直立（高>寬），自動轉成 3x4
    const portrait = window.innerHeight > window.innerWidth;
    if (val === '4x3' && portrait) { [cols, rows] = [3, 4]; }
    return { cols, rows };
  }

  function buildBoard(){
    board.innerHTML = '';
    state.holes.length = 0;
    const { cols, rows } = computeGrid();
    board.style.setProperty('--cols', String(cols));
    board.style.setProperty('--rows', String(rows));
    const total = Number(cols) * Number(rows);
    for(let i=0;i<total;i++){
      const hole = document.createElement('button');
      hole.className = 'hole';
      hole.setAttribute('aria-label','hole');
      hole.innerHTML = '<span class="label"></span>'+
        '<div class="mole" hidden><span class="emoji" aria-hidden="true">🐭</span></div>'+
        '<div class="friend" hidden><span class="emoji" aria-hidden="true">🐥</span></div>'+
        '<div class="pit"></div>';
      hole.addEventListener('pointerdown', onHit);
      board.appendChild(hole);
      state.holes.push({ el: hole, up: false, kind: null });
    }
  }

  function start(){
    if (state.running) { reset(); }
    state.running = true; state.paused = false;
    state.score = 0; state.hits = 0; state.shots = 0;
    state.timeLeft = parseInt(ui.duration.value, 10) || 60;
    buildBoard();
    updateHud();
    tickCountdown();
    scheduleNextPop();
  }

  function reset(){
    clearTimers();
    state.running = false; state.paused = false;
    $$('.hole').forEach(h => h.classList.remove('up'));
  }

  function pause(){
    if (!state.running) return;
    state.paused = !state.paused;
    if (state.paused) clearTimers(); else { tickCountdown(); scheduleNextPop(); }
    ui.pause.textContent = state.paused ? '繼續' : '暫停';
  }

  function updateHud(){
    setText(ui.score, state.score);
    setText(ui.time, clamp(state.timeLeft,0,999));
    setText(ui.hits, state.hits);
    setText(ui.shots, state.shots);
  }

  function tickCountdown(){
    const t = setInterval(() => {
      if (!state.running || state.paused) return;
      state.timeLeft -= 1;
      updateHud();
      if (state.timeLeft <= 0){ endGame(); }
    }, 1000);
    state.timers.add(t);
  }

  function scheduleNextPop(){
    const diff = state.config[ui.difficulty.value] || state.config.normal;
    const [minPop, maxPop] = diff.popMs;
    const delay = rand(minPop, maxPop);
    state.popTimer = setTimeout(() => {
      if (state.running && !state.paused){
        const index = rand(0, state.holes.length-1);
        const hole = state.holes[index];
        if (!hole.up){
          const friend = Math.random() < diff.friendChance;
          pop(hole, friend ? 'friend' : 'mole', rand(diff.upMs[0], diff.upMs[1]));
        }
      }
      scheduleNextPop();
    }, delay);
    state.timers.add(state.popTimer);
  }

  function pop(hole, kind, showMs){
    hole.up = true; hole.kind = kind;
    hole.el.classList.add('up');
    $('.mole', hole.el).hidden = kind !== 'mole';
    $('.friend', hole.el).hidden = kind !== 'friend';
    $('.label', hole.el).textContent = kind === 'mole' ? '鼠' : '雞';
    const t = setTimeout(() => hide(hole), showMs);
    state.timers.add(t);
  }

  function hide(hole){
    hole.up = false; hole.kind = null;
    hole.el.classList.remove('up');
    $('.mole', hole.el).hidden = true;
    $('.friend', hole.el).hidden = true;
    $('.label', hole.el).textContent = '';
  }

  function onHit(e){
    if (!state.running || state.paused) return;
    state.shots++;
    const holeEl = e.currentTarget;
    const hole = state.holes.find(h => h.el === holeEl);
    if (hole && hole.up){
      if (hole.kind === 'mole'){
        state.score += 1; state.hits += 1;
        hide(hole);
      } else if (hole.kind === 'friend'){
        state.score -= 1; // gentle penalty
        hide(hole);
      }
    } else {
      // miss click: no change (keeps kid-friendly)
    }
    updateHud();
  }

  function endGame(){
    clearTimers();
    state.running = false; state.paused = false;
    alert(`時間到！\n分數：${state.score}\n命中率：${state.shots?Math.round(100*state.hits/state.shots):0}%`);
  }

  // Wire events
  ui.start.addEventListener('click', start);
  ui.pause.addEventListener('click', pause);
  ui.boardSize?.addEventListener('change', () => buildBoard());
  window.addEventListener('resize', () => buildBoard(), { passive:true });

  // First render
  buildBoard();
  updateHud();
})();
