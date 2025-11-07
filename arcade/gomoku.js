(() => {
  'use strict';
  const boardEl = document.getElementById('gomokuBoard');
  if (!boardEl) return;
  const ctx = boardEl.getContext('2d');
  const turnEl = document.getElementById('turn');
  const resultEl = document.getElementById('result');
  const newBtn = document.getElementById('newGame');
  const undoBtn = document.getElementById('undo');

  // config
  const SIZE = 15;                   // 15x15
  const MARGIN = 28;                 // px outer margin
  const CELL = Math.floor((boardEl.width - MARGIN * 2) / (SIZE - 1));
  const R = Math.floor(CELL * 0.42); // stone radius

  const state = {
    grid: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)), // 0 empty, 1 black, 2 white
    turn: 1,
    over: false,
    last: null,   // {x,y}
    winLine: null,// [{x,y}...]
    history: [],  // moves stack
  };

  function reset() {
    state.grid.forEach(row => row.fill(0));
    state.turn = 1; state.over = false; state.last = null; state.winLine = null; state.history = [];
    turnEl.textContent = '黑子'; resultEl.textContent = '—';
    draw();
  }

  function xyFromEvent(e) {
    const rect = boardEl.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    // find nearest grid point
    const gx = Math.round((px - MARGIN) / CELL);
    const gy = Math.round((py - MARGIN) / CELL);
    return { x: gx, y: gy };
  }

  function inBounds(x, y) { return x >= 0 && y >= 0 && x < SIZE && y < SIZE; }

  function place(x, y) {
    if (!inBounds(x, y) || state.over) return;
    if (state.grid[y][x] !== 0) return;
    state.grid[y][x] = state.turn;
    state.last = { x, y };
    state.history.push({ x, y });
    if (checkWin(x, y, state.turn)) { state.over = true; resultEl.textContent = state.turn === 1 ? '黑勝' : '白勝'; }
    else { state.turn = state.turn === 1 ? 2 : 1; turnEl.textContent = state.turn === 1 ? '黑子' : '白子'; }
    draw();
  }

  function undo() {
    if (!state.history.length || state.over) return;
    const last = state.history.pop(); state.grid[last.y][last.x] = 0; state.last = state.history[state.history.length-1]||null;
    state.turn = state.turn === 1 ? 2 : 1; turnEl.textContent = state.turn === 1 ? '黑子' : '白子';
    state.winLine = null; resultEl.textContent = '—'; state.over = false;
    draw();
  }

  function checkWin(x, y, who) {
    const dirs = [ [1,0], [0,1], [1,1], [1,-1] ];
    for (const [dx,dy] of dirs) {
      let count = 1; const cells = [{x,y}];
      // forward
      let i=1; while (inBounds(x+dx*i,y+dy*i) && state.grid[y+dy*i][x+dx*i]===who) { cells.push({x:x+dx*i,y:y+dy*i}); count++; i++; }
      // backward
      i=1; while (inBounds(x-dx*i,y-dy*i) && state.grid[y-dy*i][x-dx*i]===who) { cells.unshift({x:x-dx*i,y:y-dy*i}); count++; i++; }
      if (count>=5) { state.winLine = cells.slice(0,5); return true; }
    }
    return false;
  }

  function draw() {
    ctx.clearRect(0,0,boardEl.width,boardEl.height);
    // background
    ctx.fillStyle = '#0b1320'; ctx.fillRect(0,0,boardEl.width,boardEl.height);
    // grid
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    for (let i=0;i<SIZE;i++) {
      const x = MARGIN + i*CELL; const y0 = MARGIN, y1 = MARGIN + (SIZE-1)*CELL;
      ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke();
      const y = MARGIN + i*CELL; const x0 = MARGIN, x1 = MARGIN + (SIZE-1)*CELL;
      ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    }
    // star points for 15x15
    const stars = [3,7,11];
    ctx.fillStyle = '#64748b';
    stars.forEach(ix=>stars.forEach(iy=>{ const sx = MARGIN + ix*CELL, sy = MARGIN + iy*CELL; ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fill(); }));
    // stones
    for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
      const v = state.grid[y][x]; if (!v) continue; const cx = MARGIN + x*CELL, cy=MARGIN + y*CELL;
      const rad = R;
      const gradient = ctx.createRadialGradient(cx-6,cy-6,4,cx,cy,rad);
      if (v===1) { gradient.addColorStop(0,'#ffffff22'); gradient.addColorStop(1,'#111827'); }
      else { gradient.addColorStop(0,'#f3f4f6'); gradient.addColorStop(1,'#cbd5e1'); }
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2); ctx.fill();
    }
    // last move highlight
    if (state.last) { const cx = MARGIN + state.last.x*CELL, cy = MARGIN + state.last.y*CELL; ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx,cy,R+4,0,Math.PI*2); ctx.stroke(); }
    // win line
    if (state.winLine) { ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.beginPath(); const p0 = state.winLine[0]; ctx.moveTo(MARGIN+p0.x*CELL, MARGIN+p0.y*CELL); for (let i=1;i<state.winLine.length;i++){ const p=state.winLine[i]; ctx.lineTo(MARGIN+p.x*CELL, MARGIN+p.y*CELL);} ctx.stroke(); }
  }

  boardEl.addEventListener('click', (e)=>{ const {x,y}=xyFromEvent(e); place(x,y); });
  newBtn.addEventListener('click', reset);
  undoBtn.addEventListener('click', undo);

  reset();
})();
