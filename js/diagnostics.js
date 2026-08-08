// ═══════════════════════════════════════════════
//  DIAGNOSTICS / STATS
// ═══════════════════════════════════════════════
function getFilteredRounds() {
  let rounds = [];
  db.sessions.forEach(s => { s.rounds.forEach(r => { rounds.push({...normalizeRound(r), sessionType: s.type, sessionDate: s.date}); }); });
  if(session) {
    session.rounds.forEach(r => rounds.push({...normalizeRound(r), sessionType: session.type, sessionDate: session.date}));
    if(session.currentRound.arrows.length) rounds.push({...normalizeRound(session.currentRound), sessionType: session.type, sessionDate: session.date});
  }
  
  const selectedScopes = [...diagFilters].filter(k => getFilterDefinition(k).group === 'scope');
  const selectedArrowNums = [...diagFilters].filter(k => getFilterDefinition(k).group === 'arrow_num').map(k => parseInt(k.replace('arrow_', '')));

  let filtered = rounds.filter(round => {
    if (selectedScopes.length > 0) {
      const rScope = isTournamentSession({type: round.sessionType}) ? 'tournament' : 'practice';
      if (!selectedScopes.includes(rScope)) return false;
    }
    if (diagFilters.size > 0 && !roundMatchesFilters(round, diagFilters)) {
      return false;
    }
    return true;
  }).filter(round => {
    const activeLocSet = activeLocationFilters.diag;
    const sess = db.sessions.find(s => s.date === round.sessionDate) || session;
    
    if (activeLocSet.size > 0) {
      if (sess && !activeLocSet.has(formatLocation(sess.location))) return false;
    }
    
    const activeArchSet = activeArcherFilters.diag;
    if (activeArchSet && activeArchSet.size > 0) {
      if (sess && !activeArchSet.has(normalizePersonName(sess.archerName))) return false;
    }

    // Round type filter
    const rt = activeRoundTypeFilters.diag || 'all';
    if (rt !== 'all' && round.sessionType !== rt) return false;
    
    // Date filtering
    const dateFilter = activeDateFilters.diag;
    if (dateFilter.start || dateFilter.end) {
      const roundDate = new Date(round.sessionDate);
      if (dateFilter.start) {
        const startDate = new Date(dateFilter.start);
        startDate.setHours(0, 0, 0, 0);
        if (roundDate < startDate) return false;
      }
      if (dateFilter.end) {
        const endDate = new Date(dateFilter.end);
        endDate.setHours(23, 59, 59, 999);
        if (roundDate > endDate) return false;
      }
    }
    
    return true;
  });

  if (selectedArrowNums.length > 0) {
    filtered = filtered.map(r => ({
      ...r,
      arrows: r.arrows.filter((a, idx) => selectedArrowNums.includes(idx + 1))
    })).filter(r => r.arrows.length > 0);
  }

  return filtered;
}

function renderDiag() {
  const dArchBtn = document.getElementById('diagArcherBtn');
  if (dArchBtn) dArchBtn.style.display = (db.deviceProfile.archers && db.deviceProfile.archers.length > 1) ? 'flex' : 'none';

  const rounds = getFilteredRounds();
  window.currentTimelineRounds = rounds; // Cache for panning
  const allArrows = rounds.flatMap(r=>r.arrows);
  const filteredSavedSessions = db.sessions.filter(sessionObj => sessionMatchesFilter(sessionObj, diagFilters, 'diag'));
  const currentSessionMatches = session && ( session.rounds.length > 0 || session.currentRound.arrows.length > 0 ) && sessionMatchesFilter(buildFinishedSession() || normalizeSessionData(session), diagFilters, 'diag');

  document.getElementById('dArrows').textContent = allArrows.length || '—';
  document.getElementById('dSessions').textContent = filteredSavedSessions.length + (currentSessionMatches ? 1 : 0) || '—';
  const consistency = computeConsistencyPercent(rounds);
  document.getElementById('dConsistency').textContent = consistency === null ? '—' : `${consistency}%`;
  const heatmapConsistencyLabel = document.getElementById('heatmapConsistencyLabel');
  if (heatmapConsistencyLabel) heatmapConsistencyLabel.textContent = `Consistency ${consistency === null ? '—' : `${consistency}%`}`;
  if(rounds.length) {
    const scores = rounds.map(r=>r.arrows.reduce((s,a)=>s+a.score,0));
    const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
    document.getElementById('dAvg').textContent = avg.toFixed(1);
    document.getElementById('dBest').textContent = Math.max(...scores);
  } else { document.getElementById('dAvg').textContent = '—'; document.getElementById('dBest').textContent = '—'; }

  drawHeatmap(allArrows);
  drawTimeline(rounds);
  drawZoneBars(allArrows);
  renderStatsTilePreviews(allArrows, rounds);
  if (document.getElementById('page-insights')?.classList.contains('active')) renderInsightsPage();
}

