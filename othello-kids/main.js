const boardEl = document.getElementById('board');
const sizeSelect = document.getElementById('sizeSelect');
const difficultySelect = document.getElementById('difficultySelect');
const missionSelect = document.getElementById('missionSelect');
const missionTitle = document.getElementById('missionTitle');
const missionDesc = document.getElementById('missionDesc');
const missionGoals = document.getElementById('missionGoals');
const blackCountEl = document.getElementById('blackCount');
const whiteCountEl = document.getElementById('whiteCount');
const turnLabel = document.getElementById('turnLabel');
const coachLog = document.getElementById('coachLog');
const guideBtn = document.getElementById('guideBtn');
const template = document.getElementById('guideTemplate');

const missions = [
  {
    id: 'free',
    title: '自由探索',
    desc: '一般對局，自行練習佈局、觀察翻轉。',
    goals: ['練習看出可下點', '盡量保住角落'],
    setup: null,
  },
  {
    id: 'forest',
    title: '黑白之森',
    desc: '協助小狐狸搶到左下角，避開 AI 的包圍。',
    goals: ['在 5 步內佔住任一角落', '保持可下點數 ≥ 2'],
    setup: presetShape([[3,3,1],[4,4,1],[4,3,-1],[3,4,-1],[2,4,-1],[5,3,-1]])
  },
  {
    id: 'flip-rush',
    title: '翻面大作戰',
    desc: '限定 3 步翻面最多棋子，挑戰爆發力！',
    goals: ['利用連線翻轉', '注意不要給角落'],
    setup: presetShape([[3,3,-1],[3,4,-1],[3,5,-1],[4,3,1],[4,4,1],[4,5,-1],[5,3,1],[5,4,-1],[5,5,-1]])
  }
];

function presetShape(list){
  return size => {
    const mid = Math.floor(size/2) - 2;
    return list.map(([x,y,v])=>({x:x+mid,y:y+mid,v}));
  };
}

function populateMissions(){
  if(!missionSelect) return;
  missionSelect.innerHTML = missions.map(m=>`<option value="${m.id}">${m.title}</option>`).join('');
  if(!missionSelect.value) missionSelect.value = missions[0].id;
}

const state = {
  size: Number(sizeSelect.value),
  board: [],
  turn: 1,
  history: [],
  hints: [],
};

populateMissions();

function initBoard(size) {
  state.size = size;
  state.board = Array.from({ length: size }, () => Array(size).fill(0));
  const mid = size / 2;
  state.board[mid - 1][mid - 1] = -1;
  state.board[mid - 1][mid] = 1;
  state.board[mid][mid - 1] = 1;
  state.board[mid][mid] = -1;
  const mission = missions.find(m => m.id === missionSelect.value) || missions[0];
  if (mission.setup) {
    const shape = mission.setup(size);
    shape.forEach(({x,y,v}) => {
      if (x>=0 && y>=0 && x<size && y<size) state.board[y][x] = v;
    });
  }
  state.turn = 1;
  state.history = [];
  render();
  log(`任務：<strong>${mission.title}</strong> – ${mission.desc}`);
  updateMissionCard(mission);
}

function updateMissionCard(m){
  missionTitle.textContent = m.title;
  missionDesc.textContent = m.desc;
  missionGoals.innerHTML = m.goals.map(g=>`<li>${g}</li>`).join('');
}

function render() {
  boardEl.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  boardEl.innerHTML = '';
  const valid = getValidMoves(state.turn);
  state.hints = valid;
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      const v = state.board[y][x];
      if (v !== 0) {
        const disc = document.createElement('div');
        disc.className = `disc ${v === 1 ? 'black' : 'white'}`;
        cell.appendChild(disc);
      }
      const hint = valid.find(m => m.x === x && m.y === y);
      if (hint) {
        const dot = document.createElement('div');
        dot.className = 'hint-dot';
        cell.appendChild(dot);
      }
      cell.addEventListener('click', handleCellClick);
      boardEl.appendChild(cell);
    }
  }
  updateCounts();
}

function updateCounts(){
  let black = 0, white = 0;
  state.board.flat().forEach(v => { if (v === 1) black++; else if (v === -1) white++; });
  blackCountEl.textContent = black;
  whiteCountEl.textContent = white;
  turnLabel.textContent = state.turn === 1 ? '黑子' : '白子';
}

function handleCellClick(e) {
  const x = Number(e.currentTarget.dataset.x);
  const y = Number(e.currentTarget.dataset.y);
  const flips = getFlips(x, y, state.turn);
  if (!flips.length) {
    log('這裡暫時不能下，試試亮點位置！');
    return;
  }
  applyMove(x, y, flips, state.turn);
  state.history.push({ x, y, flips, turn: state.turn });
  state.turn *= -1;
  endTurn();
}

function endTurn(){
  render();
  const valid = getValidMoves(state.turn);
  if (!valid.length) {
    state.turn *= -1;
    const otherValid = getValidMoves(state.turn);
    render();
    if (!otherValid.length) {
      finishGame();
      return;
    }
    log('沒有可下點，自動 PASS 給對手。');
  }
  if (state.turn === -1) window.setTimeout(aiMove, 400);
}

function finishGame(){
  const counts = state.board.flat().reduce((acc,v)=>{ if(v===1) acc.black++; else if(v===-1) acc.white++; return acc; }, {black:0,white:0});
  const winner = counts.black === counts.white ? '平手' : counts.black > counts.white ? '黑子勝利' : '白子勝利';
  log(`對局結束：${winner}！黑 ${counts.black} : 白 ${counts.white}`);
}

function applyMove(x, y, flips, who){
  state.board[y][x] = who;
  flips.forEach(({x, y}) => { state.board[y][x] = who; });
}

