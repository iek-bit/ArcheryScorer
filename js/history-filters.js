// ═══════════════════════════════════════════════
// SEPARATE FILTERS AND SORT FUNCTIONS (for History page)
// ═══════════════════════════════════════════════
function openFiltersOnlyOverlay(context) {
  activeFiltersContext = context;

  // Source sessions depend on context
  const sourceSessions = context === 'club' ? clubSessions : db.sessions;

  // Archer filter: only show for club
  const archerSection = document.getElementById('filtersOnlyArcherSection');
  if (archerSection) archerSection.style.display = context === 'club' ? 'block' : 'none';
  const locationSection = document.getElementById('filtersOnlyLocationSection');
  if (locationSection) locationSection.style.display = context === 'club' ? 'none' : 'block';

  if (context === 'club') {
    const activeLocSet = activeLocationFilters.club || (activeLocationFilters.club = new Set());
    activeLocSet.clear();
    const archerSelect = document.getElementById('filtersOnlyArcherSelect');
    if (archerSelect) {
      const uniqueArchers = [...new Set(sourceSessions.map(s => normalizePersonName(s.archerName)).filter(Boolean))].sort();
      const activeArcherSet = activeArcherFilters[context] || (activeArcherFilters[context] = new Set());
      const currentArcher = activeArcherSet.size === 1 ? [...activeArcherSet][0] : 'all';
      archerSelect.innerHTML = `<option value="all">All Archers</option>` +
        uniqueArchers.map(a => `<option value="${a.replace(/"/g,'&quot;')}"${currentArcher === a ? ' selected' : ''}>${a}</option>`).join('');
    }
  }

  // Location filter dropdown
  const locationSelect = document.getElementById('filtersOnlyLocationSelect');
  if (locationSelect && context !== 'club') {
    const uniqueLocations = [...new Set(sourceSessions.map(s => formatLocation(s.location)).filter(Boolean))].sort();
    const activeLocSet = activeLocationFilters[context] || (activeLocationFilters[context] = new Set());
    const currentLoc = activeLocSet.size === 1 ? [...activeLocSet][0] : 'all';
    locationSelect.innerHTML = `<option value="all">All Locations</option>` +
      uniqueLocations.map(loc => `<option value="${loc.replace(/"/g,'&quot;')}"${currentLoc === loc ? ' selected' : ''}>${loc}</option>`).join('');
  }

  // Round type dropdown
  const rtSelect = document.getElementById('filtersOnlyRoundTypeSelect');
  if (rtSelect) rtSelect.value = activeRoundTypeFilters[context] || 'all';

  // Date filter
  const dateFilter = context === 'club' ? activeDateFiltersClub : (activeDateFilters[context] || { start: null, end: null });
  document.getElementById('filtersOnlyDateStart').value = dateFilter.start || '';
  document.getElementById('filtersOnlyDateEnd').value   = dateFilter.end   || '';

  document.getElementById('filtersOnlyOverlay').classList.add('open');
}

function setFiltersOnlyArcherFromDropdown(archLabel) {
  const activeSet = activeArcherFilters[activeFiltersContext] || (activeArcherFilters[activeFiltersContext] = new Set());
  if (archLabel === 'all') activeSet.clear();
  else { activeSet.clear(); activeSet.add(archLabel); }
  updateFilterBadge(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'club') renderClubHistory();
}

function setFiltersOnlyLocationFromDropdown(locLabel) {
  if (activeFiltersContext === 'club') return;
  const activeLocSet = activeLocationFilters[activeFiltersContext] || (activeLocationFilters[activeFiltersContext] = new Set());
  if (locLabel === 'all') activeLocSet.clear();
  else { activeLocSet.clear(); activeLocSet.add(locLabel); }
  updateFilterBadge(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'club') renderClubHistory();
}

function setFiltersOnlyArcherFilter(archLabel) {
  const activeSet = activeArcherFilters[activeFiltersContext] || (activeArcherFilters[activeFiltersContext] = new Set());
  if (archLabel === 'all') activeSet.clear();
  else if (activeSet.has(archLabel)) activeSet.delete(archLabel);
  else activeSet.add(archLabel);
  updateFilterBadge(activeFiltersContext);
  openFiltersOnlyOverlay(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'club') renderClubHistory();
}

