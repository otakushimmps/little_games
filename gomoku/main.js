(() => {
  'use strict';
  const boardEl = document.getElementById('gomokuBoard');
  if (!boardEl) return;
  const ctx = boardEl.getContext('2d');
  const turnEl = document.getElementById('turn');
  const resultEl = document.getElementById('result');
  const newBtn = document.getElementById('newGame');
  const undoBtn = document.getElementById('undo');
  const difficultyEl = document.getElementById('difficulty');
  const sideEl = document.getElementById('side');

  // config
  const SIZE = 15;
  const MARGIN = 28;
  const CELL = Math.floor((boardEl.width - MARGIN * 2) / (SIZE - 1));
  const R = Math.floor(CELL * 0.42);

  const state = {
    grid: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)), // 0 empty, 1 black, 2 white
    turn: 1,
    over: false,
    last: null,
    winLine: null,
    history: [],
    meta: [],
    player: 1,
    replay: { active:false, idx:-1, timer:null, speedMs:700 },
    overlaySuggestion: null,
  };

  function reset() {
    state.grid.forEach(row => row.fill(0));
    state.turn = 1; state.over = false; state.last = null; state.winLine = null;
    state.history = []; state.meta = []; state.overlaySuggestion = null;
    draw(); updateTurnText(); resultEl.textContent = '—';
    maybeAi();
  }

  function xyFromEvent(e) {
    const rect = boardEl.getBoundingClientRect();
    const px = e.clientX - rect.left; const py = e.clientY - rect.top;
    const gx = Math.round((px - MARGIN) / CELL);
    const gy = Math.round((py - MARGIN) / CELL);
    return { x: gx, y: gy };
  }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < SIZE && y < SIZE; }

  function placeFor(who, x, y) {
    if (!inBounds(x, y) || state.over) return false;
    if (state.grid[y][x] !== 0) return false;
    state.grid[y][x] = who; state.last = { x, y }; state.history.push({ x, y });
    if (checkWin(x, y, who)) { state.over = true; resultEl.textContent = who === 1 ? '黑勝' : '白勝'; }
    else { state.turn = (who === 1 ? 2 : 1); updateTurnText(); }
    draw(); return true;
  }
  function place(x, y) {
    if (state.turn !== state.player) return;
    const aiSide = state.player === 1 ? 2 : 1;
    const sug = pickBySpecFor(aiSide, true);
    const ok = placeFor(state.player, x, y);
    if (!ok) return;
    state.meta.push({ who: state.player, x, y, reason: { rule: 'player' }, suggest: sug });
    maybeAi();
  }
  function undo() {
    if (!state.history.length || state.over) return;
    const last = state.history.pop(); state.grid[last.y][last.x] = 0; state.last = state.history[state.history.length-1]||null;
    state.meta.pop();
    state.turn = state.turn === 1 ? 2 : 1; state.winLine = null; resultEl.textContent = '—'; state.over = false; draw(); updateTurnText();
  }
  function updateTurnText(){ turnEl.textContent = state.turn === 1 ? '黑子' : '白子'; }

  function checkWin(x, y, who) {
    const DIRS = [[1,0],[0,1],[1,1],[1,-1]];
    for (const [dx,dy] of DIRS) {
      let count = 1;
      let i=1; while (inBounds(x+dx*i,y+dy*i) && state.grid[y+dy*i][x+dx*i]===who) { count++; i++; }
      i=1; while (inBounds(x-dx*i,y-dy*i) && state.grid[y-dy*i][x-dx*i]===who) { count++; i++; }
      if (count>=5) return true;
    }
    return false;
  }

  // ==== AI per spec ====
  const DIRS = [[1,0],[0,1],[1,1],[1,-1]];
  const ATTACK_TABLE = { OPEN_FOUR:12000, CLOSED_FOUR:6000, OPEN_THREE:2000, CLOSED_THREE:800, OPEN_TWO:300, CLOSED_TWO:120 };
  const DEF_RATIO = 0.9;
  const ATTACK_WEIGHT = 1.0, DEFENSE_WEIGHT = 0.9;
  const CENTER_BONUS_BASE = 10;

  function neighborsWithin2() {
    const set = new Set(); let hasStone=false;
    for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if (state.grid[y][x]!==0) {
      hasStone=true;
      for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
        const nx=x+dx, ny=y+dy; if (inBounds(nx,ny) && state.grid[ny][nx]===0) set.add(nx+','+ny);
      }
    }
    if (!hasStone) { const c=((SIZE-1)/2)|0; return [{x:c,y:c}]; }
    return Array.from(set).map(s=>{const[a,b]=s.split(',').map(Number); return {x:a,y:b};});
  }

  function countPatternAt(x,y,who) {
    const res = {open4:0, closed4:0, open3:0, closed3:0, open2:0, closed2:0, openThreeCount:0};
    for (const [dx,dy] of DIRS) {
      let cnt = 1; let openEnds = 0;
      let i=1; while(inBounds(x+dx*i,y+dy*i) && state.grid[y+dy*i][x+dx*i]===who){ cnt++; i++; }
      if (inBounds(x+dx*i,y+dy*i) && state.grid[y+dy*i][x+dx*i]===0) openEnds++;
      i=1; while(inBounds(x-dx*i,y-dy*i) && state.grid[y-dy*i][x-dx*i]===who){ cnt++; i++; }
      if (inBounds(x-dx*i,y-dy*i) && state.grid[y-dy*i][x-dx*i]===0) openEnds++;
      if (cnt>=5) { res.open4 += 1; continue; }
      if (cnt===4) { if (openEnds===2) res.open4 += 1; else if (openEnds===1) res.closed4 += 1; }
      else if (cnt===3) { if (openEnds===2) { res.open3 += 1; res.openThreeCount += 1; } else if (openEnds===1) res.closed3 += 1; }
      else if (cnt===2) { if (openEnds===2) res.open2 += 1; else if (openEnds===1) res.closed2 += 1; }
    }
    return res;
  }
  function centerBonus(x,y) { const cx=(SIZE-1)/2, cy=(SIZE-1)/2; const d=Math.abs(cx-x)+Math.abs(cy-y); return CENTER_BONUS_BASE - d; }
  function proximityBonus(x,y,who) { let s=0; for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) { if (!dx&&!dy) continue; const nx=x+dx, ny=y+dy; if (inBounds(nx,ny) && state.grid[ny][nx]===who) s+=2; } return s; }
  function countBlockLinesGE3(x,y,opp) { let blocks=0; for (const [dx,dy] of DIRS) { let a=0,i=1; while(inBounds(x+dx*i,y+dy*i) && state.grid[y+dy*i][x+dx*i]===opp){ a++; i++; } let b=0,j=1; while(inBounds(x-dx*j,y-dy*j) && state.grid[y-dy*j][x-dx*j]===opp){ b++; j++; } if (a+b>=3 && (a>0||b>0)) blocks++; } return blocks; }
  function openFourCountAt(x,y,who) { const p = countPatternAt(x,y,who); return p.open4; }

  function pickBySpecFor(my, wantExplain=false) {
    const opp = my===1?2:1;
    const cands = neighborsWithin2();
    for (const c of cands) { state.grid[c.y][c.x]=my; const win=checkWin(c.x,c.y,my); state.grid[c.y][c.x]=0; if (win) return wantExplain? {move:c, reason:{rule:'instantWin'}} : c; }
    for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if (state.grid[y][x]===0) { state.grid[y][x]=opp; const w=checkWin(x,y,opp); state.grid[y][x]=0; if (w) { const hit = cands.find(c=>c.x===x&&c.y===y); if (hit) return wantExplain? {move:hit, reason:{rule:'blockWin', target:{x,y}}} : hit; } }
    let bestDouble = null; let bestDoubleCenter = Infinity;
    for (const c of cands) { state.grid[c.y][c.x]=my; const cnt = openFourCountAt(c.x,c.y,my); state.grid[c.y][c.x]=0; if (cnt>=2) { const d=Math.abs((SIZE-1)/2-c.x)+Math.abs((SIZE-1)/2-c.y); if (d<bestDoubleCenter) { bestDoubleCenter=d; bestDouble=c; } } }
    if (bestDouble) return wantExplain? {move:bestDouble, reason:{rule:'doubleOpenFour'}} : bestDouble;
    let bestBlock=null, bestOppCnt=Infinity;
    for (const c of cands) { state.grid[c.y][c.x]=my; let oppBest=0; for (const e of cands) { if (state.grid[e.y][e.x]!==0) continue; state.grid[e.y][e.x]=opp; const cnt=openFourCountAt(e.x,e.y,opp); state.grid[e.y][e.x]=0; if (cnt>oppBest) oppBest=cnt; } state.grid[c.y][c.x]=0; if (oppBest<bestOppCnt) { bestOppCnt=oppBest; bestBlock=c; } }
    if (bestOppCnt>=2 && bestBlock) return wantExplain? {move:bestBlock, reason:{rule:'blockDoubleOpenFour'}} : bestBlock;
    const scored = [];
    for (const c of cands) {
      state.grid[c.y][c.x]=my; const att = countPatternAt(c.x,c.y,my); state.grid[c.y][c.x]=0;
      const def = countPatternAt(c.x,c.y,opp);
      let attackScore = att.open4*ATTACK_TABLE.OPEN_FOUR + att.closed4*ATTACK_TABLE.CLOSED_FOUR + att.open3*ATTACK_TABLE.OPEN_THREE + att.closed3*ATTACK_TABLE.CLOSED_THREE + att.open2*ATTACK_TABLE.OPEN_TWO + att.closed2*ATTACK_TABLE.CLOSED_TWO;
      let defenseScore = DEF_RATIO * (def.open4*ATTACK_TABLE.OPEN_FOUR + def.closed4*ATTACK_TABLE.CLOSED_FOUR + def.open3*ATTACK_TABLE.OPEN_THREE + def.closed3*ATTACK_TABLE.CLOSED_THREE + def.open2*ATTACK_TABLE.OPEN_TWO + def.closed2*ATTACK_TABLE.CLOSED_TWO);
      let total = attackScore*ATTACK_WEIGHT + defenseScore*DEFENSE_WEIGHT;
      total += centerBonus(c.x,c.y) + proximityBonus(c.x,c.y,my);
      if (att.openThreeCount>=2) total *= 1.5;
      const blocked = countBlockLinesGE3(c.x,c.y,opp); if (blocked>=2) total *= 1.3;
      const center = Math.abs((SIZE-1)/2-c.x)+Math.abs((SIZE-1)/2-c.y);
      scored.push({ ...c, total, center, breakdown:{attackScore, defenseScore, att, def, blocked} });
    }
    scored.sort((a,b)=> b.total - a.total || a.center - b.center || (Math.random()-0.5));
    const best = scored[0] || cands[0] || null;
    if (!best) return wantExplain? null : null;
    return wantExplain? { move: {x:best.x,y:best.y}, reason:{ rule:'scored', total:best.total, center:best.center, ...best.breakdown } } : {x:best.x,y:best.y};
  }
  function pickBySpec(){ const r = pickBySpecFor(state.turn,true); return r && r.move; }
  function aiMove(){
    if(state.over) return; if(state.turn===state.player) return;
    const whoNow = state.turn; // 記住落子方，避免 placeFor 切換回合後誤記
    const res = pickBySpecFor(whoNow,true);
    if (res && res.move){
      const {x,y}=res.move; const ok = placeFor(whoNow, x, y);
      if (ok) { state.meta.push({ who: whoNow, x, y, reason: res.reason }); }
    }
  }
  function maybeAi(){ if(!state.over && state.turn!==state.player) setTimeout(aiMove, 150); }

  // 回播：解說
  function explainText(step){ if(!step) return ''; const {who, reason, suggest} = step; const side = who===1?'黑':'白'; if(reason?.rule==='instantWin') return `${side}：立即成五，直接落子。`; if(reason?.rule==='blockWin') return `${side}：封堵對手立即成五（封 ${reason.target?.x},${reason.target?.y}）。`; if(reason?.rule==='doubleOpenFour') return `${side}：形成雙活四，壓迫性極高。`; if(reason?.rule==='blockDoubleOpenFour') return `${side}：優先阻擋對手雙活四布局。`; if(reason?.rule==='scored'){ const r=reason; return `${side}：綜合評分=${Math.round(r.total)}（攻=${Math.round(r.attackScore)}、守=${Math.round(r.defenseScore)}、封${r.blocked||0}、中心距=${r.center}）。`; } if(reason?.rule==='player'){ if(suggest?.move){ const m=suggest.move, sr=suggest.reason; let base = `玩家落子；AI 當時建議下在 (${m.x},${m.y})。`; if(sr?.rule==='instantWin') return base+`原因：可立即取勝。`; if(sr?.rule==='blockWin') return base+`原因：需封堵對手立即成五。`; if(sr?.rule==='doubleOpenFour') return base+`原因：可造雙活四。`; if(sr?.rule==='blockDoubleOpenFour') return base+`原因：需避免對手雙活四。`; if(sr?.rule==='scored') return base+`原因：綜合評分最高（攻=${Math.round(sr.attackScore)}、守=${Math.round(sr.defenseScore)}、中心距=${sr.center}）。`; } return '玩家落子。'; } return ''; }
  function setExplainFromIdx(){ const step = state.meta[state.replay.idx] || null; const el = document.getElementById('explain'); if(!el) return; el.innerText = explainText(step); }
  function rebuildTo(idx){ state.grid.forEach(r=>r.fill(0)); state.last=null; state.winLine=null; for(let i=0;i<=idx;i++){ const m=state.meta[i]; if(!m) break; state.grid[m.y][m.x]=m.who; state.last={x:m.x,y:m.y}; } const step = state.meta[idx]; state.overlaySuggestion = null; if(step && step.who===state.player && step.suggest && step.suggest.move){ state.overlaySuggestion = {x:step.suggest.move.x,y:step.suggest.move.y}; } draw(); setExplainFromIdx(); }
  function replayPrev(){ if(state.meta.length===0) return; state.replay.idx = Math.max(-1, state.replay.idx-1); rebuildTo(state.replay.idx); }
  function replayNext(){ if(state.meta.length===0) return; state.replay.idx = Math.min(state.meta.length-1, state.replay.idx+1); rebuildTo(state.replay.idx); }
  function replayPlay(){ if(state.replay.active) return; state.replay.active=true; const tick=()=>{ if(!state.replay.active) return; if(state.replay.idx>=state.meta.length-1){ state.replay.active=false; return; } replayNext(); state.replay.timer=setTimeout(tick, state.replay.speedMs); }; tick(); }
  function replayPause(){ state.replay.active=false; if(state.replay.timer) clearTimeout(state.replay.timer); state.replay.timer=null; }

  // draw
  function draw() {
    ctx.clearRect(0,0,boardEl.width,boardEl.height);
    ctx.fillStyle = '#0b1320'; ctx.fillRect(0,0,boardEl.width,boardEl.height);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    for (let i=0;i<SIZE;i++) {
      const x = MARGIN + i*CELL; const y0 = MARGIN, y1 = MARGIN + (SIZE-1)*CELL;
      ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke();
      const y = MARGIN + i*CELL; const x0 = MARGIN, x1 = MARGIN + (SIZE-1)*CELL;
      ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    }
    const stars = [3,7,11]; ctx.fillStyle = '#64748b';
    stars.forEach(ix=>stars.forEach(iy=>{ const sx = MARGIN + ix*CELL, sy = MARGIN + iy*CELL; ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fill(); }));
    for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
      const v = state.grid[y][x]; if (!v) continue; const cx = MARGIN + x*CELL, cy=MARGIN + y*CELL; const rad = R;
      const gradient = ctx.createRadialGradient(cx-6,cy-6,4,cx,cy,rad);
      if (v===1) { gradient.addColorStop(0,'#9ca3af'); gradient.addColorStop(1,'#0f172a'); }
      else { gradient.addColorStop(0,'#f3f4f6'); gradient.addColorStop(1,'#cbd5e1'); }
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = v===1 ? '#111827' : '#e5e7eb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2); ctx.stroke();
    }
    // Draw move numbers during replay
    const showNums = state.replay.active || state.replay.idx >= 0;
    if (showNums && state.meta.length) {
      const upto = Math.max(-1, Math.min(state.meta.length - 1, state.replay.idx));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fontSize = Math.max(10, Math.floor(CELL * 0.5));
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      for (let i = 0; i <= upto; i++) {
        const m = state.meta[i]; if (!m) continue;
        const cx = MARGIN + m.x * CELL; const cy = MARGIN + m.y * CELL;
        // 根據棋盤當下該位置的實際顏色決定字體顏色，避免 meta 記錄與重播狀態不一致
        const vHere = state.grid[m.y][m.x];
        ctx.fillStyle = vHere === 1 ? '#f3f4f6' : '#0f172a';
        ctx.fillText(String(i + 1), cx, cy + 0.5);
      }
    }
    if (state.overlaySuggestion) { const sx = MARGIN + state.overlaySuggestion.x*CELL, sy = MARGIN + state.overlaySuggestion.y*CELL; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx,sy,R+4,0,Math.PI*2); ctx.stroke(); }
    if (state.last) { const cx = MARGIN + state.last.x*CELL, cy = MARGIN + state.last.y*CELL; ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx,cy,R+4,0,Math.PI*2); ctx.stroke(); }
    if (state.winLine) { ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.beginPath(); const p0 = state.winLine[0]; ctx.moveTo(MARGIN+p0.x*CELL, MARGIN+p0.y*CELL); for (let i=1;i<state.winLine.length;i++){ const p=state.winLine[i]; ctx.lineTo(MARGIN+p.x*CELL, MARGIN+p.y*CELL);} ctx.stroke(); }
  }

  // 綁定
  boardEl.addEventListener('click', (e)=>{ const {x,y}=xyFromEvent(e); place(x,y); });
  newBtn.addEventListener('click', ()=>{ reset(); });
  undoBtn.addEventListener('click', ()=>{ undo(); });
  sideEl?.addEventListener('change', ()=>{ state.player = (sideEl.value==='black'?1:2); reset(); });
  document.getElementById('replayPrev')?.addEventListener('click', ()=>{ replayPause(); replayPrev(); });
  document.getElementById('replayNext')?.addEventListener('click', ()=>{ replayPause(); replayNext(); });
  document.getElementById('replayPlay')?.addEventListener('click', ()=>{ replayPlay(); });
  document.getElementById('replayPause')?.addEventListener('click', ()=>{ replayPause(); });

  // init
  state.player = (sideEl?.value==='white') ? 2 : 1;
  reset();
})();
