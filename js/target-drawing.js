// ═══════════════════════════════════════════════
//  TARGET DRAWING & INTERACTION
// ═══════════════════════════════════════════════
const BULLSEYE_RINGS = [
  {score:10, color:'#f7e900', end:0.1}, {score:9,  color:'#f7e900', end:0.2},
  {score:8,  color:'#e84040', end:0.3}, {score:7,  color:'#e84040', end:0.4},
  {score:6,  color:'#3b82f6', end:0.5}, {score:5,  color:'#3b82f6', end:0.6},
  {score:4,  color:'#1a1a1a', end:0.7}, {score:3,  color:'#1a1a1a', end:0.8},
  {score:2,  color:'#ffffff', end:0.9}, {score:1,  color:'#ffffff', end:1.0},
];
const THREE_D_RINGS = [
  {score:10, color:'#f7e900', end:0.1}, {score:9,  color:'#f7e900', end:0.2},
  {score:8,  color:'#e84040', end:0.3}, {score:7,  color:'#e84040', end:1.0},
];

function getRingsForMode(mode = 'bullseye') { return mode === '3d' ? THREE_D_RINGS : BULLSEYE_RINGS; }

const canvas = document.getElementById('targetCanvas');
const ctx = canvas.getContext('2d');
const W = 600, H = 600, CX = W/2, CY = H/2, R = W/2 - 10;

function drawTarget(arrows=[], mode='bullseye') { drawTargetOnCtx(ctx, W, arrows, mode); }

function getScoreAt(mode, nx, ny) {
  const d = Math.sqrt(nx*nx + ny*ny);
  
  // Archery rules: if the arrow touches the line, it gets the higher score.
  // We add a generous tolerance (0.04) for arrows cutting the outermost edge of the white ring
  if (d > 1.04) return 0; // It's a true miss
  
  const rings = getRingsForMode(mode);
  const matched = rings.find(ring => d <= ring.end);
  
  // If it falls in the tolerance gap, award the lowest ring score
  return matched ? matched.score : rings[rings.length - 1].score;
}

function normalizeRoundScore(mode, score) {
  if (mode === '3d' && score > 0 && score < 7) return 7;
  return score;
}

// Touch & Mouse Handling (Scroll prevention & Magnifier)
let targetTouchState = {
  startX: 0, startY: 0, currentX: 0, currentY: 0,
  isScrolling: false, magnifying: false, timer: null, active: false
};

// Magnifier Render Loop (Performance Optimization)
let magRAF = null;
let magActive = false;
let magTargetX = 0, magTargetY = 0;

function renderMagnifierLoop() {
  if (!magActive) return;
  updateMagnifier(magTargetX, magTargetY);
  magRAF = requestAnimationFrame(renderMagnifierLoop);
}

function startTargetInteraction(x, y) {
  targetTouchState.active = true;
  targetTouchState.startX = x;
  targetTouchState.startY = y;
  targetTouchState.currentX = x;
  targetTouchState.currentY = y;
  targetTouchState.isScrolling = false;
  targetTouchState.magnifying = false;
  clearTimeout(targetTouchState.timer);

  targetTouchState.timer = setTimeout(() => {
    if (session && !session.currentRound.locked && session.currentRound.arrows.length < 5) {
      if (!targetTouchState.isScrolling && normalizePreferences(db.preferences || {}).showMagnifier !== false) {
        targetTouchState.magnifying = true;
        showMagnifier(targetTouchState.currentX, targetTouchState.currentY);
      }
    }
  }, 300); // 300ms hold delay
}

function moveTargetInteraction(x, y, e) {
  if (!targetTouchState.active) return;
  targetTouchState.currentX = x;
  targetTouchState.currentY = y;

  if (!targetTouchState.magnifying) {
    if (Math.hypot(x - targetTouchState.startX, y - targetTouchState.startY) > 15) {
      targetTouchState.isScrolling = true;
      clearTimeout(targetTouchState.timer);
    }
  } else {
    // Lock screen scroll and update target tracking coords for the RAF loop
    if (e && e.cancelable) e.preventDefault(); 
    magTargetX = x;
    magTargetY = y;
  }
}