function setFiltersOnlyLocationFilter(locLabel) {
  if (activeFiltersContext === 'club') return;
  const activeLocSet = activeLocationFilters[activeFiltersContext] || (activeLocationFilters[activeFiltersContext] = new Set());
  if (locLabel === 'all') activeLocSet.clear();
  else if (activeLocSet.has(locLabel)) activeLocSet.delete(locLabel);
  else activeLocSet.add(locLabel);
  updateFilterBadge(activeFiltersContext);
  openFiltersOnlyOverlay(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'club') renderClubHistory();
}

function applyFiltersOnlyDateFilter() {
  const startVal = document.getElementById('filtersOnlyDateStart').value;
  const endVal   = document.getElementById('filtersOnlyDateEnd').value;
  if (activeFiltersContext === 'club') {
    activeDateFiltersClub.start = startVal || null;
    activeDateFiltersClub.end   = endVal   || null;
    renderClubHistory();
  } else {
    activeDateFilters[activeFiltersContext] = { start: startVal || null, end: endVal || null };
    if (activeFiltersContext === 'home') renderHome();
  }
  updateFilterBadge(activeFiltersContext);
}

function clearFiltersOnlyDateFilter() {
  document.getElementById('filtersOnlyDateStart').value = '';
  document.getElementById('filtersOnlyDateEnd').value   = '';
  if (activeFiltersContext === 'club') {
    activeDateFiltersClub.start = null; activeDateFiltersClub.end = null;
    renderClubHistory();
  } else {
    activeDateFilters[activeFiltersContext] = { start: null, end: null };
    if (activeFiltersContext === 'home') renderHome();
  }
  updateFilterBadge(activeFiltersContext);
}


function openSortOnlyOverlay(context) {
  activeFiltersContext = context;
  const currentSort = context === 'club' ? clubSort : homeSort;
  const sortSel = document.getElementById('sortOnlySelect');
  if (sortSel) sortSel.value = currentSort;
  document.getElementById('sortOnlyOverlay').classList.add('open');
}

function setSortOnly(key) {
  if (activeFiltersContext === 'club') {
    clubSort = key;
    renderClubHistory();
  } else {
    homeSort = key;
    renderHome();
  }
}

function computeGroupingScore(sessionObj) {
  const rounds = sessionObj.rounds.filter(r => r.arrows && r.arrows.length);
  if (!rounds.length) return Infinity;
  const roundSpreads = rounds.map(r => {
    const positioned = r.arrows.filter(a => typeof a.nx === 'number' && typeof a.ny === 'number' && a.source !== 'photo');
    if (!positioned.length) return Infinity;
    const xs = positioned.map(a => a.nx), ys = positioned.map(a => a.ny);
    const cx = xs.reduce((s,v) => s+v, 0) / xs.length, cy = ys.reduce((s,v) => s+v, 0) / ys.length;
    return positioned.reduce((s,a) => s + Math.sqrt((a.nx-cx)**2+(a.ny-cy)**2), 0) / positioned.length;
  });
  const finite = roundSpreads.filter(Number.isFinite);
  return finite.length ? finite.reduce((s,v) => s+v, 0) / finite.length : Infinity;
}

function applySortToSessions(sessions, sortKey) {
  const arr = [...sessions];
  switch (sortKey) {
    case 'oldest': return arr.reverse();
    case 'score-high': return arr.sort((a,b) => getSessionTotal(b) - getSessionTotal(a));
    case 'score-low': return arr.sort((a,b) => getSessionTotal(a) - getSessionTotal(b));
    case 'grouping-best': return arr.sort((a,b) => computeGroupingScore(a) - computeGroupingScore(b));
    case 'grouping-worst': return arr.sort((a,b) => computeGroupingScore(b) - computeGroupingScore(a));
    case 'newest': default: return arr;
  }
}

function getFilterDefinition(key) { return FILTER_DEFS.find(def => def.key === key); }

function getVisibleFilters(filters, context) {
  const visible = ['all', 'practice', 'tournament', 'bullseye', '3d'];
  if (context === 'diag') visible.push('arrow_filter');
  
  if (filters.has('bullseye')) visible.push('10m', '15m');
  if (filters.has('3d')) visible.push(...THREE_D_TARGETS.map(target => target.key));
  if (filters.has('arrow_filter') && context === 'diag') visible.push('arrow_1', 'arrow_2', 'arrow_3', 'arrow_4', 'arrow_5');
  
  return visible;
}