function buildOverallStats(allArrows, rounds) {
  const avg  = document.getElementById('dAvg')?.textContent  || '—';
  const best = document.getElementById('dBest')?.textContent || '—';
  const arr  = document.getElementById('dArrows')?.textContent || '—';
  const sess = document.getElementById('dSessions')?.textContent || '—';

  // Derived stats
  let worst = '—', tenXCount = '—', avgArrowScore = '—', consistency = '—';
  if (rounds.length) {
    const scores = rounds.map(r => r.arrows.reduce((s, a) => s + a.score, 0));
    worst = Math.min(...scores);
    tenXCount = allArrows.filter(a => a.score === 10).length;
    if (allArrows.length) avgArrowScore = (allArrows.reduce((s, a) => s + a.score, 0) / allArrows.length).toFixed(2);
    const pct = computeConsistencyPercent(rounds);
    if (pct !== null) consistency = `${pct}%`;
  }

  return [
    { label: 'Avg / Round',   val: avg },
    { label: 'Best Round',    val: best },
    { label: 'Worst Round',   val: worst },
    { label: 'Arrows Shot',   val: arr },
    { label: 'Sessions',      val: sess },
    { label: 'Tens (X)',      val: tenXCount },
    { label: 'Avg / Arrow',   val: avgArrowScore },
    { label: 'Consistency',   val: consistency },
  ];
}

function renderStatsTilePreviews(allArrows, rounds) {
  // ── Overall stats mini preview ───────────────────
  const overallEl = document.getElementById('overallTilePreview');
  if (overallEl) {
    const items = buildOverallStats(allArrows, rounds);
    overallEl.innerHTML = items.map(r => `<div style="
        background:var(--bg3);
        border:1px solid var(--border);
        border-radius:10px;
        padding:6px 8px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        gap:2px;
        min-height:0;
        overflow:hidden;
      ">
        <div style="font-family:'DM Mono',monospace;font-size:7px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;line-height:1.2;">${r.label}</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--accent);line-height:1;">${r.val}</div>
      </div>`).join('');
  }
  // Cache for fullscreen use
  window._lastStatsData = { allArrows, rounds };
}

// ── STAT DESCRIPTIONS ────────────────────────────────────────────────
const STAT_INFO = {
  overall: {
    title: 'Overall Stats',
    desc: 'A summary of your performance across all filtered sessions and rounds.'
  },
  heatmap: {
    title: 'Arrow Grouping',
    desc: 'A density heatmap showing where your arrows land on the target face. Warmer colours (yellow → red) indicate zones where more arrows have landed. Pinch to zoom and drag to pan.'
  },
  timeline: {
    title: 'Score Over Time',
    desc: 'A line chart of your round scores in chronological order. Stars mark personal bests. Tap a point to see its date and score, then tap again to open the full round detail. Pinch to zoom and drag to pan.'
  },
  zones: {
    title: 'Score Distribution',
    desc: 'A breakdown of how many arrows landed in each scoring zone (1–2, 3–4, 5–6, 7–8, 9–10, Miss). Bar length is proportional to the number of arrows in that zone.'
  },
  'Avg / Round': {
    title: 'Average Round Score',
    desc: 'The mean total score across all filtered rounds — the sum of all round scores divided by the number of rounds.'
  },
  'Best Round': {
    title: 'Best Round Score',
    desc: 'The highest total score recorded in a single round within the current filter.'
  },
  'Worst Round': {
    title: 'Worst Round Score',
    desc: 'The lowest total score recorded in a single round within the current filter.'
  },
  'Arrows Shot': {
    title: 'Total Arrows Shot',
    desc: 'The total count of individual arrows recorded across all filtered rounds.'
  },
  'Sessions': {
    title: 'Sessions',
    desc: 'The number of sessions included in the current filter. Each session can contain one or more rounds.'
  },
  'Tens (X)': {
    title: 'Tens & X-Rings Hit',
    desc: 'The number of arrows that scored 10 (the inner gold / X-ring) across all filtered rounds.',
    range: {
      segments: [
        { color: '#e05252', width: 34 },
        { color: '#f0a04b', width: 33 },
        { color: '#e8c547', width: 33 },
      ],
      ticks: [
        { val: '0',        lbl: 'None' },
        { val: '–',        lbl: '' },
        { val: '= arrows', lbl: 'All' },
      ],
    }
  },
  'Avg / Arrow': {
    title: 'Average Score Per Arrow',
    desc: 'Total points scored divided by total arrows shot. Unlike average round score, this is independent of round length.',
    range: {
      segments: [
        { color: '#e05252', width: 20 },
        { color: '#f0a04b', width: 30 },
        { color: '#52c278', width: 30 },
        { color: '#e8c547', width: 20 },
      ],
      ticks: [
        { val: '0',  lbl: 'Miss' },
        { val: '5',  lbl: '' },
        { val: '8',  lbl: '' },
        { val: '10', lbl: 'Max' },
      ],
    }
  },
  'Consistency': {
    title: 'Consistency',
    desc: 'A percentage based on score stability across your filtered rounds. Higher values mean your normalized round scores stay more consistent from round to round.',
    range: {
      segments: [
        { color: '#e05252', width: 22 },
        { color: '#f0a04b', width: 24 },
        { color: '#e8c547', width: 24 },
        { color: '#52c278', width: 30 },
      ],
      ticks: [
        { val: '0%',   lbl: 'Loose' },
        { val: '50%',  lbl: '' },
        { val: '75%',  lbl: '' },
        { val: '100%', lbl: 'Steady' },
      ],
    }
  },
};

