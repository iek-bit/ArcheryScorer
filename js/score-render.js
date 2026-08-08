// ═══════════════════════════════════════════════
//  SCORE PAGE RENDER
// ═══════════════════════════════════════════════
function renderScorePickerSummaries() {
  const sessions = db.sessions;
  updateWeeklySummaryCardVisibility();

  // Format a session date as "Mon, Jan 1"
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Build the two-line summary HTML for a session
  function summaryHTML(last, best, fallback) {
    if (!last) return `<span>${fallback}</span>`;
    const loc  = formatLocation(last.location);
    const date = fmtDate(last.date);
    const meta = [date, loc].filter(Boolean).join(' · ');
    return `<span>Last: ${getSessionTotal(last)} · Best: ${best}</span>${meta ? `<br><span>${meta}</span>` : ''}`;
  }

  // Helper: most-recent + best for a session type
  function infoForType(type) {
    const matching = [...sessions].filter(s => s.type === type).reverse();
    if (!matching.length) return { last: null, best: null };
    return {
      last: matching[0],
      best: Math.max(...matching.map(s => getSessionTotal(s)))
    };
  }

  const bullseye = infoForType('bullseye_tournament');
  const threeD   = infoForType('3d_tournament');
  const practiceList = [...sessions].filter(s => s.type === 'practice').reverse();
  const lastPractice = practiceList[0] || null;
  const practiceBest = lastPractice ? Math.max(...practiceList.map(s => getSessionTotal(s))) : null;

  const bEl = document.getElementById('summaryBullseye');
  const tEl = document.getElementById('summary3d');
  const pEl = document.getElementById('summaryPractice');

  if (bEl) bEl.innerHTML = summaryHTML(bullseye.last, bullseye.best, '6 rounds · 30 arrows');
  if (tEl) tEl.innerHTML = summaryHTML(threeD.last,   threeD.best,   '6 animals · 30 arrows');
  if (pEl) pEl.innerHTML = summaryHTML(lastPractice,  practiceBest,  'Any distance, any target');
  
  // Update weekly summary
  updateWeeklySummary();
}

function updateWeeklySummary() {
  const weeklyData = computeWeeklySummaryData();
  const sessionsEl = document.getElementById('weeklySessions');
  const arrowsEl = document.getElementById('weeklyArrows');
  const avgEl = document.getElementById('weeklyAvg');

  if (sessionsEl) sessionsEl.textContent = weeklyData.sessionCount || '0';
  if (arrowsEl) arrowsEl.textContent = weeklyData.totalArrows || '0';
  if (avgEl) avgEl.textContent = weeklyData.avgScore > 0 ? weeklyData.avgScore : '—';

  // Highlight the "most impressive" stat
  const statEls = [
    { el: sessionsEl?.closest('.weekly-stat'), val: weeklyData.sessionCount },
    { el: arrowsEl?.closest('.weekly-stat'),   val: weeklyData.totalArrows },
    { el: avgEl?.closest('.weekly-stat'),       val: weeklyData.avgScore }
  ];
  statEls.forEach(s => s.el && s.el.classList.remove('highlight'));
  const best = statEls.reduce((a, b) => (b.val > a.val ? b : a), statEls[0]);
  if (best.val > 0 && best.el) best.el.classList.add('highlight');

  renderWeeklyGoals(weeklyData);
}