function toggleFilter(filters, key) {
  if (key === 'all') { 
    filters.clear(); 
    return; 
  }
  if (filters.has(key)) {
    filters.delete(key);
    const def = getFilterDefinition(key);
    if (def.group === 'family') {
      [...filters].forEach(k => {
        const kDef = getFilterDefinition(k);
        if (kDef.group === 'value' && kDef.family === key) filters.delete(k);
      });
    }
    if (def.group === 'arrow_parent') {
      [...filters].forEach(k => {
        const kDef = getFilterDefinition(k);
        if (kDef.group === 'arrow_num') filters.delete(k);
      });
    }
  } else {
    filters.add(key);
    const def = getFilterDefinition(key);
    if (def.group === 'value') {
      filters.add(def.family);
    }
    if (def.group === 'arrow_num') {
      filters.add(def.parent);
    }
  }
}

function renderFilters(rowId, filters, toggleFn, context) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const visible = getVisibleFilters(filters, context);
  row.innerHTML = visible.map(key => {
    const def = getFilterDefinition(key);
    const active = key === 'all' ? filters.size === 0 : filters.has(key);
    return `<button class="filter-btn${active ? ' active' : ''}" onclick="${toggleFn}('${key}')">${def.label}</button>`;
  }).join('');
}

function toggleHomeFilter(key) { toggleFilter(homeFilters, key); renderHomeFilters(); renderHome(); }
function toggleDiagFilter(key) { toggleFilter(diagFilters, key); renderDiagFilters(); renderDiag(); }

function renderHomeFilters() { renderFilters('homeFilterRow', homeFilters, 'toggleHomeFilter', 'home'); }
function renderDiagFilters() { renderFilters('diagFilterRow', diagFilters, 'toggleDiagFilter', 'diag'); }

function roundMatchesFilters(round, filters) {
  if (filters.size === 0) return true;
  const selectedFamilies = [...filters].filter(k => getFilterDefinition(k).group === 'family');
  const selectedValues = [...filters].filter(k => getFilterDefinition(k).group === 'value');
  
  if (selectedFamilies.length > 0 && !selectedFamilies.includes(round.mode)) return false;
  if (selectedValues.length > 0) {
    const rVal = round.mode === '3d' ? round.animal : `${round.distance}m`;
    if (!selectedValues.includes(rVal)) return false;
  }
  return true;
}

function sessionMatchesFilter(sessionObj, filters, context) {
  const activeLocSet = (activeLocationFilters[context] || new Set());
  if (context !== 'club' && activeLocSet.size > 0 && !activeLocSet.has(formatLocation(sessionObj.location))) return false;

  const activeArchSet = (activeArcherFilters[context] || new Set());
  if (activeArchSet.size > 0 && !activeArchSet.has(normalizePersonName(sessionObj.archerName))) return false;

  // Round type filter
  const rt = activeRoundTypeFilters[context] || 'all';
  if (rt !== 'all' && sessionObj.type !== rt) return false;

  // Date filtering — club uses its own store
  const dateFilter = context === 'club' ? activeDateFiltersClub : (activeDateFilters[context] || { start: null, end: null });
  if (dateFilter && (dateFilter.start || dateFilter.end)) {
    const sessionDate = new Date(sessionObj.date);
    if (dateFilter.start) {
      const startDate = new Date(dateFilter.start); startDate.setHours(0,0,0,0);
      if (sessionDate < startDate) return false;
    }
    if (dateFilter.end) {
      const endDate = new Date(dateFilter.end); endDate.setHours(23,59,59,999);
      if (sessionDate > endDate) return false;
    }
  }

  if (filters.size === 0) return true;

  const selectedScopes   = [...filters].filter(k => getFilterDefinition(k).group === 'scope');
  const selectedFamilies = [...filters].filter(k => getFilterDefinition(k).group === 'family');
  const selectedValues   = [...filters].filter(k => getFilterDefinition(k).group === 'value');

  if (selectedScopes.length > 0) {
    const sScope = isTournamentSession(sessionObj) ? 'tournament' : 'practice';
    if (!selectedScopes.includes(sScope)) return false;
  }
  if (selectedFamilies.length === 0 && selectedValues.length === 0) return true;
  return sessionObj.rounds.some(round => roundMatchesFilters(round, filters));
}