function getFlips(x, y, who){
  if (state.board[y][x] !== 0) return [];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  const result = [];
  for (const [dx,dy] of dirs){
    let nx = x + dx, ny = y + dy;
    const line = [];
    while (nx>=0 && ny>=0 && nx<state.size && ny<state.size && state.board[ny][nx] === -who) {
      line.push({x:nx,y:ny}); nx+=dx; ny+=dy;
    }
    if (line.length && nx>=0 && ny>=0 && nx<state.size && ny<state.size && state.board[ny][nx] === who) {
      result.push(...line);
    }
  }
  return result;
}

function getValidMoves(who){
  const moves = [];
  for(let y=0;y<state.size;y++) for(let x=0;x<state.size;x++){
    const flips = getFlips(x,y,who);
    if(flips.length) moves.push({x,y,flips});
  }
  return moves;
}

function hint(){
  if (!state.hints.length) { log('目前沒有可下位置，看看能不能 PASS。'); return; }
  const best = aiEvaluateMoves(state.hints, state.turn, difficultySelect.value);
  highlightSuggestion(best.x, best.y);
  log(`提示：考慮下在 (${best.x+1}, ${best.y+1})，因為${best.reason}`);
}

function highlightSuggestion(x,y){
  document.querySelectorAll('.suggestion-ring').forEach(el=>el.classList.remove('suggestion-ring'));
  const target = [...boardEl.children].find(el=>Number(el.dataset.x)===x && Number(el.dataset.y)===y);
  if (target) target.classList.add('suggestion-ring');
}

function aiMove(){
  const moves = getValidMoves(state.turn);
  if (!moves.length) { state.turn*=-1; endTurn(); return; }
  const pick = aiEvaluateMoves(moves, state.turn, Number(difficultySelect.value));
  applyMove(pick.x, pick.y, pick.flips, state.turn);
  state.history.push({x:pick.x, y:pick.y, flips: pick.flips, turn: state.turn});
  log(`AI 落在 (${pick.x+1}, ${pick.y+1})：${pick.reason}`);
  state.turn *= -1;
  endTurn();
}

function aiEvaluateMoves(moves, who, level){
  const scores = moves.map(move => {
    const features = evaluateMove(move, who);
    let weight = levelWeights[level] || levelWeights[3];
    const score = features.base + features.corners*weight.corner + features.edges*weight.edge + features.mobility*weight.mobility;
    return { ...move, score, reason: features.reason };
  });
  scores.sort((a,b)=>b.score-a.score || Math.random()-0.5);
  return scores[0];
}

const levelWeights = {
  1: { corner: 5, edge: 1, mobility: 1 },
  2: { corner: 8, edge: 2, mobility: 2 },
  3: { corner: 12, edge: 4, mobility: 4 },
  4: { corner: 20, edge: 6, mobility: 5 },
  5: { corner: 28, edge: 7, mobility: 6 },
};

function evaluateMove(move, who){
  const {x,y,flips} = move;
  const positionScore = flips.length;
  const isCorner = (x===0||x===state.size-1) && (y===0||y===state.size-1);
  const isEdge = x===0||y===0||x===state.size-1||y===state.size-1;
  const newBoard = cloneBoard();
  applyPreview(newBoard, move, who);
  const mobility = getValidMovesForBoard(newBoard, who).length - getValidMovesForBoard(newBoard, -who).length;
  let reason = `可翻 ${flips.length} 顆`;
  if(isCorner) reason = '搶角落最穩';
  else if(isEdge) reason = '邊線較難被翻回';
  return { base: positionScore, corners: isCorner?1:0, edges: isEdge?1:0, mobility, reason };
}

function cloneBoard(){ return state.board.map(row=>row.slice()); }
function applyPreview(board, move, who){ board[move.y][move.x]=who; move.flips.forEach(({x,y})=>board[y][x]=who); }
function getValidMovesForBoard(board, who){
  const moves=[];
  for(let y=0;y<state.size;y++) for(let x=0;x<state.size;x++){
    if(board[y][x]!==0) continue;
    const flips = getFlipsPreview(board,x,y,who);
    if(flips.length) moves.push({x,y,flips});
  }
  return moves;
}
function getFlipsPreview(board,x,y,who){
  if(board[y][x]!==0) return [];
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]; const res=[];
  for(const [dx,dy] of dirs){ let nx=x+dx, ny=y+dy; const line=[]; while(nx>=0&&ny>=0&&nx<state.size&&ny<state.size&&board[ny][nx]===-who){ line.push({x:nx,y:ny}); nx+=dx; ny+=dy; } if(line.length&&nx>=0&&ny>=0&&nx<state.size&&ny<state.size&&board[ny][nx]===who) res.push(...line); }
  return res;
}

function log(message){ coachLog.innerHTML = message; }

document.getElementById('newGame').addEventListener('click', ()=> initBoard(Number(sizeSelect.value)) );
document.getElementById('hintBtn').addEventListener('click', hint);
document.getElementById('undoBtn').addEventListener('click', ()=>{
  const last = state.history.pop();
  if(!last) return;
  state.board[last.y][last.x]=0;
  last.flips.forEach(({x,y})=>state.board[y][x]=-last.turn);
  state.turn = last.turn;
  render();
});
missionSelect.addEventListener('change', ()=> initBoard(Number(sizeSelect.value)));
sizeSelect.addEventListener('change', ()=> initBoard(Number(sizeSelect.value)));
guideBtn.addEventListener('click', ()=>{
  const clone = template.content.cloneNode(true);
  const modal = clone.querySelector('.modal');
  clone.querySelector('[data-close]').addEventListener('click', ()=> modal.remove());
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(clone);
});

// 若 DOM 尚未完整，保險起見等到 DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ()=> initBoard(state.size));
} else {
  initBoard(state.size);
}