function expandWeeklySummary() {
  const weeklyData = computeWeeklySummaryData();
  const { now, sevenDaysAgo, weeklySessions, sessionCount, totalArrows, roundScores, avgScore, bestRound } = weeklyData;
  
  // Update detail overlay stats
  document.getElementById('weeklyDetailSessions').textContent = sessionCount;
  document.getElementById('weeklyDetailArrows').textContent = totalArrows;
  document.getElementById('weeklyDetailAvg').textContent = avgScore > 0 ? avgScore : '—';
  document.getElementById('weeklyDetailBest').textContent = bestRound > 0 ? bestRound : '—';
  
  // Date range
  const startDate = sevenDaysAgo.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endDate = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  document.getElementById('weeklySummaryDateRange').textContent = `${startDate} – ${endDate}`;
  
  // Daily breakdown
  const dailyData = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split('T')[0];
    dailyData[dateKey] = { sessions: 0, arrows: 0, date: date };
  }
  
  weeklySessions.forEach(s => {
    const dateKey = new Date(s.date).toISOString().split('T')[0];
    if (dailyData[dateKey]) {
      dailyData[dateKey].sessions++;
      dailyData[dateKey].arrows += s.rounds.reduce((sum, r) => sum + r.arrows.length, 0);
    }
  });
  
  const dailyBreakdownEl = document.getElementById('weeklyDailyBreakdown');
  const sortedDays = Object.values(dailyData).sort((a, b) => b.date - a.date);
  
  dailyBreakdownEl.innerHTML = sortedDays.map(day => {
    const dayName = day.date.toLocaleDateString(undefined, { weekday: 'short' });
    const dayDate = day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const hasData = day.sessions > 0;
    
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:${hasData ? 'var(--bg3)' : 'transparent'};border:1px solid var(--border);border-radius:10px;opacity:${hasData ? '1' : '0.5'};">
      <div style="flex:1;">
        <div style="font-size:13px;color:var(--text);">${dayName}</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);">${dayDate}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--accent);">${day.sessions} session${day.sessions !== 1 ? 's' : ''}</div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);">${day.arrows} arrows</div>
      </div>
    </div>`;
  }).join('');
  
  // Session type breakdown
  const typeData = {
    'bullseye_tournament': { count: 0, arrows: 0, label: 'Bullseye Tournament' },
    '3d_tournament': { count: 0, arrows: 0, label: '3D Tournament' },
    'practice': { count: 0, arrows: 0, label: 'Practice' }
  };
  
  weeklySessions.forEach(s => {
    if (typeData[s.type]) {
      typeData[s.type].count++;
      typeData[s.type].arrows += s.rounds.reduce((sum, r) => sum + r.arrows.length, 0);
    }
  });
  
  const typeBreakdownEl = document.getElementById('weeklyTypeBreakdown');
  typeBreakdownEl.innerHTML = Object.values(typeData)
    .filter(t => t.count > 0)
    .map(type => {
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;">
        <div style="flex:1;">
          <div style="font-size:13px;color:var(--text);">${type.label}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--accent);">${type.count} session${type.count !== 1 ? 's' : ''}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);">${type.arrows} arrows</div>
        </div>
      </div>`;
    }).join('') || '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px;">No sessions this week</div>';
  
  // Open the overlay
  document.getElementById('weeklySummaryOverlay').classList.add('open');
}


