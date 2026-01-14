const canvas = document.getElementById("table");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const restartButton = document.getElementById("restart");
const touchLeft = document.querySelector(".touch-button.left");
const touchRight = document.querySelector(".touch-button.right");
const touchLaunch = document.querySelector(".touch-button.launch");
const ctx = canvas.getContext("2d");

const state = {
  score: 0,
  lives: 3,
  launched: false,
  running: true,
  lastTime: 0,
};

const overlayTitle = overlay.querySelector("h2");
const overlayHint = overlay.querySelector("p");
const overlayDefault = {
  title: overlayTitle.textContent,
  hint: overlayHint.textContent,
};

const table = {
  width: canvas.width,
  height: canvas.height,
  gravity: 0.26,
  friction: 0.992,
  walls: [
    { x1: 30, y1: 30, x2: 450, y2: 30 },
    { x1: 30, y1: 30, x2: 30, y2: 520 },
    { x1: 450, y1: 30, x2: 450, y2: 520 },
    { x1: 30, y1: 520, x2: 170, y2: 640 },
    { x1: 450, y1: 520, x2: 310, y2: 640 },
    { x1: 170, y1: 640, x2: 210, y2: 690 },
    { x1: 310, y1: 640, x2: 270, y2: 690 },
  ],
  bumpers: [
    { x: 150, y: 180, r: 26, value: 120 },
    { x: 320, y: 180, r: 26, value: 120 },
    { x: 235, y: 280, r: 30, value: 160 },
  ],
};

const ball = {
  x: 400,
  y: 650,
  vx: 0,
  vy: 0,
  r: 10,
  reset() {
    this.x = 405;
    this.y = 650;
    this.vx = 0;
    this.vy = 0;
  },
};

const flippers = [
  {
    pivot: { x: 185, y: 640 },
    length: 90,
    baseAngle: Math.PI * 0.9,
    upAngle: Math.PI * 1.22,
    angle: Math.PI * 0.9,
    angularVelocity: 0,
    key: "left",
  },
  {
    pivot: { x: 295, y: 640 },
    length: 90,
    baseAngle: Math.PI * 0.1,
    upAngle: -Math.PI * 0.22,
    angle: Math.PI * 0.1,
    angularVelocity: 0,
    key: "right",
  },
];

const keys = { left: false, right: false };

function updateScore() {
  scoreEl.textContent = state.score.toString();
  livesEl.textContent = state.lives.toString();
}

function setOverlay(visible) {
  overlay.classList.toggle("hidden", !visible);
}

function launchBall() {
  if (state.launched) return;
  state.launched = true;
  ball.vx = -4;
  ball.vy = -12;
  setOverlay(false);
}

function restartGame() {
  state.score = 0;
  state.lives = 3;
  state.launched = false;
  state.running = true;
  ball.reset();
  updateScore();
  overlayTitle.textContent = overlayDefault.title;
  overlayHint.textContent = overlayDefault.hint;
  setOverlay(true);
}

function handleKeyDown(event) {
  if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = true;
  if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = true;
  if (event.code === "Space") {
    event.preventDefault();
    if (!state.running) {
      restartGame();
    } else {
      launchBall();
    }
  }
}

function setKeyState(key, pressed) {
  if (key in keys) {
    keys[key] = pressed;
  }
}

function handleTouchStart(key) {
  return (event) => {
    event.preventDefault();
    if (key === "launch") {
      if (!state.running) {
        restartGame();
      } else {
        launchBall();
      }
      return;
    }
    setKeyState(key, true);
  };
}

function handleTouchEnd(key) {
  return (event) => {
    event.preventDefault();
    if (key === "launch") return;
    setKeyState(key, false);
  };
}

function handleKeyUp(event) {
  if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
  if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
}

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function reflectBallFromSegment(segment, restitution = 0.9) {
  const { x1, y1, x2, y2 } = segment;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return;
  const t = Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / lenSq));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const distSq = distanceSquared(ball.x, ball.y, closestX, closestY);
  if (distSq > ball.r * ball.r) return;
  const dist = Math.sqrt(distSq) || 0.001;
  const nx = (ball.x - closestX) / dist;
  const ny = (ball.y - closestY) / dist;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn >= 0) return;
  ball.vx -= (1 + restitution) * vn * nx;
  ball.vy -= (1 + restitution) * vn * ny;
  const overlap = ball.r - dist + 0.5;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
}