function endTargetInteraction(e) {
  if (!targetTouchState.active) return;
  targetTouchState.active = false;
  clearTimeout(targetTouchState.timer);

  if (targetTouchState.magnifying) {
    if (e && e.cancelable) e.preventDefault();
    targetTouchState.magnifying = false;
    hideMagnifier();
    handleTargetClick({ clientX: targetTouchState.currentX, clientY: targetTouchState.currentY });
  } else if (!targetTouchState.isScrolling) {
    handleTargetClick({ clientX: targetTouchState.currentX, clientY: targetTouchState.currentY });
  }
}

function cancelTargetInteraction() {
  targetTouchState.active = false;
  clearTimeout(targetTouchState.timer);
  if (targetTouchState.magnifying) {
    targetTouchState.magnifying = false;
    hideMagnifier();
  }
}

// Pure Touch Listeners (Mobile)
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    // Prevent page scroll immediately so the hold-to-zoom gesture is smooth.
    // The canvas is not a scrollable element so this is always safe.
    if (e.cancelable) e.preventDefault();
    startTargetInteraction(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1) {
    moveTargetInteraction(e.touches[0].clientX, e.touches[0].clientY, e);
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  // Prevent the browser from firing synthetic mousedown/mouseup after touch,
  // which would cause a second arrow to be registered on mobile.
  e.preventDefault();
  endTargetInteraction(e);
});

canvas.addEventListener('touchcancel', cancelTargetInteraction);

// Pure Mouse Listeners (Desktop)
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return; // Only trigger on left click
  startTargetInteraction(e.clientX, e.clientY);
});

window.addEventListener('mousemove', e => {
  if (targetTouchState.active) {
    moveTargetInteraction(e.clientX, e.clientY, e);
  }
});

window.addEventListener('mouseup', e => {
  if (targetTouchState.active) {
    endTargetInteraction(e);
  }
});

function showMagnifier(clientX, clientY) {
  document.getElementById('magnifierWrap').style.display = 'block';
  magActive = true;
  magTargetX = clientX;
  magTargetY = clientY;
  if (!magRAF) renderMagnifierLoop();
}

function hideMagnifier() {
  document.getElementById('magnifierWrap').style.display = 'none';
  magActive = false;
  if (magRAF) {
    cancelAnimationFrame(magRAF);
    magRAF = null;
  }
}

function updateMagnifier(clientX, clientY) {
  const wrap = document.getElementById('magnifierWrap');
  const magCanvas = document.getElementById('magnifierCanvas');
  const mctx = magCanvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  
  // Constrain coordinates to canvas bounds
  const boundedX = Math.max(rect.left, Math.min(rect.right, clientX));
  const boundedY = Math.max(rect.top, Math.min(rect.bottom, clientY));
  
  const x = boundedX - rect.left;
  const y = boundedY - rect.top;

  // Move using hardware-accelerated transform instead of left/top CSS properties
  wrap.style.transform = `translate3d(${boundedX}px, ${boundedY}px, 0) translate(-50%, -120%)`;

  // Draw scaled region
  const zoom = 2;
  const mw = magCanvas.width, mh = magCanvas.height;
  
  // Calculate source rectangle
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const srcX = (x * scaleX) - (mw / (2 * zoom));
  const srcY = (y * scaleY) - (mh / (2 * zoom));
  const srcW = mw / zoom;
  const srcH = mh / zoom;

  mctx.clearRect(0, 0, mw, mh);
  mctx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, mw, mh);
}

// Haptic feedback helper — short pulse on score, longer on miss
function haptic(type = 'score') {
  if (!navigator.vibrate) return;
  if (type === 'miss') navigator.vibrate([30, 20, 30]);
  else if (type === 'gold') navigator.vibrate(60);
  else navigator.vibrate(15);
}