function renderScorePage() {
  if(!session) return;
  const cr = session.currentRound;
  const rn = sessionRoundNumber();
  const roundInfo = roundDescriptor(cr);
  const usingPhotoMode = isPhotoTournamentSession(session);

  document.getElementById('scoreTitle').textContent = isTournamentSession(session) ? `Round ${rn} / 6` : `Round ${rn}`;
  document.getElementById('scoreMeta').textContent = `${sessionTypeLabel(session).toUpperCase()}${usingPhotoMode ? ' · PHOTO MODE' : ''}`;

  document.getElementById('roundTargetLabel').textContent = 'TARGET';
  const targetOptions = document.getElementById('roundTargetOptions');
  if (session.type === 'practice') {
    renderPracticeTargetOptions(cr);
  } else {
    targetOptions.innerHTML = `<button class="dist-btn active" disabled>${roundInfo.label}</button>`;
  }

  const roundScore = cr.arrows.reduce((s,a)=>s+a.score,0);
  document.getElementById('roundScoreDisplay').textContent = cr.arrows.length ? roundScore : '—';

  const total = session.rounds.reduce((s,r)=>s+r.arrows.reduce((ss,a)=>ss+a.score,0),0) + roundScore;
  document.getElementById('sessionTotalDisplay').textContent = total;

  // Running average across all completed rounds + current round (if started)
  const completedScores = session.rounds.map(r => r.arrows.reduce((s,a)=>s+a.score,0));
  const allScores = cr.arrows.length ? [...completedScores, roundScore] : completedScores;
  const avgEl = document.getElementById('sessionAvgDisplay');
  if (avgEl) {
    if (allScores.length) {
      const avg = allScores.reduce((a,b)=>a+b,0) / allScores.length;
      avgEl.textContent = avg.toFixed(1);
    } else {
      avgEl.textContent = '—';
    }
  }

  const dots = document.getElementById('arrowDots');
  dots.innerHTML = '';
  for(let i=0;i<5;i++){
    const d = document.createElement('div');
    d.className = 'arrow-dot';
    if(i < cr.arrows.length) {
      const a = cr.arrows[i];
      d.classList.add('scored'); d.style.background = arrowColor(a.score); d.textContent = a.score === 0 ? 'M' : a.score;
    } else if(i === cr.arrows.length) { d.classList.add('current'); d.textContent = '·'; }
    else { d.textContent = '·'; }
    dots.appendChild(d);
  }

  const done = cr.arrows.length === 5;
  const undoBtn = document.getElementById('undoArrowBtn');
  undoBtn.disabled = !cr.arrows.length || cr.locked || usingPhotoMode;
  document.getElementById('undoSecondaryBtn').style.display = cr.locked ? 'none' : '';

  const notesInput = document.getElementById('activeRoundNotes');
  if (notesInput) {
    notesInput.value = cr.notes || '';
    notesInput.disabled = cr.locked;
  }
  const notesHeaderBtn = document.getElementById('notesHeaderBtn');
  if (notesHeaderBtn) {
    const hasNote = !!(cr.notes && cr.notes.trim());
    notesHeaderBtn.style.borderColor = hasNote ? 'var(--accent)' : '';
    notesHeaderBtn.style.color = hasNote ? 'var(--accent)' : '';
  }

  const completedRoundsBtn = document.getElementById('completedRoundsBtn');
  const completedRoundsMeta = document.getElementById('completedRoundsMeta');
  const completedRoundsOverlayMeta = document.getElementById('completedRoundsOverlayMeta');
  if (completedRoundsBtn) completedRoundsBtn.disabled = session.rounds.length === 0;
  if (completedRoundsMeta) completedRoundsMeta.textContent = session.rounds.length ? `${session.rounds.length} saved` : 'No rounds yet';
  if (completedRoundsOverlayMeta) {
    completedRoundsOverlayMeta.textContent = session.rounds.length
      ? `${session.rounds.length} completed round${session.rounds.length === 1 ? '' : 's'} in this session.`
      : 'No rounds completed yet.';
  }

  const overlay = document.getElementById('roundCompleteOverlay');
  const overlayTitle = document.getElementById('roundCompleteTitle');
  const overlayMessage = document.getElementById('roundCompleteMessage');
  const overlayPrimaryBtn = document.getElementById('roundCompletePrimaryBtn');
  const trophyIcon = document.getElementById('rcTrophyIcon');

  // Update tournament progress bar
  const tpb = document.getElementById('tournamentProgressBar');
  const tpbFill = document.getElementById('tournamentProgressFill');
  const tpbDots = document.getElementById('tournamentProgressDots');
  if (isTournamentSession(session) && tpb) {
    tpb.style.display = 'block';
    const completedRounds = session.rounds.length;
    const totalRounds = 6;
    const pct = Math.min(100, (completedRounds / totalRounds) * 100);
    if (tpbFill) tpbFill.style.width = pct + '%';
    if (tpbDots) {
      tpbDots.innerHTML = Array.from({length: totalRounds}, (_, i) =>
        `<div class="tpb-dot ${i < completedRounds ? 'done' : i === completedRounds ? 'current' : ''}"></div>`
      ).join('');
    }
  } else if (tpb) {
    tpb.style.display = 'none';
  }

  if (cr.locked && isTournamentSession(session) && rn === 6) {
    overlayTitle.textContent = session.type === '3d_tournament' ? '3D Tournament Complete' : 'Bullseye Tournament Complete';
    overlayMessage.textContent = 'Finalizing your tournament session...';
    overlayPrimaryBtn.style.display = 'none';
    overlay.classList.remove('open');
  } else if (done) {
    overlayTitle.textContent = 'Round Complete'; overlayMessage.textContent = 'Choose your next action.';
    overlayPrimaryBtn.style.display = '';
    overlayPrimaryBtn.textContent = isTournamentSession(session) && rn === 6 ? 'FINISH TOURNAMENT ✓' : 'NEXT ROUND →';

    // Populate round summary
    const summaryEl = document.getElementById('roundCompleteSummary');
    const bigScore = document.getElementById('rcRoundScore');
    if (cr.arrows.length) {
      const scores = cr.arrows.map(a => a.score);
      const roundTotal = scores.reduce((a,b)=>a+b,0);
      const bestArrow = Math.max(...scores);
      const avgArrow = (roundTotal / scores.length).toFixed(1);
      if (bigScore) bigScore.textContent = roundTotal;
      document.getElementById('rcBestArrow').textContent = bestArrow === 0 ? 'M' : bestArrow;
      document.getElementById('rcAvgArrow').textContent = avgArrow;
      if (trophyIcon) trophyIcon.style.color = roundTotal >= 45 ? 'var(--accent3)' : roundTotal >= 35 ? 'var(--accent)' : 'var(--muted)';
      // Trend vs previous rounds
      const prevScores = session.rounds.map(r => r.arrows.reduce((s,a)=>s+a.score,0));
      const trendEl = document.getElementById('rcTrend');
      if (prevScores.length) {
        const prevAvg = prevScores.reduce((a,b)=>a+b,0) / prevScores.length;
        const diff = roundTotal - prevAvg;
        const sign = diff > 0 ? '+' : '';
        trendEl.textContent = `${sign}${diff.toFixed(1)} vs session avg`;
        trendEl.style.color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--muted)';
      } else {
        trendEl.textContent = 'First round of this session';
        trendEl.style.color = 'var(--muted)';
      }
      if (summaryEl) summaryEl.style.display = 'block';
    }

    overlay.classList.add('open');
    // Skip the popup if the user has turned it off
    if (normalizePreferences(db.preferences || {}).showRoundComplete === false) {
      overlay.classList.remove('open');
    }
  } else { overlay.classList.remove('open'); }

  const list = document.getElementById('completedRounds');
  list.innerHTML = '';
  session.rounds.forEach((r,i)=>{
    const s = r.arrows.reduce((x,a)=>x+a.score,0);
    const completedRoundInfo = roundDescriptor(r);
    const row = document.createElement('div'); row.className = 'round-score-row';
    row.innerHTML = `<div class="rsr-label">Round ${i+1} · ${completedRoundInfo.shortLabel}</div>
      <div class="rsr-arrows">${r.arrows.map(a=>a.score===0?'M':a.score).join(' · ')}</div>
      <div class="rsr-score">${s}</div>`;
    list.appendChild(row);
  });

  const photoControls = document.getElementById('photoRoundControls');
  const targetWrap = document.querySelector('.target-wrap');
  const notesMargin = document.getElementById('activeRoundNotes');
  const scanBtn = document.getElementById('photoRoundScanBtn');
  const editBtn = document.getElementById('photoRoundEditBtn');
  const inlineReviewPanel = document.getElementById('photoRoundInlineReview');
  if (usingPhotoMode) {
    photoControls.classList.add('open');
    targetWrap.style.display = 'none';
    document.getElementById('missBtn').style.display = 'none';
    document.getElementById('zoomRingsBtn').style.display = 'none';
    setPhotoRoundSubtitle('Pick a tournament scorecard image and the app will detect and read it automatically.');
    if (scanBtn) {
      scanBtn.textContent = session.rounds.length ? 'Re-Scan Tournament' : 'Scan Tournament Scorecard';
      scanBtn.disabled = cr.locked;
    }
    if (editBtn) {
      editBtn.style.display = photoScoreState.reviewTournamentScores.length || session.rounds.length ? '' : 'none';
      editBtn.disabled = cr.locked;
    }
    if (notesMargin) notesMargin.style.marginTop = '12px';
  } else {
    photoControls.classList.remove('open');
    targetWrap.style.display = '';
    document.getElementById('missBtn').style.display = '';
    document.getElementById('zoomRingsBtn').style.display = '';
    if (notesMargin) notesMargin.style.marginTop = '8px';
    if (inlineReviewPanel) inlineReviewPanel.style.display = 'none';
    clearRoundPhotoScanState();
  }

  drawTarget(cr.arrows, cr.mode);
  updateScoreScrollLock();
}