let isHomeSelectMode = false;
let homeSelectedSessions = new Set();
let homeSelectTimer = null;
let homeSelectStart = null;
let homeSelectTargetIdx = null;

function handleHomeItemPointerDown(e, idx) {
  if (e.button !== 0 && e.pointerType === 'mouse') return; // Ignore right-clicks
  homeSelectTargetIdx = idx;
  homeSelectStart = { x: e.clientX, y: e.clientY };
  
  homeSelectTimer = setTimeout(() => {
    if (homeSelectStart) {
      homeSelectStart = null;
      if (!isHomeSelectMode) {
        isHomeSelectMode = true;
        homeSelectedSessions.add(idx);
        if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback on hold
        renderHome();
      }
    }
  }, 400); // 400ms long-press

  document.addEventListener('pointermove', handleHomeItemPointerMove);
  document.addEventListener('pointerup', handleHomeItemPointerUp);
  document.addEventListener('pointercancel', handleHomeItemPointerCancel);
}

function handleHomeItemPointerMove(e) {
  if (!homeSelectStart) return;
  // If user scrolls or moves finger significantly, cancel the long press
  if (Math.hypot(e.clientX - homeSelectStart.x, e.clientY - homeSelectStart.y) > 10) {
    handleHomeItemPointerCancel();
  }
}

function handleHomeItemPointerUp(e) {
  cleanupHomeItemListeners();
  if (homeSelectStart) {
    clearTimeout(homeSelectTimer);
    homeSelectStart = null;
    if (isHomeSelectMode) {
       // Toggle selection if in select mode
       if (homeSelectedSessions.has(homeSelectTargetIdx)) {
         homeSelectedSessions.delete(homeSelectTargetIdx);
         if (homeSelectedSessions.size === 0) isHomeSelectMode = false;
       } else {
         homeSelectedSessions.add(homeSelectTargetIdx);
       }
       renderHome();
    } else {
       // Regular tap to open
       openSessionOverlay(homeSelectTargetIdx);
    }
  }
}

function handleHomeItemPointerCancel() {
  clearTimeout(homeSelectTimer);
  homeSelectStart = null;
  cleanupHomeItemListeners();
}

function cleanupHomeItemListeners() {
  document.removeEventListener('pointermove', handleHomeItemPointerMove);
  document.removeEventListener('pointerup', handleHomeItemPointerUp);
  document.removeEventListener('pointercancel', handleHomeItemPointerCancel);
}

function exitHomeSelectMode() {
  isHomeSelectMode = false;
  homeSelectedSessions.clear();
  renderHome();
}

function toggleHomeSelectAll() {
  const visibleSessions = window.currentVisibleHomeSessions || [];
  if (homeSelectedSessions.size === visibleSessions.length && visibleSessions.length > 0) {
    homeSelectedSessions.clear();
    isHomeSelectMode = false;
  } else {
    visibleSessions.forEach(s => {
      homeSelectedSessions.add(db.sessions.indexOf(s));
    });
  }
  renderHome();
}

function printSelectedSessions() {
  if (homeSelectedSessions.size === 0) return;
  const indices = Array.from(homeSelectedSessions).sort((a,b) => b - a);
  generateScorecard(indices);
}

function printActiveSession() {
  if (activeSessionIdx === null) return;
  generateScorecard([activeSessionIdx]);
}