function handleTargetClick(e) {
  if (!session) return;
  if (isPhotoTournamentSession(session)) return;
  const cr = session.currentRound;
  if (cr.locked || cr.arrows.length >= 5) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const nx = (px - CX) / R;
  const ny = (py - CY) / R;
  const score = normalizeRoundScore(cr.mode, getScoreAt(cr.mode, nx, ny));
  cr.arrows.push({nx, ny, score});
  haptic(score >= 9 ? 'gold' : 'score');
  if (cr.arrows.length === 5) maybeCelebrateRoundPB(cr);
  flashScore(score); renderScorePage();
  if (isTournamentSession(session) && sessionRoundNumber() === 6 && cr.arrows.length === 5) {
    const sessionId = session.id; cr.locked = true; renderScorePage();
    setTimeout(() => { if (session?.id === sessionId && session.currentRound.locked) endSession(); }, 250);
  }
}

function scoreMiss() {
  if (!session) return;
  if (isPhotoTournamentSession(session)) return;
  const cr = session.currentRound;
  if (cr.locked || cr.arrows.length >= 5) return;
  cr.arrows.push({nx: 1.5, ny: 1.5, score: 0});
  haptic('miss');
  if (cr.arrows.length === 5) maybeCelebrateRoundPB(cr);
  flashScore(0); renderScorePage();
  if (isTournamentSession(session) && sessionRoundNumber() === 6 && cr.arrows.length === 5) {
    const sessionId = session.id; cr.locked = true; renderScorePage();
    setTimeout(() => { if (session?.id === sessionId && session.currentRound.locked) endSession(); }, 250);
  }
}

let ringZoomActive = false;
function toggleRingZoom() {
  ringZoomActive = !ringZoomActive;
  const canvas = document.getElementById('targetCanvas');
  const btn = document.getElementById('zoomRingsBtn');
  canvas.classList.toggle('ring-zoom', ringZoomActive);
  btn.classList.toggle('zoomed', ringZoomActive);
}

function undoLastArrow() {
  if (!session) return;
  if (isPhotoTournamentSession(session)) return;
  const cr = session.currentRound;
  if (!cr.arrows.length || cr.locked) return;
  cr.arrows.pop(); closeOverlay('roundCompleteOverlay'); renderScorePage();
}

function flashScore(s) {
  if (normalizePreferences(db.preferences || {}).showScoreFlash === false) return;
  const el = document.getElementById('scoreFlash');
  el.textContent = s === 0 ? 'M' : s;
  el.style.color = s >= 9 ? '#f7e900' : s >= 7 ? '#e8c547' : s >= 5 ? '#3b82f6' : s >= 3 ? '#888' : '#e05252';
  el.classList.remove('hide'); el.classList.add('show');
  setTimeout(() => { el.classList.add('hide'); }, 600);
  setTimeout(() => { el.classList.remove('show','hide'); }, 900);
  // Ripple effect
  const ripple = document.getElementById('scoreFlashRipple');
  if (ripple) {
    ripple.style.borderColor = s >= 9 ? '#f7e900' : s >= 7 ? '#e8c547' : s >= 5 ? '#3b82f6' : s >= 3 ? '#888' : '#e05252';
    ripple.classList.remove('animate');
    void ripple.offsetWidth; // force reflow to restart animation
    ripple.classList.add('animate');
    setTimeout(() => ripple.classList.remove('animate'), 600);
  }
}

function updateScoreScrollLock() {
  const scorePage = document.getElementById('page-score');
  const scoreActive = document.getElementById('scoreActive');
  const scorePageActive = scorePage?.classList.contains('active');
  const scoringLive = !!session && scorePageActive && scoreActive && scoreActive.style.display !== 'none' && !isPhotoTournamentSession(session);
  const scoringActive = !!session && scorePageActive && scoreActive && scoreActive.style.display !== 'none';
  document.body.classList.toggle('score-scroll-locked', scoringLive);
  if (scorePage) scorePage.classList.toggle('score-scroll-locked', scoringLive);
  if (scoreActive) scoreActive.classList.toggle('score-session-live', scoringLive);
  if (scoreActive) scoreActive.classList.toggle('score-session-active', scoringActive);
}

function openCompletedRoundsOverlay() {
  if (!session?.rounds?.length) return;
  document.getElementById('completedRoundsOverlay').classList.add('open');
}