const INFO_SVG = `<svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

function showStatInfoPopup(key) {
  const info = STAT_INFO[key];
  if (!info) return;
  document.getElementById('statInfoTitle').textContent = info.title;
  document.getElementById('statInfoDesc').textContent  = info.desc;

  const rangeEl = document.getElementById('statInfoRange');
  if (info.range) {
    let html = `<div class="stat-info-range"><div class="stat-info-range-label">Range</div>`;

    if (info.range.segments) {
      html += `<div class="stat-info-range-track">`;
      let offset = 0;
      info.range.segments.forEach(seg => {
        html += `<div class="stat-info-range-fill" style="left:${offset}%;width:${seg.width}%;background:${seg.color};"></div>`;
        offset += seg.width;
      });
      html += `</div>`;
      if (info.range.ticks) {
        html += `<div class="stat-info-range-ticks">`;
        info.range.ticks.forEach(t => {
          html += `<div class="stat-info-range-tick"><div class="stat-info-range-tick-val">${t.val}</div><div class="stat-info-range-tick-lbl">${t.lbl}</div></div>`;
        });
        html += `</div>`;
      }
    }

    html += `</div>`;
    rangeEl.innerHTML = html;
  } else {
    rangeEl.innerHTML = '';
  }

  document.getElementById('statInfoPopupBackdrop').classList.add('open');
}

function closeStatInfoPopup(e) {
  if (e && e.target !== document.getElementById('statInfoPopupBackdrop')) return;
  document.getElementById('statInfoPopupBackdrop').classList.remove('open');
}

function expandStatsCard(type) {
  const overlay  = document.getElementById('cardFullscreenOverlay');
  const inner    = document.getElementById('cardFullscreenInner');
  const title    = document.getElementById('cardFullscreenTitle');
  const body     = document.getElementById('cardFullscreenBody');
  const infoBtn  = document.getElementById('cardFsInfoBtn');

  const data = window._lastStatsData || { allArrows: [], rounds: [] };
  const { allArrows, rounds } = data;

  window._currentExpandType = type;
  body.innerHTML = '';
  inner.classList.remove('landscape');

  // Show the header info button for non-overall cards; hide for overall (per-cell buttons used instead)
  infoBtn.style.display = (type === 'overall') ? 'none' : 'flex';

  const CELL = (label, val) => {
    const hasInfo = !!STAT_INFO[label];
    return `<div style="
        background:var(--bg3);border:1px solid var(--border);border-radius:12px;
        padding:12px 10px 12px;display:flex;flex-direction:column;align-items:center;
        justify-content:center;text-align:center;gap:4px;position:relative;">
      ${hasInfo ? `<button class="cell-info-btn" onclick="showStatInfoPopup('${label}')" aria-label="About ${label}">${INFO_SVG}</button>` : ''}
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--accent);line-height:1;">${val}</div>
    </div>`;
  };

  if (type === 'overall') {
    title.textContent = 'Overall Stats';
    const items = buildOverallStats(allArrows, rounds);
    body.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;width:100%;height:100%;">
      ${items.map(r => CELL(r.label, r.val)).join('')}
    </div>`;
  }

  else if (type === 'heatmap') {
    const consistency = computeConsistencyPercent(rounds);
    title.textContent = `Arrow Grouping${consistency === null ? '' : ` · ${consistency}% Consistency`}`;
    const heatmapContainer = document.getElementById('heatmapContainer');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;';
    wrap.appendChild(heatmapContainer);
    body.style.padding = '8px';
    body.appendChild(wrap);
    body._heatmapMoved = true;
  }

  else if (type === 'timeline') {
    title.textContent = 'Score Over Time';
    inner.classList.add('landscape');
    const timelineContainer = document.getElementById('timelineContainer');
    // Ensure the container fills its parent fully
    timelineContainer.style.width  = '100%';
    timelineContainer.style.height = '100%';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-height:0;width:100%;display:flex;flex-direction:column;position:relative;overflow:hidden;';
    wrap.appendChild(timelineContainer);
    body.style.padding = '6px 8px 8px';
    body.style.overflow = 'hidden';
    body.appendChild(wrap);
    body._timelineMoved = true;
    // Two-step redraw: first after the overlay opens, second after full layout settles
    setTimeout(() => { if (typeof drawTimeline === 'function') drawTimeline(rounds); }, 80);
    setTimeout(() => { if (typeof drawTimeline === 'function') drawTimeline(rounds); }, 240);
  }

  else if (type === 'zones') {
    title.textContent = 'Score Distribution';
    inner.classList.add('landscape');
    body.style.padding = '10px 16px 14px';

    // Score colours matching the target face
    const SCORE_COLORS = {
      10: '#f7e900', 9: '#f7e900',
      8:  '#e84040', 7: '#e84040',
      6:  '#3b82f6', 5: '#3b82f6',
      4:  '#666',    3: '#666',
      2:  '#bbb',    1: '#bbb',
      0:  '#333',
    };
    const SCORE_LABELS = { 0: 'Miss' };

    const total = allArrows.length || 1;
    // Build rows 10 → 0
    const scores = [10,9,8,7,6,5,4,3,2,1,0];
    const counts = scores.map(s => ({
      score: s,
      label: SCORE_LABELS[s] || String(s),
      color: SCORE_COLORS[s],
      count: allArrows.filter(a => a.score === s).length,
    }));
    const maxCount = Math.max(...counts.map(r => r.count), 1);

    const container = document.createElement('div');
    container.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:5px;justify-content:space-between;';
    container.innerHTML = counts.map(r => {
      const pct = ((r.count / total) * 100).toFixed(1);
      const barW = ((r.count / maxCount) * 100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:10px;">
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);width:32px;text-align:right;flex-shrink:0;">${r.label}</div>
        <div style="flex:1;height:9px;background:var(--bg3);border-radius:5px;overflow:hidden;">
          <div style="width:${barW}%;height:100%;border-radius:5px;background:${r.color};transition:width .4s ease;"></div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);width:80px;flex-shrink:0;">
          ${r.count} <span style="font-size:9px;opacity:.7;">(${pct}%)</span>
        </div>
      </div>`;
    }).join('');

    body.appendChild(container);
    // No _zonesMoved flag — zoneBars tile element is untouched
  }

  overlay.classList.add('open');
}

function closeStatsCardExpand(e) {
  if (e && e.target !== document.getElementById('cardFullscreenOverlay')) return;
  const overlay = document.getElementById('cardFullscreenOverlay');
  const body    = document.getElementById('cardFullscreenBody');
  overlay.classList.remove('open');

  // Move canvases back to their original tiles after transition
  setTimeout(() => {
    if (body._heatmapMoved) {
      const heatmapContainer = document.getElementById('heatmapContainer');
      const tilePrev = document.querySelector('.stats-section-tile:nth-child(2) .sst-preview');
      if (tilePrev && heatmapContainer) tilePrev.appendChild(heatmapContainer);
      body._heatmapMoved = false;
    }
    if (body._timelineMoved) {
      const timelineContainer = document.getElementById('timelineContainer');
      const tilePrev = document.querySelector('.stats-section-tile:nth-child(3) .sst-preview');
      if (tilePrev && timelineContainer) {
        // Reset inline sizing applied during fullscreen
        timelineContainer.style.width  = '';
        timelineContainer.style.height = '';
        tilePrev.appendChild(timelineContainer);
      }
      body._timelineMoved = false;
      const { rounds } = window._lastStatsData || { rounds: [] };
      setTimeout(() => { if (typeof drawTimeline === 'function') drawTimeline(rounds); }, 80);
    }
    if (body._zonesMoved) {
      body._zonesMoved = false;
    }
    body.innerHTML = '';
    body.style.padding = '';
  }, 280);
}

// True Heatmap Helper
function hslToRgb(h, s, l) {
  let r, g, b;
  if(s == 0) r = g = b = l;
  else {
    const hue2rgb = (p, q, t) => {
      if(t < 0) t += 1; if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function drawHeatmap(arrows) {
  const hc = document.getElementById('heatmapCanvas'); 
  const hx = hc.getContext('2d');
  const W2 = 520, CX2 = W2/2, R2 = W2/2-10; 
  hc.width = W2; hc.height = W2;
  hx.clearRect(0,0,W2,W2);

  // target background
  for(let i=BULLSEYE_RINGS.length-1;i>=0;i--){
    const r=R2*BULLSEYE_RINGS[i].end;
    hx.beginPath(); hx.arc(CX2,CX2,r,0,Math.PI*2); hx.fillStyle = BULLSEYE_RINGS[i].color; hx.fill();
    hx.strokeStyle='rgba(0,0,0,0.3)'; hx.lineWidth=1; hx.stroke();
  }

  const legendEl = document.getElementById('heatmapLegend');
  if(!arrows.length) {
    if(legendEl) legendEl.style.display = 'none';
    return;
  }

  // Adaptive KDE (Kernel Density Estimation) Heatmap Generation
  const scale = 2; // Compute at 260x260 for performance
  const gridW = W2 / scale; 
  const gridH = W2 / scale; 
  const density = new Float32Array(gridW * gridH);
  let maxDensity = 0;
  
  // Precompute a smooth Gaussian kernel
  const kernelRadius = 16; 
  const kernelSize = kernelRadius * 2 + 1;
  const kernel = new Float32Array(kernelSize * kernelSize);
  const sigma = kernelRadius / 2.5; 
  for(let ky = -kernelRadius; ky <= kernelRadius; ky++) {
    for(let kx = -kernelRadius; kx <= kernelRadius; kx++) {
      const val = Math.exp(-(kx*kx + ky*ky) / (2 * sigma * sigma));
      kernel[(ky + kernelRadius) * kernelSize + (kx + kernelRadius)] = val;
    }
  }

  // Splat each arrow onto the density grid mathematically
  arrows.forEach(a => {
    // Skip manual button misses, but include true tapped misses just off the edge of the paper
    if (a.source === 'photo') return;
    if (a.score === 0 && a.nx === 1.5 && a.ny === 1.5) return; 
    if (typeof a.nx !== 'number' || typeof a.ny !== 'number') return;
    
    const px = (CX2 + a.nx * R2) / scale;
    const py = (CX2 + a.ny * R2) / scale;
    const cx = Math.round(px);
    const cy = Math.round(py);
    
    for(let ky = -kernelRadius; ky <= kernelRadius; ky++) {
      const y = cy + ky;
      if (y < 0 || y >= gridH) continue;
      for(let kx = -kernelRadius; kx <= kernelRadius; kx++) {
        const x = cx + kx;
        if (x < 0 || x >= gridW) continue;
        
        const w = kernel[(ky + kernelRadius) * kernelSize + (kx + kernelRadius)];
        const idx = y * gridW + x;
        density[idx] += w;
        if (density[idx] > maxDensity) maxDensity = density[idx];
      }
    }
  });

  if(maxDensity === 0) return;

  // Map true density values to the blue->red color spectrum
  const heatCanvas = document.createElement('canvas'); 
  heatCanvas.width = gridW; 
  heatCanvas.height = gridH;
  const heatCtx = heatCanvas.getContext('2d');
  const imgData = heatCtx.createImageData(gridW, gridH);
  
  for(let i=0; i<density.length; i++) {
    const d = density[i];
    if (d < 0.02) continue; // Ignore empty/noise space
    
    const norm = Math.min(1, d / maxDensity);
    const h = (1.0 - norm) * 0.66; // 0.66 is blue, 0 is red
    const rgb = hslToRgb(h, 1.0, 0.5);
    
    const p = i * 4;
    imgData.data[p] = rgb[0];
    imgData.data[p+1] = rgb[1];
    imgData.data[p+2] = rgb[2];
    imgData.data[p+3] = Math.floor(Math.min(1, norm * 2.5) * 210); // Adaptive opacity fade
  }
  heatCtx.putImageData(imgData, 0, 0);

  // Draw the fluid heatmap onto the main canvas with clipping
  hx.save(); 
  hx.beginPath(); hx.arc(CX2, CX2, R2, 0, Math.PI*2); hx.clip();
  hx.imageSmoothingEnabled = true;
  hx.drawImage(heatCanvas, 0, 0, W2, W2); 
  hx.restore();

  // Redraw faint rings on top of heatmap overlay for better reference
  for(let i=BULLSEYE_RINGS.length-1;i>=0;i--){
    const r=R2*BULLSEYE_RINGS[i].end;
    hx.beginPath(); hx.arc(CX2,CX2,r,0,Math.PI*2); hx.strokeStyle='rgba(0,0,0,0.15)'; hx.lineWidth=1; hx.stroke();
  }

  // Update Legend max density text
  if (legendEl) {
    legendEl.style.display = 'block';
    document.getElementById('heatmapLegendMax').textContent = Math.max(2, Math.round(maxDensity));
  }
}

// Timeline
let timelineDataPoints = []; // Track mapped coordinates for tooltips

// Calculate linear regression for trend line
function calculateLinearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  points.forEach((point, i) => {
    const x = i;
    const y = point;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

function drawTimeline(rounds) {
  const tc = document.getElementById('timelineCanvas');
  const c = tc.getContext('2d');

  // Size the canvas to its actual CSS display size × device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  const container = tc.parentElement;
  const cssW = container ? (container.clientWidth  || 800) : 800;
  // Use actual container height if available, otherwise fall back to aspect ratio
  const cssH = container && container.clientHeight ? container.clientHeight : Math.round(cssW * (250 / 800));
  const W3 = cssW, H3 = Math.max(cssH, 60); // at least 60px tall

  tc.width  = W3 * dpr;
  tc.height = H3 * dpr;
  // Don't override CSS height — let the CSS fill rule control it
  tc.style.width  = '100%';
  tc.style.height = '100%';
  c.scale(dpr, dpr);

  c.clearRect(0, 0, W3, H3);
  c.fillStyle = '#111827'; c.fillRect(0, 0, W3, H3);
  timelineDataPoints = []; // reset

  // Show/hide HTML empty-state message (crisp DOM text instead of pixelated canvas text)
  const emptyMsg = document.getElementById('timelineEmptyMsg');
  if(rounds.length < 2) {
    if (emptyMsg) emptyMsg.style.display = 'flex';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  const transformData = window.timelinePanZoom ? window.timelinePanZoom.getTransform() : {scale:1, tx:0, rect: tc.getBoundingClientRect()};
  const panScale = transformData.scale;
  const screenTx = transformData.tx;
  const rect = transformData.rect;
  const canvasTx = rect.width ? screenTx * (W3 / rect.width) : 0;

  const scores=rounds.map(r=>r.arrows.reduce((sum,a)=>sum+a.score,0));
  const maxS=Math.max(...scores,25), minS=Math.max(0,Math.min(...scores)-2);
  const pad=40; // extra padding for text

  // Calculate position iteratively taking true panning/scaling into account
  const px=i=>(pad + ((i/(scores.length-1))*(W3-pad*2)) * panScale + canvasTx);
  const py=s=>(H3-pad - (s-minS)/(maxS-minS)*(H3-pad*2));

  // Horizontal Grid Lines (Scores) - Static
  c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=1;
  c.fillStyle='#6b7a99'; c.font='11px "DM Mono", monospace'; c.textAlign='right'; c.textBaseline='middle';
  for(let g=0;g<=4;g++){
    const val = minS + (g/4)*(maxS-minS);
    const y=py(val);
    c.beginPath(); c.moveTo(pad,y); c.lineTo(W3,y); c.stroke();
    c.fillText(Math.round(val), pad - 6, y);
  }

  // Clip region for timeline data to prevent bleeding into Y-axis labels
  c.save();
  c.beginPath();
  c.rect(pad, 0, W3 - pad, H3);
  c.clip();

  // Vertical Grid Lines (Dates) - Dynamic panning
  const step = Math.max(1, Math.ceil(rounds.length / 5));
  c.textAlign='center'; c.textBaseline='top';
  for(let i=0; i<rounds.length; i+=step) {
    const x = px(i);
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H3-pad); c.stroke();
    c.fillText(new Date(rounds[i].sessionDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}), x, H3-pad + 8);
  }

  // Area fill
  c.beginPath(); c.moveTo(px(0),H3-pad);
  scores.forEach((s,i)=>c.lineTo(px(i),py(s)));
  c.lineTo(px(scores.length-1),H3-pad); c.closePath();
  const grad=c.createLinearGradient(0,0,0,H3); grad.addColorStop(0,'rgba(232,197,71,0.3)'); grad.addColorStop(1,'rgba(232,197,71,0)');
  c.fillStyle=grad; c.fill();

  // Line
  c.beginPath(); c.moveTo(px(0),py(scores[0]));
  scores.forEach((s,i)=>{if(i>0)c.lineTo(px(i),py(s));});
  c.strokeStyle='#e8c547'; c.lineWidth=2.5; c.lineJoin='round'; c.stroke();

  // Regression line (trend line)
  const regression = calculateLinearRegression(scores);
  if (regression && scores.length >= 3) {
    c.beginPath();
    const startY = regression.intercept;
    const endY = regression.intercept + regression.slope * (scores.length - 1);
    c.moveTo(px(0), py(startY));
    c.lineTo(px(scores.length - 1), py(endY));
    c.strokeStyle = 'rgba(82, 194, 120, 0.6)'; // Green with transparency
    c.lineWidth = 2;
    c.setLineDash([5, 5]); // Dashed line
    c.stroke();
    c.setLineDash([]); // Reset to solid lines
  }

  // Circular Dots & save data points — PB gets a distinct green dot
  const maxScore = Math.max(...scores);
  scores.forEach((s,i)=>{
    const x = px(i), y = py(s);
    const isPB = s === maxScore;
    if (isPB) {
      // Draw a slightly larger green dot with a white ring for the personal best
      c.beginPath(); c.arc(x, y, 7, 0, Math.PI*2);
      c.fillStyle = '#52c278'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.stroke();
      // Small "PB" star diamond shape
      c.beginPath(); c.arc(x, y, 3, 0, Math.PI*2);
      c.fillStyle = '#fff'; c.fill();
    } else {
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI*2); c.fillStyle='#e8c547'; c.fill();
    }
    timelineDataPoints.push({ x, y, score: s, date: rounds[i].sessionDate, idx: i, round: rounds[i], isPB });
  });

  c.restore(); // remove clip so we don't interfere with next draw cycle
}

// Handle Timeline Taps for Details
const tcContainer = document.getElementById('timelineContainer');
let tooltipHideTimer;
let activeTimelinePoint = null;

// ── ORIENTATION STUBS (called by goPage but may not be defined in all builds) ──
if (typeof unlockOrientation === 'undefined') {
  window.unlockOrientation = function() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
  };
}
if (typeof lockPortrait === 'undefined') {
  window.lockPortrait = function() {
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait'); } catch(e) {}
  };
}

// ── SWIPE TO NAVIGATE ──
// Swipe horizontally on any non-interactive area to move between tabs
(function initSwipeNav() {
  const PAGE_ORDER = ['score', 'home', 'diag', 'settings'];
  let swipeStartX = null;
  let swipeStartY = null;
  let swipeStartTime = null;

  function currentPageName() {
    for (const name of PAGE_ORDER) {
      const el = document.getElementById('page-' + name);
      if (el && el.classList.contains('active')) return name;
    }
    return null;
  }

  function isInteractive(el) {
    // Don't hijack swipes on canvases, scrollable areas, inputs, or overlays
    while (el && el !== document.body) {
      const tag = el.tagName;
      if (tag === 'CANVAS' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.classList && (
        el.classList.contains('overlay') ||
        el.classList.contains('detail-overlay') ||
        el.classList.contains('sort-overlay') ||
        el.classList.contains('card-fullscreen-overlay') ||
        el.classList.contains('round-complete-overlay')
      )) return true;
      // Scrollable containers
      if (el.scrollWidth > el.clientWidth + 4) return true;
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeStartX = t.clientX;
    swipeStartY = t.clientY;
    swipeStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (swipeStartX === null) return;
    if (e.changedTouches.length !== 1) { swipeStartX = null; return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStartX;
    const dy = t.clientY - swipeStartY;
    const dt = Date.now() - swipeStartTime;
    swipeStartX = null;

    // Must be fast, mostly horizontal, and a meaningful distance
    if (dt > 400) return;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.8) return;
    if (isInteractive(e.target)) return;

    // Don't swipe if any overlay is open
    const anyOpen = document.querySelector('.overlay.open, .detail-overlay.open, .sort-overlay.open, .card-fullscreen-overlay.open, .round-complete-overlay.open');
    if (anyOpen) return;

    const current = currentPageName();
    if (!current) return;
    const idx = PAGE_ORDER.indexOf(current);
    let nextIdx;
    if (dx < 0) { nextIdx = idx + 1; } // swipe left = next tab
    else         { nextIdx = idx - 1; } // swipe right = prev tab
    if (nextIdx < 0 || nextIdx >= PAGE_ORDER.length) return;

    const nextName = PAGE_ORDER[nextIdx];
    const navBtn = document.getElementById('nav-' + nextName);
    if (!navBtn) return;
    if (nextName === 'settings') {
      goPage(nextName, navBtn);
      if (typeof handleSettingsTap === 'function') handleSettingsTap();
    } else {
      goPage(nextName, navBtn);
    }
  }, { passive: true });
})();

tcContainer.addEventListener('touchend', e => {
  if (e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0];
  const { rect } = window.timelinePanZoom.getTransform();
  const tc2 = document.getElementById('timelineCanvas');
  const W3 = tc2 ? tc2.width  / (window.devicePixelRatio || 1) : 800;
  const H3 = tc2 ? tc2.height / (window.devicePixelRatio || 1) : 250;
  
  // Untransform the screen tap back to internal canvas coordinates
  const canvasX = (t.clientX - rect.left) * (W3 / rect.width);
  
  // Find nearest point along the X axis
  let nearest = null;
  let minDist = Infinity;
  timelineDataPoints.forEach(pt => {
    if (pt.x < 40 || pt.x > W3) return; // Ignore points that are clipped/panned out of view
    const dist = Math.abs(pt.x - canvasX);
    if (dist < minDist && dist < 40) { 
      minDist = dist;
      nearest = pt;
    }
  });

  const tooltip = document.getElementById('timelineTooltip');
  if (nearest) {
    activeTimelinePoint = nearest;
    document.getElementById('ttScore').textContent = nearest.score;
    document.getElementById('ttDate').textContent = new Date(nearest.date).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
    const hintEl = document.querySelector('.tt-hint');
    if (hintEl) hintEl.textContent = nearest.isPB ? '⭐ Personal Best · Tap for details →' : 'Tap for details →';
    
    // Position tooltip translating canvas coordinates precisely to fixed screen position
    const displayX = rect.left + (nearest.x * (rect.width / W3));
    const displayY = rect.top + (nearest.y * (rect.height / H3));

    // Show briefly offscreen to measure width, then clamp to viewport edges
    tooltip.style.display = 'block';
    tooltip.style.left = '0px';
    tooltip.style.top = '-9999px';
    const tipW = tooltip.offsetWidth;
    const tipH = tooltip.offsetHeight;
    const margin = 8;
    const clampedX = Math.max(margin, Math.min(window.innerWidth - tipW - margin, displayX - tipW / 2));
    const clampedY = Math.max(margin, displayY - tipH - 12);
    tooltip.style.left = clampedX + 'px';
    tooltip.style.top = clampedY + 'px';
    
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = setTimeout(() => { tooltip.style.display = 'none'; activeTimelinePoint = null; }, 4000);
  } else {
    tooltip.style.display = 'none';
    activeTimelinePoint = null;
  }
});

function openTimelineRoundDetail() {
  if (!activeTimelinePoint) return;
  const pt = activeTimelinePoint;
  clearTimeout(tooltipHideTimer);
  document.getElementById('timelineTooltip').style.display = 'none';
  activeTimelinePoint = null;

  const round = pt.round;
  if (!round) return;

  // Find the session and round index by matching arrow content + mode
  let foundSessionIdx = null, foundRoundIdx = null;
  const roundArrowStr = JSON.stringify((round.arrows || []).map(a => ({nx:a.nx, ny:a.ny, score:a.score})));
  db.sessions.forEach((s, si) => {
    if (foundSessionIdx !== null) return;
    s.rounds.forEach((r, ri) => {
      if (foundSessionIdx !== null) return;
      const rArrowStr = JSON.stringify((r.arrows || []).map(a => ({nx:a.nx, ny:a.ny, score:a.score})));
      if (r.mode === round.mode && rArrowStr === roundArrowStr) {
        foundSessionIdx = si;
        foundRoundIdx = ri;
      }
    });
  });

  if (foundSessionIdx !== null && foundRoundIdx !== null) {
    openRoundDetail(foundSessionIdx, foundRoundIdx);
  }
}
const ZONES = [
  {label:'9–10', min:9,  max:10, color:'#f7e900'},
  {label:'7–8',  min:7,  max:8,  color:'#e84040'},
  {label:'5–6',  min:5,  max:6,  color:'#3b82f6'},
  {label:'3–4',  min:3,  max:4,  color:'#555'},
  {label:'1–2',  min:1,  max:2,  color:'#aaa'},
  {label:'Miss', min:0,  max:0,  color:'#333'},
];

function drawZoneBars(arrows) {
  const el = document.getElementById('zoneBars'); el.innerHTML='';
  const total=arrows.length||1;
  ZONES.forEach(z=>{
    const count=arrows.filter(a=>a.score>=z.min&&a.score<=z.max).length;
    const pct=((count/total)*100).toFixed(1);
    el.innerHTML+=`<div class="zone-bar-row">
      <div class="zb-label">${z.label}</div>
      <div class="zone-bar-track"><div class="zone-bar-fill" style="width:${pct}%;background:${z.color}"></div></div>
      <div class="zb-count">${count} <span style="color:var(--muted);font-size:10px;">(${pct}%)</span></div>
    </div>`;
  });
}