function generatePrintableHeatmap(arrows) {
  const hc = document.createElement('canvas'); 
  const hx = hc.getContext('2d');
  const W2 = 400, CX2 = W2/2, R2 = W2/2-10; 
  hc.width = W2; hc.height = W2;

  hx.fillStyle = '#ffffff';
  hx.fillRect(0,0,W2,W2);

  for(let i=BULLSEYE_RINGS.length-1;i>=0;i--){
    const r=R2*BULLSEYE_RINGS[i].end;
    hx.beginPath(); hx.arc(CX2,CX2,r,0,Math.PI*2); 
    hx.fillStyle = BULLSEYE_RINGS[i].color === '#1a1a1a' ? '#333333' : BULLSEYE_RINGS[i].color; 
    hx.fill();
    hx.strokeStyle='rgba(0,0,0,0.5)'; hx.lineWidth=1; hx.stroke();
  }

  if(!arrows.length) return hc.toDataURL();

  const scale = 2;
  const gridW = W2 / scale; 
  const gridH = W2 / scale; 
  const density = new Float32Array(gridW * gridH);
  let maxDensity = 0;
  
  const kernelRadius = 12; 
  const kernelSize = kernelRadius * 2 + 1;
  const kernel = new Float32Array(kernelSize * kernelSize);
  const sigma = kernelRadius / 2.5; 
  for(let ky = -kernelRadius; ky <= kernelRadius; ky++) {
    for(let kx = -kernelRadius; kx <= kernelRadius; kx++) {
      const val = Math.exp(-(kx*kx + ky*ky) / (2 * sigma * sigma));
      kernel[(ky + kernelRadius) * kernelSize + (kx + kernelRadius)] = val;
    }
  }

  arrows.forEach(a => {
    if (a.score === 0 && a.nx === 1.5 && a.ny === 1.5) return; 
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

  if(maxDensity === 0) return hc.toDataURL();

  const heatCanvas = document.createElement('canvas'); 
  heatCanvas.width = gridW; 
  heatCanvas.height = gridH;
  const heatCtx = heatCanvas.getContext('2d');
  const imgData = heatCtx.createImageData(gridW, gridH);
  
  for(let i=0; i<density.length; i++) {
    const d = density[i];
    if (d < 0.02) continue; 
    const norm = Math.min(1, d / maxDensity);
    const h = (1.0 - norm) * 0.66; 
    const rgb = hslToRgb(h, 1.0, 0.5);
    const p = i * 4;
    imgData.data[p] = rgb[0];
    imgData.data[p+1] = rgb[1];
    imgData.data[p+2] = rgb[2];
    imgData.data[p+3] = Math.floor(Math.min(1, norm * 2.5) * 220); 
  }
  heatCtx.putImageData(imgData, 0, 0);

  hx.save(); 
  hx.beginPath(); hx.arc(CX2, CX2, R2, 0, Math.PI*2); hx.clip();
  hx.drawImage(heatCanvas, 0, 0, W2, W2); 
  hx.restore();

  for(let i=BULLSEYE_RINGS.length-1;i>=0;i--){
    const r=R2*BULLSEYE_RINGS[i].end;
    hx.beginPath(); hx.arc(CX2,CX2,r,0,Math.PI*2); hx.strokeStyle='rgba(0,0,0,0.3)'; hx.lineWidth=1; hx.stroke();
  }

  return hc.toDataURL();
}

function generateScorecard(indices) {
  const sessionsToPrint = indices.map(idx => db.sessions[idx]).filter(Boolean);
  if (!sessionsToPrint.length) return;
  generatePrintableSessionsReport(sessionsToPrint, 'Archery Scorecard');
}

function generatePrintableSessionsReport(sessionsToPrint, title = 'Archery Scorecard') {
  if (!sessionsToPrint.length) return;

  const allArrows = [];
  const roundScores = [];
  const archers = new Set();
  const bows = new Set();
  const locations = new Set();

  let sessionsHtml = '';

  sessionsToPrint.forEach(s => {
    const archer = normalizePersonName(s.archerName) || 'Unassigned';
    archers.add(archer);
    if (archer !== 'Unassigned' && db.deviceProfile.bows && db.deviceProfile.bows[archer]) {
       const b = db.deviceProfile.bows[archer];
       let bowDesc = [b.name, b.type, b.drawWeight].filter(Boolean).join(' - ');
       if (bowDesc) bows.add(bowDesc);
    }
    const loc = formatLocation(s.location);
    if (loc) locations.add(loc);

    let sessionRoundHtml = '';
    s.rounds.forEach((r, ri) => {
      const rScore = r.arrows.reduce((sum, a) => sum + a.score, 0);
      roundScores.push(rScore);
      r.arrows.forEach(a => { allArrows.push({...a}); });
      const info = roundDescriptor(r);
      const pips = r.arrows.map(a => `<span class="print-pip">${a.score===0?'M':a.score}</span>`).join('');
      sessionRoundHtml += `<div class="print-round-row"><strong>R${ri+1}</strong> <span style="margin:0 10px;color:#555">(${info.shortLabel})</span>: <div class="print-pips">${pips}</div> <strong style="font-size:24px; margin-left:10px;">${rScore}</strong></div>`;
    });

    sessionsHtml += `
      <div class="print-session-block">
        <h4>${new Date(s.date).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric', year:'numeric'})} - ${sessionTypeLabel(s)}</h4>
        ${sessionRoundHtml}
      </div>
    `;
  });

  const totalArrows = allArrows.length;
  const avgScore = roundScores.length ? (roundScores.reduce((a,b)=>a+b,0) / roundScores.length).toFixed(1) : '0.0';
  const bestScore = roundScores.length ? Math.max(...roundScores) : 0;

  const archerStr = Array.from(archers).join(', ') || 'Unassigned';
  const bowStr = Array.from(bows).join(', ') || 'Not specified';
  const locStr = Array.from(locations).join(', ') || 'Not specified';

  let zoneHtml = '';
  ZONES.forEach(z => {
    const count = allArrows.filter(a => a.score >= z.min && a.score <= z.max).length;
    const pct = totalArrows ? ((count / totalArrows) * 100).toFixed(1) : '0.0';
    zoneHtml += `<div class="print-zone-row"><div class="print-z-label">${z.label}</div><div class="print-z-bar"><div style="width:${pct}%; background:#555;"></div></div><div class="print-z-count">${count} (${pct}%)</div></div>`;
  });

  const targetDataUrl = generatePrintableHeatmap(allArrows);

  // Dynamically determine pluralization
  const archerLabel = archers.size > 1 ? 'Archers' : 'Archer';
  const bowLabel = bows.size > 1 ? 'Bows' : 'Bow';
  const locLabel = locations.size > 1 ? 'Locations' : 'Location';

  document.getElementById('printContainer').innerHTML = `
    <div class="print-header">
      <h2>${title}</h2>
      <div class="print-meta">
        <div><strong>${archerLabel}:</strong> ${archerStr}</div>
        <div><strong>${bowLabel}:</strong> ${bowStr}</div>
        <div><strong>${locLabel}:</strong> ${locStr}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
    <div class="print-stats-summary">
      <div><strong>Total Arrows:</strong> ${totalArrows}</div>
      <div><strong>Avg Round Score:</strong> ${avgScore}</div>
      <div><strong>Best Round Score:</strong> ${bestScore}</div>
    </div>
    <div class="print-visuals">
      <div class="print-heatmap">
        <h3 style="margin-bottom:15px; font-size:24px; font-family:'Bebas Neue',sans-serif;">Grouping Heatmap</h3>
        <img src="${targetDataUrl}" />
      </div>
      <div class="print-zones">
        <h3 style="margin-bottom:15px; font-size:24px; font-family:'Bebas Neue',sans-serif;">Score Distribution</h3>
        ${zoneHtml}
      </div>
    </div>
   <div class="print-sessions-list">
      <h3>Sessions Breakdown</h3>
      ${sessionsHtml}
    </div>
  `;

  // 1. Force the browser to render the new HTML instantly (Replaces setTimeout)
  const printContainer = document.getElementById('printContainer');
  // This command forces the browser to calculate the layout right now
  void printContainer.offsetHeight; 

  // 2. Trigger Print — window.print() works universally across browsers and
  // mobile WebView wrappers (Median/GoNative included). The print stylesheet
  // hides all UI and shows only printContainer, so the scorecard renders correctly.
  window.print();
}

function printGlobalSession() {
  const sessionObj = clubSessions.find(s => String(s.id) === String(activeGlobalSessionId));
  if (!sessionObj) return;
  const owner = normalizePersonName(sessionObj.archerName) || 'Club Archer';
  generatePrintableSessionsReport([sessionObj], `${owner} · ${sessionTypeLabel(sessionObj)}`);
}

function printGlobalSessionRound(sessionId, roundIndex) {
  const sessionObj = clubSessions.find(s => String(s.id) === String(sessionId));
  if (!sessionObj) return;
  const round = sessionObj.rounds?.[roundIndex];
  if (!round) return;
  const printableSession = {
    ...sessionObj,
    rounds: [round]
  };
  const info = roundDescriptor(round);
  const owner = normalizePersonName(sessionObj.archerName) || 'Club Archer';
  generatePrintableSessionsReport([printableSession], `${owner} · Round ${roundIndex + 1} (${info.shortLabel})`);
}
function deleteHomeSelected() {
  if (homeSelectedSessions.size === 0) return;
  appConfirm(`Permanently delete ${homeSelectedSessions.size} selected session(s)?`, async () => {
    // Splice array safely by deleting highest indices first
    const sortedIndices = Array.from(homeSelectedSessions).sort((a,b) => b - a);
    const sessionsToDelete = sortedIndices.map(idx => db.sessions[idx]);
    try {
      for (const s of sessionsToDelete) {
        if (s) await cfDeleteSession(s.id);
      }
    } catch (e) {
      appAlert('Could not delete one or more sessions globally. No local sessions were removed.');
      return;
    }
    sortedIndices.forEach(idx => {
      db.sessions.splice(idx, 1);
    });
    
    save();
    isHomeSelectMode = false;
    homeSelectedSessions.clear();
    renderHome();
    renderDiag();

  });
}

function renderHome() {
  const list = document.getElementById('recentList');
  const newestFirst = [...db.sessions].reverse().filter(sessionObj => 
    sessionMatchesFilter(sessionObj, homeFilters, 'home') && sessionMatchesSearch(sessionObj, homeSearchQuery)
  );
  const filtered = applySortToSessions(newestFirst, homeSort);
  window.currentVisibleHomeSessions = filtered;

  const archBtn = document.getElementById('homeArcherBtn');
  if (archBtn) archBtn.style.display = (db.deviceProfile.archers && db.deviceProfile.archers.length > 1) ? 'flex' : 'none';

  const filterBar = document.getElementById('homeFilterBar');
  const selectBar = document.getElementById('homeSelectionBar');
  
  if (isHomeSelectMode) {
    filterBar.style.display = 'none';
    selectBar.style.display = 'flex';
    document.getElementById('homeSelectCount').textContent = homeSelectedSessions.size;
    const isAll = homeSelectedSessions.size === filtered.length && filtered.length > 0;
    document.getElementById('homeSelectAllBtn').innerHTML = isAll ? icon('checkSquare') : icon('square');
  } else {
    filterBar.style.display = 'flex';
    selectBar.style.display = 'none';
  }

  if (!db.sessions.length) {
    list.innerHTML = `<div class="empty-state">No sessions yet.</div>`;
    return;
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="es-icon">${icon('search')}</div>No sessions match this filter.</div>`;
    return;
  }
  list.innerHTML = filtered.map((s) => {
    const realIdx = db.sessions.indexOf(s);
    const total = s.rounds.reduce((x,r) => x + r.arrows.reduce((y,a) => y + a.score, 0), 0);
    const isSel = homeSelectedSessions.has(realIdx);
    const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
    const loc = formatLocation(s.location);
    const typeLabel = sessionTypeLabel(s);
    
    const typeClass = s.type === 'bullseye_tournament' ? 'type-tournament' : s.type === '3d_tournament' ? 'type-3d' : 'type-practice';
    return `<div class="recent-item ${isSel ? 'selected' : ''} ${typeClass}" 
      onpointerdown="handleHomeItemPointerDown(event, ${realIdx})" 
      oncontextmenu="return false;"
      style="touch-action: pan-y;">
      <div class="ri-left">
        <span class="session-type">${sessionTypeBadge(s)}</span>
        <span style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;">${dateStr}${loc ? ' · ' + loc : ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <div class="ri-score">${total}</div>
        <span class="ri-chevron">${isHomeSelectMode ? (isSel ? icon('checkSquare') : icon('square')) : icon('arrowUpRight')}</span>
      </div>
    </div>`;
  }).join('');
}

function getSessionTotal(sessionObj) { return sessionObj.rounds.reduce((sum, round) => sum + round.arrows.reduce((roundSum, arrow) => roundSum + arrow.score, 0), 0); }