function arrowColor(s) {
  if(s>=9) return '#f7e900'; if(s>=7) return '#e84040'; if(s>=5) return '#3b82f6';
  if(s>=3) return '#333'; if(s>=1) return '#aaa'; return '#666';
}

function setPracticeRoundTarget(mode, value) {
  if(!session || session.type !== 'practice') return;
  if (session.currentRound.arrows.length || session.currentRound.locked) return;
  session.currentRound = mode === '3d' ? createRound('3d', value) : createRound('bullseye', Number(value) === 15 ? 15 : 10);
  practiceTargetExpanded = null;
  renderScorePage();
}

let practiceTargetExpanded = null;

function togglePracticeCategory(cat) {
  practiceTargetExpanded = practiceTargetExpanded === cat ? null : cat;
  if (session && session.currentRound) renderPracticeTargetOptions(session.currentRound);
}

function renderPracticeTargetOptions(cr) {
  const targetOptions = document.getElementById('roundTargetOptions');
  if (!targetOptions) return;
  const locked = cr.arrows.length > 0 || cr.locked;
  const currentMode = cr.mode;
  const bullseyeActive = currentMode === 'bullseye';
  const threeDActive = currentMode === '3d';

  const bullseyeClass = bullseyeActive ? ' active' : '';
  const threeDClass = threeDActive ? ' active' : '';
  const disAttr = locked ? ' disabled' : '';
  const bullseyeChevron = practiceTargetExpanded === 'bullseye' ? ' ▲' : ' ▾';
  const threeDChevron = practiceTargetExpanded === '3d' ? ' ▲' : ' ▾';

  let subOptions = '';
  if (practiceTargetExpanded === 'bullseye') {
    subOptions = `<div style="width:100%;display:flex;gap:8px;flex-wrap:wrap;">` +
      [{distance:10,label:'10m'},{distance:15,label:'15m'}].map(opt => {
        const isActive = bullseyeActive && cr.distance === opt.distance;
        const dis = locked && !isActive ? ' disabled' : '';
        return `<button class="dist-btn${isActive ? ' active' : ''}"${dis} onclick="setPracticeRoundTarget('bullseye','${opt.distance}')">${opt.label}</button>`;
      }).join('') + `</div>`;
  } else if (practiceTargetExpanded === '3d') {
    subOptions = `<div style="width:100%;display:flex;gap:8px;flex-wrap:wrap;">` +
      THREE_D_TARGETS.map(target => {
        const isActive = threeDActive && cr.animal === target.key;
        const dis = locked && !isActive ? ' disabled' : '';
        return `<button class="dist-btn${isActive ? ' active' : ''}"${dis} onclick="setPracticeRoundTarget('3d','${target.key}')">${target.label}</button>`;
      }).join('') + `</div>`;
  }

  targetOptions.innerHTML =
    `<button class="dist-btn${bullseyeClass}"${disAttr} onclick="togglePracticeCategory('bullseye')">Bullseye${bullseyeChevron}</button>` +
    `<button class="dist-btn${threeDClass}"${disAttr} onclick="togglePracticeCategory('3d')">3D${threeDChevron}</button>` +
    subOptions;
}

function nextRound() {
  if(!session) return; const cr = session.currentRound;
  if(cr.locked || cr.arrows.length < 5) return;
  closeOverlay('roundCompleteOverlay');
  practiceTargetExpanded = null;
  // Reset ring zoom when moving to next round
  ringZoomActive = false;
  const zCanvas = document.getElementById('targetCanvas');
  const zBtn = document.getElementById('zoomRingsBtn');
  if (zCanvas) zCanvas.classList.remove('ring-zoom');
  if (zBtn) zBtn.classList.remove('zoomed');
  session.rounds.push({...cr, arrows:[...cr.arrows]});
  if(isTournamentSession(session) && session.rounds.length===6) { endSession(); return; }
  if (isTournamentSession(session)) session.currentRound = getCurrentTournamentRoundConfig(session);
  else session.currentRound = createRound(cr.mode, cr.mode === '3d' ? cr.animal : cr.distance);
  renderScorePage(); window.scrollTo(0,0);
  if (window.heatmapPanZoom) window.heatmapPanZoom.reset();
  if (window.timelinePanZoom) window.timelinePanZoom.reset();
}