function resolveBumper(bumper) {
  const distSq = distanceSquared(ball.x, ball.y, bumper.x, bumper.y);
  const r = bumper.r + ball.r;
  if (distSq > r * r) return;
  const dist = Math.sqrt(distSq) || 0.001;
  const nx = (ball.x - bumper.x) / dist;
  const ny = (ball.y - bumper.y) / dist;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= 1.3 * vn * nx;
    ball.vy -= 1.3 * vn * ny;
  }
  ball.x = bumper.x + nx * (r + 0.5);
  ball.y = bumper.y + ny * (r + 0.5);
  state.score += bumper.value;
  updateScore();
}

function updateFlipper(flipper, targetUp, dt) {
  const target = targetUp ? flipper.upAngle : flipper.baseAngle;
  const speed = 10;
  const previousAngle = flipper.angle;
  flipper.angle += (target - flipper.angle) * Math.min(1, dt * speed);
  flipper.angularVelocity = (flipper.angle - previousAngle) / Math.max(dt, 0.016);
}

function getFlipperSegment(flipper) {
  const x1 = flipper.pivot.x;
  const y1 = flipper.pivot.y;
  const x2 = x1 + Math.cos(flipper.angle) * flipper.length;
  const y2 = y1 + Math.sin(flipper.angle) * flipper.length;
  return { x1, y1, x2, y2 };
}

function resolveFlipperCollision(flipper) {
  const segment = getFlipperSegment(flipper);
  const beforeVx = ball.vx;
  const beforeVy = ball.vy;
  reflectBallFromSegment(segment, 0.85);
  if (beforeVx !== ball.vx || beforeVy !== ball.vy) {
    const tangentX = Math.cos(flipper.angle + Math.PI / 2);
    const tangentY = Math.sin(flipper.angle + Math.PI / 2);
    const impulse = Math.min(8, Math.abs(flipper.angularVelocity) * 0.2);
    ball.vx += tangentX * impulse * (flipper.key === "left" ? 1 : -1);
    ball.vy += tangentY * impulse * (flipper.key === "left" ? 1 : -1);
  }
}

function updateBall(dt) {
  if (!state.launched || !state.running) return;
  ball.vy += table.gravity;
  ball.vx *= table.friction;
  ball.vy *= table.friction;
  ball.x += ball.vx;
  ball.y += ball.vy;

  table.walls.forEach((segment) => reflectBallFromSegment(segment));
  table.bumpers.forEach(resolveBumper);
  flippers.forEach(resolveFlipperCollision);

  if (ball.y - ball.r > table.height) {
    state.lives -= 1;
    updateScore();
    if (state.lives <= 0) {
      state.running = false;
      setOverlay(true);
      overlayTitle.textContent = "遊戲結束";
      overlayHint.textContent = "按下空白鍵或點發射鍵重新開始。";
    }
    state.launched = false;
    ball.reset();
  }
}

function drawTable() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  table.walls.forEach(({ x1, y1, x2, y2 }) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  table.bumpers.forEach((bumper) => {
    ctx.beginPath();
    ctx.fillStyle = "#f97316";
    ctx.strokeStyle = "#fdba74";
    ctx.lineWidth = 4;
    ctx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  flippers.forEach((flipper) => {
    const { x1, y1, x2, y2 } = getFlipperSegment(flipper);
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.fillStyle = "#f8fafc";
  ctx.shadowColor = "rgba(56,189,248,.6)";
  ctx.shadowBlur = 12;
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000 || 0.016);
  state.lastTime = timestamp;
  updateFlipper(flippers[0], keys.left, dt);
  updateFlipper(flippers[1], keys.right, dt);
  updateBall(dt);
  drawTable();
  requestAnimationFrame(loop);
}

function handleResize() {
  const scale = window.devicePixelRatio || 1;
  const targetWidth = 480;
  const targetHeight = 720;
  canvas.width = targetWidth * scale;
  canvas.height = targetHeight * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  table.width = targetWidth;
  table.height = targetHeight;
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("resize", handleResize);
restartButton.addEventListener("click", restartGame);
touchLeft?.addEventListener("pointerdown", handleTouchStart("left"));
touchLeft?.addEventListener("pointerup", handleTouchEnd("left"));
touchLeft?.addEventListener("pointerleave", handleTouchEnd("left"));
touchLeft?.addEventListener("pointercancel", handleTouchEnd("left"));
touchRight?.addEventListener("pointerdown", handleTouchStart("right"));
touchRight?.addEventListener("pointerup", handleTouchEnd("right"));
touchRight?.addEventListener("pointerleave", handleTouchEnd("right"));
touchRight?.addEventListener("pointercancel", handleTouchEnd("right"));
touchLaunch?.addEventListener("pointerdown", handleTouchStart("launch"));

handleResize();
updateScore();
requestAnimationFrame(loop);
