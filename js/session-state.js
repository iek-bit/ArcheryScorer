// ═══════════════════════════════════════════════
//  SESSION STATE
// ═══════════════════════════════════════════════
let session = null;
let finishingSession = null;
let pendingLocationSessionId = null;
let medianIOSGeoReady = !/MedianIOS/i.test(navigator.userAgent);
let locationInputDirty = false;
let threeDTournamentSetup = {startAnimal: 'turkey', direction: 1};
let pendingSessionType = null;
let pendingTournamentModeType = null;
let deviceNameOverlayContext = 'launch';
let photoScoreState = {
  context: 'beta',
  file: null,
  originalImageDataUrl: '',
  warpedImageDataUrl: '',
  processedImageDataUrl: '',
  overlayImageDataUrl: '',
  imageMeta: null,
  cellResults: [],
  reviewTournamentScores: [],
  predictionsCount: 0,
  validationIssues: [],
  isLoading: false,
  isReady: false
};

function waitForOpenCvReady() {
  if (window.cv?.Mat) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeoutAt = Date.now() + 15000;
    const check = () => {
      if (window.cv?.Mat) return resolve();
      if (Date.now() > timeoutAt) return reject(new Error('OpenCV.js did not finish loading.'));
      if (window.cv && typeof window.cv === 'object') {
        window.cv.onRuntimeInitialized = () => resolve();
      }
      setTimeout(check, 120);
    };
    check();
  });
}

function updatePhotoScoreEngineAvailability() {
  const detectBtn = document.getElementById('photoScoreDetectBtn');
  const ready = photoScoreEngine.opencvReady && photoScoreEngine.tesseractReady && !photoScoreEngine.error;
  photoScoreState.isReady = ready;
  if (detectBtn) detectBtn.disabled = !ready || !photoScoreState.originalImageDataUrl || photoScoreState.isLoading;
  if (photoScoreScriptStatusApplied) return;
  photoScoreScriptStatusApplied = true;
  if (ready) setPhotoScoreStatus('Photo-score engine ready. Choose a scorecard photo.');
  else if (photoScoreEngine.error) setPhotoScoreStatus(photoScoreEngine.error, 'error');
  else setPhotoScoreStatus('Loading the local photo-score engine…');
}

async function initPhotoScoreLibraries() {
  if (photoScoreEngine.initializing) return photoScoreEngine.readinessPromise;
  photoScoreEngine.initializing = true;
  photoScoreEngine.readinessPromise = (async () => {
    try {
      await waitForOpenCvReady();
      photoScoreEngine.opencvReady = true;
      if (!window.Tesseract?.recognize) throw new Error('Tesseract.js failed to load.');
      photoScoreEngine.tesseractReady = true;
      photoScoreEngine.error = '';
    } catch (error) {
      photoScoreEngine.error = error?.message || 'Could not load the local photo-score libraries.';
    } finally {
      updatePhotoScoreEngineAvailability();
    }
    return !photoScoreEngine.error;
  })();
  return photoScoreEngine.readinessPromise;
}

function isTournamentSession(sessionObj) { return sessionObj?.type === 'bullseye_tournament' || sessionObj?.type === '3d_tournament'; }
function isThreeDSession(sessionObj) { return sessionObj?.type === '3d_tournament'; }
function isPhotoTournamentSession(sessionObj = session) { return !!sessionObj && isTournamentSession(sessionObj) && sessionObj.scoringMode === 'photo'; }

function createRound(mode = 'bullseye', value = 10) {
  return normalizeRound(mode === '3d'
    ? {mode: '3d', animal: value, arrows: [], locked: false}
    : {mode: 'bullseye', distance: value, arrows: [], locked: false});
}

function roundDescriptor(round) {
  const normalized = normalizeRound(round);
  if (normalized.mode === '3d') return {mode: '3d', label: THREE_D_TARGET_LOOKUP[normalized.animal] || 'Turkey', shortLabel: THREE_D_TARGET_LOOKUP[normalized.animal] || 'Turkey'};
  return {mode: 'bullseye', label: `${normalized.distance}m`, shortLabel: `${normalized.distance}m`};
}

function getActiveGoals() {
  return normalizeGoals(db.goals).filter(goal => !goal.archived).slice(0, 3);
}

function historyCardEnabled() {
  return db.preferences?.historyCardEnabled !== false;
}

function getGoalMetricLabel(metric) {
  return {
    sessions: 'Sessions',
    arrows: 'Arrows',
    avg_score: 'Average Score',
    best_round: 'Best Round'
  }[metric] || 'Goal';
}

function computeWeeklySummaryData() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weeklySessions = db.sessions.filter(s => {
    const sessionDate = new Date(s.date);
    return sessionDate >= sevenDaysAgo && sessionDate <= now;
  });
  const totalArrows = weeklySessions.reduce((sum, s) => sum + s.rounds.reduce((rSum, r) => rSum + r.arrows.length, 0), 0);
  const roundScores = [];
  weeklySessions.forEach(s => s.rounds.forEach(r => roundScores.push(r.arrows.reduce((sum, a) => sum + a.score, 0))));
  const avgScore = roundScores.length ? Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length) : 0;
  const bestRound = roundScores.length ? Math.max(...roundScores) : 0;
  return { now, sevenDaysAgo, weeklySessions, sessionCount: weeklySessions.length, totalArrows, roundScores, avgScore, bestRound };
}

function getGoalCurrentValue(goal, weeklyData = computeWeeklySummaryData()) {
  switch (goal.metric) {
    case 'sessions': return weeklyData.sessionCount;
    case 'arrows': return weeklyData.totalArrows;
    case 'avg_score': return weeklyData.avgScore;
    case 'best_round': return weeklyData.bestRound;
    default: return 0;
  }
}

function getGoalProgress(goal, weeklyData = computeWeeklySummaryData()) {
  const current = getGoalCurrentValue(goal, weeklyData);
  const target = Math.max(1, Number(goal.target) || 1);
  const ratio = Math.min(current / target, 1);
  return {
    current,
    target,
    ratio,
    complete: current >= target
  };
}

function renderWeeklyGoals(weeklyData = computeWeeklySummaryData()) {
  const list = document.getElementById('weeklyGoalsList');
  if (!list) return;
  const goals = getActiveGoals();
  if (!goals.length) {
    list.innerHTML = '<div class="weekly-goals-empty">Add up to 3 goals in Settings to track progress here.</div>';
    return;
  }
  list.innerHTML = goals.map(goal => {
    const progress = getGoalProgress(goal, weeklyData);
    return `<div class="weekly-goal-item${progress.complete ? ' complete' : ''}">
      <div class="weekly-goal-top">
        <div class="weekly-goal-name">${getGoalMetricLabel(goal.metric)}</div>
        <div class="weekly-goal-progress">${progress.complete ? 'Complete' : `${progress.current} / ${progress.target}`}</div>
      </div>
      <div class="weekly-goal-track"><div class="weekly-goal-fill" style="width:${Math.round(progress.ratio * 100)}%"></div></div>
    </div>`;
  }).join('');
}

function updateWeeklySummaryCardVisibility() {
  const card = document.getElementById('weeklySummaryCard');
  if (!card) return;
  card.style.display = historyCardEnabled() ? '' : 'none';
}

function buildPreferencesPayload() {
  const bowData = normalizeBowSyncData(db.deviceProfile);
  return {
    preferences: normalizePreferences(db.preferences),
    goals: normalizeGoals(db.goals),
    savedLocations: normalizeSavedLocations(db.savedLocations),
    bowProfiles: bowData.bowProfiles,
    activeBowId: bowData.activeBowId,
    bows: bowData.bows
  };
}

async function syncPreferencesToCloud() {
  if (!hasGlobalAccount() || !cfReady()) return;
  try {
    const response = await cfPatchPreferences(buildPreferencesPayload());
    if (response?.preferences) db.preferences = normalizePreferences(response.preferences);
    if (response?.goals) db.goals = normalizeGoals(response.goals);
    if (response?.savedLocations) db.savedLocations = normalizeSavedLocations(response.savedLocations);
    if (response?.bowProfiles) db.deviceProfile.bowProfiles = response.bowProfiles;
    if (response?.activeBowId) db.deviceProfile.activeBowId = response.activeBowId;
    if (response?.bows) db.deviceProfile.bows = response.bows;
    save();
    renderHome();
    if (document.getElementById('page-settings')?.classList.contains('active')) renderGoalsSettings();
  } catch (e) {
    console.warn('Preference sync failed:', e.message);
    if (e.message.includes('401')) handleServerAuthInvalid();
  }
}

async function hydratePreferencesFromCloud({ preferServer = true } = {}) {
  if (!hasGlobalAccount() || !cfReady()) return;
  try {
    const response = await cfGetPreferences();
    const serverGoals = normalizeGoals(response?.goals);
    const serverPreferences = normalizePreferences(response?.preferences);
    const serverLocations = normalizeSavedLocations(response?.savedLocations);
    const hasServerBowData = !!(
      (response?.bowProfiles && Object.keys(response.bowProfiles).length) ||
      (response?.activeBowId && Object.keys(response.activeBowId).length) ||
      (response?.bows && Object.keys(response.bows).length)
    );
    const hasServerValues = response?.hasAccountSyncData === true || !!serverGoals.length || serverLocations.length > 0 || hasServerBowData;
    if (preferServer && hasServerValues) {
      db.goals = serverGoals;
      db.preferences = serverPreferences;
      if (serverLocations.length) db.savedLocations = serverLocations;
      if (response?.bowProfiles) db.deviceProfile.bowProfiles = response.bowProfiles;
      if (response?.activeBowId) db.deviceProfile.activeBowId = response.activeBowId;
      if (response?.bows) db.deviceProfile.bows = response.bows;
      save();
      renderHome();
      renderDiag();
      if (document.getElementById('locationsAccordionBody')?.classList.contains('open')) renderLocationsList();
      if (document.getElementById('bowInlineBody')?.classList.contains('open')) renderBowInline();
      if (document.getElementById('page-settings')?.classList.contains('active')) renderGoalsSettings();
    } else if (!hasServerValues) {
      await syncPreferencesToCloud();
    }
  } catch (e) {
    console.warn('Preference hydrate failed:', e.message);
    if (e.message.includes('401')) handleServerAuthInvalid();
  }
}

function getRoundMaxScore(round) {
  return normalizeRound(round).mode === '3d' ? 55 : 50;
}

function computeConsistencyPercent(rounds = []) {
  if (!Array.isArray(rounds) || rounds.length < 2) return null;
  const normalizedScores = rounds.map(round => {
    const total = round.arrows.reduce((sum, arrow) => sum + arrow.score, 0);
    return total / getRoundMaxScore(round);
  });
  const mean = normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length;
  const sd = Math.sqrt(normalizedScores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / normalizedScores.length);
  return Math.round(clamp(100 - (sd / 0.20) * 100, 0, 100));
}

function getPbBucketKey(round) {
  const info = roundDescriptor(round);
  return `${info.mode}:${info.shortLabel}`;
}

function getBestSavedRoundScoreForBucket(bucketKey) {
  let best = null;
  db.sessions.forEach(savedSession => {
    savedSession.rounds.forEach(savedRound => {
      if (getPbBucketKey(savedRound) !== bucketKey) return;
      const total = savedRound.arrows.reduce((sum, arrow) => sum + arrow.score, 0);
      best = best === null ? total : Math.max(best, total);
    });
  });
  return best;
}

function getTournamentRoundPersonalBestScore(sessionType, sessionsSource = db.sessions) {
  if (sessionType !== 'bullseye_tournament' && sessionType !== '3d_tournament') return null;
  let best = null;
  (Array.isArray(sessionsSource) ? sessionsSource : []).forEach(savedSession => {
    if (savedSession?.type !== sessionType) return;
    (savedSession.rounds || []).forEach(savedRound => {
      const total = (savedRound.arrows || []).reduce((sum, arrow) => sum + (arrow.score || 0), 0);
      best = best === null ? total : Math.max(best, total);
    });
  });
  return best;
}

function isTournamentRoundPersonalBest(sessionObj, round, sessionsSource = db.sessions) {
  if (!sessionObj || !round) return false;
  if (sessionObj.type !== 'bullseye_tournament' && sessionObj.type !== '3d_tournament') return false;
  const total = (round.arrows || []).reduce((sum, arrow) => sum + (arrow.score || 0), 0);
  const best = getTournamentRoundPersonalBestScore(sessionObj.type, sessionsSource);
  return best !== null && total === best;
}

let pbCelebrationTimer = null;
let pbConfettiCleanupTimer = null;
function launchPbConfetti() {
  const container = document.getElementById('pbCelebrationConfetti');
  if (!container) return;
  const colors = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', '#ffffff', '#52c278'];
  container.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement('span');
    piece.className = `pb-confetti-piece${i % 3 === 0 ? ' ribbon' : ''}`;
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 180}ms`;
    piece.style.setProperty('--pb-dx', `${(Math.random() - 0.5) * 120}px`);
    piece.style.setProperty('--pb-rot', `${(Math.random() - 0.5) * 520}deg`);
    container.appendChild(piece);
  }
  clearTimeout(pbConfettiCleanupTimer);
  pbConfettiCleanupTimer = setTimeout(() => {
    container.innerHTML = '';
  }, 1600);
}

function showPersonalBestCelebration(round) {
  if (db.preferences?.pbCelebrationsEnabled === false) return;
  if (!round || round.arrows.length < 5) return;
  const overlay = document.getElementById('pbCelebration');
  if (!overlay) return;
  const descriptor = roundDescriptor(round).shortLabel;
  const score = round.arrows.reduce((sum, arrow) => sum + arrow.score, 0);
  document.getElementById('pbCelebrationTitle').textContent = `New ${descriptor} PB`;
  document.getElementById('pbCelebrationSub').textContent = `Best completed ${descriptor} round so far`;
  document.getElementById('pbCelebrationValue').textContent = `${score} points`;
  launchPbConfetti();
  overlay.classList.add('show');
  clearTimeout(pbCelebrationTimer);
  pbCelebrationTimer = setTimeout(() => overlay.classList.remove('show'), 2200);
}

function maybeCelebrateRoundPB(round, options = {}) {
  if (!round || !Array.isArray(round.arrows) || round.arrows.length < 5) return;
  if (db.preferences?.pbCelebrationsEnabled === false) return;
  if (session?.ephemeral || options.ephemeral) return;
  const bucketKey = getPbBucketKey(round);
  const total = round.arrows.reduce((sum, arrow) => sum + arrow.score, 0);
  const existingBest = getBestSavedRoundScoreForBucket(bucketKey);
  if (existingBest === null || total > existingBest) showPersonalBestCelebration(round);
}

function buildInsights(rounds = [], allArrows = []) {
  const consistency = computeConsistencyPercent(rounds);
  const grouped = { bullseye10: [], bullseye15: [], animals: {} };
  rounds.forEach(round => {
    const total = round.arrows.reduce((sum, arrow) => sum + arrow.score, 0) / getRoundMaxScore(round);
    if (round.mode === 'bullseye' && round.distance === 10) grouped.bullseye10.push(total);
    else if (round.mode === 'bullseye' && round.distance === 15) grouped.bullseye15.push(total);
    else if (round.mode === '3d') {
      grouped.animals[round.animal] = grouped.animals[round.animal] || [];
      grouped.animals[round.animal].push(total);
    }
  });
  let avgX = 0, avgY = 0;
  const plottedArrows = allArrows.filter(arrow => typeof arrow.nx === 'number' && typeof arrow.ny === 'number');
  if (plottedArrows.length) {
    avgX = plottedArrows.reduce((sum, arrow) => sum + arrow.nx, 0) / plottedArrows.length;
    avgY = plottedArrows.reduce((sum, arrow) => sum + arrow.ny, 0) / plottedArrows.length;
  }
  const averageSpread = plottedArrows.length
    ? plottedArrows.reduce((sum, arrow) => sum + Math.hypot((arrow.nx || 0) - avgX, (arrow.ny || 0) - avgY), 0) / plottedArrows.length
    : null;
  const biasX = avgX > 0.08 ? 'right' : avgX < -0.08 ? 'left' : 'centered';
  const biasY = avgY > 0.08 ? 'low' : avgY < -0.08 ? 'high' : 'centered';
  const groupingHeadline = averageSpread === null
    ? 'Need more arrow data'
    : averageSpread < 0.18 ? 'Tight grouping'
    : averageSpread < 0.32 ? 'Solid grouping'
    : 'Loose grouping';
  const groupingBody = averageSpread === null
    ? 'Shoot more completed rounds to unlock grouping insights.'
    : biasX === 'centered' && biasY === 'centered'
      ? 'Your average impact point is staying close to center with the current filtered data.'
      : `Your average impact point trends ${biasY !== 'centered' ? `${biasY}${biasX !== 'centered' ? '-' : ''}` : ''}${biasX !== 'centered' ? biasX : ''}.`;
  const groupingTip = averageSpread === null
    ? 'Complete a couple more rounds to compare your impact pattern.'
    : averageSpread < 0.18
      ? 'Keep your current shot routine consistent and protect this grouping quality.'
      : 'Focus on repeatable anchor and release timing to shrink the spread.';
  const consistencyHeadline = consistency === null
    ? 'Need 2+ rounds'
    : consistency >= 85 ? 'Very steady scoring'
    : consistency >= 65 ? 'Moderately steady'
    : 'Scores swing a bit';
  const consistencyBody = consistency === null
    ? 'Finish at least two rounds inside the current filters to measure score stability.'
    : `Your current consistency is ${consistency}%, based on how tightly your normalized round scores cluster together.`;
  const consistencyTip = consistency === null
    ? 'Use the same filters and shoot another round for a real comparison.'
    : consistency >= 85
      ? 'You are repeating performance well. Push for small accuracy gains without changing too much.'
      : 'Try reducing rushed shots and keep your pre-shot routine identical from arrow to arrow.';
  const distanceEntries = [];
  if (grouped.bullseye10.length) distanceEntries.push({ label: '10m', value: Math.round((grouped.bullseye10.reduce((a, b) => a + b, 0) / grouped.bullseye10.length) * 100) });
  if (grouped.bullseye15.length) distanceEntries.push({ label: '15m', value: Math.round((grouped.bullseye15.reduce((a, b) => a + b, 0) / grouped.bullseye15.length) * 100) });
  Object.entries(grouped.animals).forEach(([animal, values]) => {
    distanceEntries.push({ label: THREE_D_TARGET_LOOKUP[animal] || animal, value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) });
  });
  distanceEntries.sort((a, b) => b.value - a.value);
  return {
    overview: {
      headline: rounds.length ? `${rounds.length} filtered round${rounds.length === 1 ? '' : 's'}` : 'No filtered rounds yet',
      body: rounds.length ? `${allArrows.length} arrows are included in the current stats view.` : 'Adjust your filters or finish a saved round to generate insights.',
      tip: rounds.length ? `Consistency is ${consistency === null ? 'not ready yet' : `${consistency}%`}.` : 'Insights always follow the same filters as the Stats page.'
    },
    grouping: { headline: groupingHeadline, body: groupingBody, tip: groupingTip },
    consistency: { headline: consistencyHeadline, body: consistencyBody, tip: consistencyTip, value: consistency },
    performance: distanceEntries
  };
}

function renderInsightsPage() {
  const rounds = getFilteredRounds();
  const allArrows = rounds.flatMap(round => round.arrows);
  const insights = buildInsights(rounds, allArrows);
  const grid = document.getElementById('insightsGrid');
  const meta = document.getElementById('insightsDataMeta');
  const subtitle = document.getElementById('insightsSubtitle');
  if (meta) meta.textContent = 'Current stats filters';
  if (subtitle) subtitle.textContent = rounds.length ? 'Every card below uses the same rounds you are viewing on the Stats page.' : 'Finish a few rounds or widen your filters to unlock insight cards.';
  if (!grid) return;
  const performanceMarkup = insights.performance.length >= 1
    ? `<div class="insight-headline">${insights.performance[0].label} leads</div>
       <div class="insight-body">${insights.performance.map(item => `${item.label} ${item.value}%`).join(' · ')}</div>
       <div class="insight-tip">Tip: Compare your highest and lowest normalized buckets to see where your setup feels most repeatable.</div>`
    : `<div class="insight-empty">Need more saved rounds across distances or 3D animals before the app can compare target-specific performance.</div>`;
  grid.innerHTML = `
    <div class="insight-card">
      <div class="insight-card-head"><div class="insight-card-icon">${icon('pulse')}</div><div><div class="insight-card-title">Overview</div><div class="insight-card-meta">Current filter set</div></div></div>
      <div class="insight-headline">${insights.overview.headline}</div>
      <div class="insight-body">${insights.overview.body}</div>
      <div class="insight-tip">${insights.overview.tip}</div>
    </div>
    <div class="insight-card">
      <div class="insight-card-head"><div class="insight-card-icon">${icon('target')}</div><div><div class="insight-card-title">Grouping</div><div class="insight-card-meta">Arrow placement</div></div></div>
      <div class="insight-headline">${insights.grouping.headline}</div>
      <div class="insight-body">${insights.grouping.body}</div>
      <div class="insight-tip">${insights.grouping.tip}</div>
    </div>
    <div class="insight-card">
      <div class="insight-card-head"><div class="insight-card-icon">${icon('trophy')}</div><div><div class="insight-card-title">Consistency</div><div class="insight-card-meta">Score stability</div></div></div>
      <div class="insight-headline">${insights.consistency.value === null ? '—' : `${insights.consistency.value}%`}</div>
      <div class="insight-body">${insights.consistency.body}</div>
      <div class="insight-tip">${insights.consistency.tip}</div>
    </div>
    <div class="insight-card">
      <div class="insight-card-head"><div class="insight-card-icon">${icon('bow')}</div><div><div class="insight-card-title">Distance / Target Performance</div><div class="insight-card-meta">Normalized round strength</div></div></div>
      ${performanceMarkup}
    </div>
  `;
}

function sessionTypeLabel(sessionObj) {
  if (sessionObj?.type === 'bullseye_tournament') return 'Bullseye Tournament';
  if (sessionObj?.type === '3d_tournament') return '3D Tournament';
  return 'Practice';
}

function sessionTypeBadge(sessionObj) {
  if (sessionObj?.type === 'bullseye_tournament') return `${icon('trophy', 'type-icon')}Bullseye Tournament`;
  if (sessionObj?.type === '3d_tournament') return `${icon('trophy', 'type-icon')}3D Tournament`;
  return `${icon('target', 'type-icon')}Practice`;
}

function getThreeDTournamentSequence(startAnimal = 'turkey', direction = 1) {
  const startIdx = Math.max(0, THREE_D_TARGETS.findIndex(target => target.key === startAnimal));
  return Array.from({length: THREE_D_TARGETS.length}, (_, offset) => {
    const index = (startIdx + direction * offset + THREE_D_TARGETS.length) % THREE_D_TARGETS.length;
    return THREE_D_TARGETS[index].key;
  });
}

function getCurrentTournamentRoundConfig(sessionObj = session) {
  if (!sessionObj) return createRound('bullseye', 10);
  const roundNumber = sessionObj.rounds.length;
  if (sessionObj.type === '3d_tournament') {
    const sequence = Array.isArray(sessionObj.tournamentSequence) && sessionObj.tournamentSequence.length === 6
      ? sessionObj.tournamentSequence
      : getThreeDTournamentSequence(sessionObj.startAnimal, sessionObj.direction);
    return createRound('3d', sequence[roundNumber] || sequence[0] || 'turkey');
  }
  return createRound('bullseye', roundNumber < 3 ? 10 : 15);
}

function isMedianAndroidAvailable() { return !!window.median?.android?.geoLocation; }

function persistTheme() {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(themeState));
  } catch (error) {
    console.warn('Failed to save theme:', error);
  }
}

function resolveThemePreset(name) {
  if (name === 'auto') return systemThemeQuery?.matches ? THEME_PRESETS.dark : THEME_PRESETS.white;
  return THEME_PRESETS[name] || THEME_PRESETS.dark;
}

function getActiveTheme() {
  const preset = resolveThemePreset(themeState.preset);
  if (themeState.preset === 'auto') return {...preset};
  return { ...preset, accent: themeState.accent || preset.accent, accent2: themeState.accent2 || preset.accent2, accent3: themeState.accent3 || preset.accent3, text: themeState.text || preset.text, gold: themeState.accent || preset.gold };
}

function renderThemePresets() { syncThemeDropdown(); }

function getThemeColorLabel(key) {
  if (key === 'accent') return 'Primary Color';
  if (key === 'accent2') return 'Secondary Color';
  if (key === 'accent3') return 'Tertiary Color';
  return 'Text Color';
}

function renderThemeTrigger(key, triggerId) {
  const theme = getActiveTheme();
  const trigger = document.getElementById(triggerId);
  if (!trigger) return;
  const current = theme[key];
  const light = ['#ffffff', '#f8fafc', '#ecf3ec'].includes(current.toLowerCase()) ? ' light' : '';
  trigger.innerHTML = `<span class="theme-trigger-swatch${light}" style="--option-color:${current}"></span><span>${getThemeColorLabel(key)}</span>`;
}

function renderThemeOptions() {
  renderThemeTrigger('accent', 'primaryColorTrigger');
  renderThemeTrigger('accent2', 'secondaryColorTrigger');
  renderThemeTrigger('accent3', 'tertiaryColorTrigger');
  renderThemeTrigger('text', 'textColorTrigger');
  const container = document.getElementById('themeColorOverlayOptions');
  const title = document.getElementById('themeColorOverlayTitle');
  if (!container || !title) return;
  const theme = getActiveTheme();
  title.textContent = getThemeColorLabel(activeThemeColorKey);
  container.innerHTML = THEME_COLOR_OPTIONS[activeThemeColorKey].map(color => {
    const active = theme[activeThemeColorKey].toLowerCase() === color.toLowerCase() ? ' active' : '';
    const light = ['#ffffff', '#f8fafc', '#ecf3ec'].includes(color.toLowerCase()) ? ' light' : '';
    return `<button class="theme-option${active}${light}" style="--option-color:${color}" onclick="selectThemeColor('${activeThemeColorKey}','${color}')" aria-label="${activeThemeColorKey} ${color}"></button>`;
  }).join('');
}

function openThemeColorPicker(key) {
  activeThemeColorKey = key;
  renderThemeOptions();
  document.getElementById('themeColorOverlay').classList.add('open');
}

function selectThemeColor(key, color) {
  updateCustomTheme(key, color);
  closeOverlay('themeColorOverlay');
}

function refreshThemeSensitiveUI() {
  if (session) renderScorePage();
  else drawTarget([]);
  if (document.getElementById('page-home').classList.contains('active')) renderHome();
  if (document.getElementById('page-diag').classList.contains('active')) renderDiag();
}

function applyTheme() {
  const theme = getActiveTheme();
  const root = document.documentElement;
  Object.entries(theme).forEach(([key, value]) => {
    if (key === 'name') return;
    root.style.setProperty(`--${key}`, value);
  });
  renderThemePresets();
  renderThemeOptions();
  refreshThemeSensitiveUI();
}

function applyPresetTheme(name) {
  const preset = resolveThemePreset(name);
  if (!preset) return;
  if (name === 'auto') {
    themeState = {preset: 'auto'};
    persistTheme(); applyTheme(); return;
  }
  themeState = { preset: name, accent: preset.accent, accent2: preset.accent2, accent3: preset.accent3, text: preset.text };
  persistTheme(); applyTheme();
}

function updateCustomTheme(key, value) {
  if (!['accent', 'accent2', 'accent3', 'text'].includes(key)) return;
  if (themeState.preset === 'auto') {
    const resolvedPresetName = systemThemeQuery?.matches ? 'dark' : 'white';
    themeState = {
      preset: resolvedPresetName,
      accent: THEME_PRESETS[resolvedPresetName].accent,
      accent2: THEME_PRESETS[resolvedPresetName].accent2,
      accent3: THEME_PRESETS[resolvedPresetName].accent3,
      text: THEME_PRESETS[resolvedPresetName].text
    };
  }
  themeState[key] = value;
  persistTheme(); applyTheme();
}

// ── Account popup ─────────────────────────────────────────────────────────────
function openAccountPopup() {
  const account = getLoggedInAccount();
  const guestMode = !account && isGuestMode();
  document.getElementById('accountPopupName').textContent = account?.username || (guestMode ? (normalizePersonName(db.deviceProfile?.activeArcher) || 'Guest') : '—');
  document.querySelector('.account-popup-sub').textContent = guestMode ? 'Guest mode · local only' : 'Signed in';
  const betaBtn = document.getElementById('accountPopupBetaBtn');
  const betaLabel = document.getElementById('accountPopupBetaLabel');
  if (betaBtn) betaBtn.style.display = account ? 'flex' : 'none';
  if (betaLabel) betaLabel.textContent = `Beta Features: ${betaFeaturesEnabled() ? 'On' : 'Off'}`;
  document.getElementById('accountPopupEditUsernameBtn').style.display = account ? 'flex' : 'none';
  document.getElementById('accountPopupEditPasswordBtn').style.display = account ? 'flex' : 'none';
  document.getElementById('accountPopupDeleteBtn').style.display = account ? 'flex' : 'none';
  const switchBtn = document.getElementById('accountPopupSwitchBtn');
  if (switchBtn) switchBtn.innerHTML = `${icon('edit')} ${account ? 'Switch Account' : 'Sign In / Create Account'}`;
  document.getElementById('accountPopupOverlay').classList.add('open');
}

function closeAccountPopup(e) {
  if (e && e.target !== document.getElementById('accountPopupOverlay')) return;
  document.getElementById('accountPopupOverlay').classList.remove('open');
}

// ── Change username ────────────────────────────────────────────────────────────
function openEditUsernameOverlay() {
  document.getElementById('editUsernameInput').value = '';
  document.getElementById('editUsernamePassword').value = '';
  document.getElementById('editUsernameOverlay').classList.add('open');
  setTimeout(() => document.getElementById('editUsernameInput').focus(), 80);
}

async function submitChangeUsername() {
  const newUsername = document.getElementById('editUsernameInput').value.trim();
  const password    = document.getElementById('editUsernamePassword').value;
  const account     = getLoggedInAccount();
  if (!newUsername) { appAlert('Please enter a new username.'); return; }
  if (!password)    { appAlert('Please enter your current password to confirm.'); return; }
  if (newUsername.toLowerCase() === account?.username?.toLowerCase()) {
    appAlert('That is already your username.'); return;
  }
  try {
    // Check availability first
    const taken = await cfCheckUsername(newUsername);
    if (taken) { appAlert(`The username "${newUsername}" is already taken. Please choose another.`); return; }
    // Send change request to server
    await cfFetch('/account/update-username', {
      method: 'POST',
      body: JSON.stringify({ oldUsername: account.username, password, newUsername })
    });
    // Update local sessions and profile
    db.sessions.forEach(s => { if (s.archerName === account.username) s.archerName = newUsername; });
    db.deviceProfile.activeArcher = newUsername;
    db.deviceProfile.archers = db.deviceProfile.archers.map(a => a === account.username ? newUsername : a);
    setLoggedInAccount(newUsername, password);
    save();
    closeOverlay('editUsernameOverlay');
    updateAccountUI();
    renderHome(); renderDiag();
    appAlert(`Username changed to "${newUsername}".`);
  } catch(e) {
    if (e.message.includes('401')) {
      handleServerAuthInvalid();
    }
    else if (e.message.includes('409')) appAlert(`The username "${newUsername}" is already taken.`);
    else appAlert('Could not change username. Check your connection.');
  }
}

// ── Change password ────────────────────────────────────────────────────────────
function openEditPasswordOverlay() {
  document.getElementById('editNewPassword').value = '';
  document.getElementById('editConfirmPassword').value = '';
  document.getElementById('editPasswordOverlay').classList.add('open');
  setTimeout(() => document.getElementById('editNewPassword').focus(), 80);
}

async function submitChangePassword() {
  const newPw     = document.getElementById('editNewPassword').value;
  const confirmPw = document.getElementById('editConfirmPassword').value;
  const account   = getLoggedInAccount();
  if (!account?.username || !account?.password) { appAlert('Please log in again before changing your password.'); return; }
  if (!newPw)     { appAlert('Please enter a new password.'); return; }
  if (newPw.length < 4) { appAlert('New password must be at least 4 characters.'); return; }
  if (newPw !== confirmPw) { appAlert('New passwords do not match.'); return; }
  try {
    await cfFetch('/account/update-password', {
      method: 'POST',
      body: JSON.stringify({ username: account.username, oldPassword: account.password, newPassword: newPw })
    });
    setLoggedInAccount(account.username, newPw);
    closeOverlay('editPasswordOverlay');
    appAlert('Password changed globally. Any other devices signed in to this account have been signed out and will need to log in again.');
  } catch(e) {
    if (e.message.includes('401')) {
      handleServerAuthInvalid();
    }
    else appAlert('Could not change password. Check your connection.');
  }
}

// ── Delete account ─────────────────────────────────────────────────────────────
function confirmDeleteAccount() {
  appConfirm('Delete your account? This will permanently remove all your sessions from the club server. Your local data will also be cleared.', async () => {
    const account = getLoggedInAccount();
    try {
      if (account?.username && account?.password) {
        await cfDeleteOwnAccount(account.username, account.password);
      }
    } catch (e) {
      if (e.message.includes('401')) {
        handleServerAuthInvalid();
      } else {
        appAlert('Could not delete your account on the club server. Your local data was not removed.');
      }
      return;
    }
    clearLoggedInAccount();
    try { localStorage.removeItem(SYNCED_KEY); } catch {}
    db = { sessions: [], savedLocations: [], deviceProfile: { name: '', archers: [], activeArcher: '' }, preferences: normalizePreferences(), goals: [] };
    session = null; finishingSession = null; activeSessionIdx = null;
    save(); resetActiveSessionUI();
    document.querySelectorAll('.overlay, .detail-overlay').forEach(el => el.classList.remove('open'));
    renderHome(); renderDiag(); updateAccountUI();
    openAccountOverlay('login');
  });
}

// ── Multi-bow profile helpers ──────────────────────────────────────────────────
// db.deviceProfile.bowProfiles[archerName] = [ { id, name, type, drawWeight, aimingPoints, notes }, ... ]
// db.deviceProfile.activeBowId[archerName] = 'bow-id-string'

function getBowProfiles(archerName) {
  if (!db.deviceProfile.bowProfiles) db.deviceProfile.bowProfiles = {};
  if (!db.deviceProfile.bowProfiles[archerName]) {
    // Migrate legacy single bow if it exists
    const legacy = (db.deviceProfile.bows || {})[archerName];
    if (legacy && (legacy.name || legacy.type || legacy.drawWeight)) {
      const migrated = { id: 'bow-' + Date.now(), ...legacy };
      db.deviceProfile.bowProfiles[archerName] = [migrated];
      if (!db.deviceProfile.activeBowId) db.deviceProfile.activeBowId = {};
      db.deviceProfile.activeBowId[archerName] = migrated.id;
    } else {
      db.deviceProfile.bowProfiles[archerName] = [];
    }
  }
  return db.deviceProfile.bowProfiles[archerName];
}

function getActiveBow(archerName) {
  const profiles = getBowProfiles(archerName);
  if (!profiles.length) return null;
  const activeId = (db.deviceProfile.activeBowId || {})[archerName];
  return profiles.find(b => b.id === activeId) || profiles[0];
}

function setActiveBow(archerName, bowId) {
  if (!db.deviceProfile.activeBowId) db.deviceProfile.activeBowId = {};
  db.deviceProfile.activeBowId[archerName] = bowId;
  save();
  renderBowInline();
  syncPreferencesToCloud();
}

// ── Bow inline panel ───────────────────────────────────────────────────────────
function toggleBowInline(headerEl) {
  const body    = document.getElementById('bowInlineBody');
  const chevron = headerEl.querySelector('.bow-chevron');
  const isOpen  = body.classList.toggle('open');
  chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
  if (isOpen) renderBowInline();
}

function renderBowInline() {
  const name     = getDeviceArcherName();
  const profiles = getBowProfiles(name);
  const bow      = getActiveBow(name);
  const body     = document.getElementById('bowInlineBody');
  const sub      = document.getElementById('bowInlineSub');

  if (!bow) {
    sub.textContent = 'No bow profile saved';
    body.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:8px 0;">
      Tap + to add your first bow.
    </p>`;
    return;
  }

  sub.textContent = [bow.name, bow.type].filter(Boolean).join(' · ') || 'Active bow';

  // Active bow selector (if more than one)
  let selectorHtml = '';
  if (profiles.length > 1) {
    selectorHtml = `<div style="margin-bottom:12px;">
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Active Bow</div>
      <div style="display:flex;flex-direction:column;gap:6px;">` +
      profiles.map(b => `
        <button onclick="setActiveBow(${JSON.stringify(name)}, ${JSON.stringify(b.id)})"
          style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid ${b.id === bow.id ? 'var(--accent)' : 'var(--border)'};background:${b.id === bow.id ? 'rgba(232,197,71,.08)' : 'none'};cursor:pointer;text-align:left;width:100%;color:var(--text);">
          <span style="font-size:13px;font-weight:500;flex:1;">${b.name || 'Unnamed Bow'}</span>
          <span style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;">${b.type || ''}</span>
          ${b.id === bow.id ? '<span style="color:var(--accent);font-size:11px;">● Active</span>' : ''}
        </button>`).join('') +
      `</div></div>`;
  }

  const rows = [
    bow.name        && { label: 'Name',         value: bow.name },
    bow.type        && { label: 'Type',         value: bow.type.charAt(0).toUpperCase() + bow.type.slice(1) },
    bow.drawWeight  && { label: 'Draw Weight',  value: bow.drawWeight },
    bow.notes       && { label: 'Notes',        value: bow.notes },
  ].filter(Boolean);

  const aimRows = Object.entries(bow.aimingPoints || {}).map(([k, v]) => ({
    label: k.toUpperCase(), value: v
  }));

  const allRows = [...rows, ...(aimRows.length ? [{ label: '— Aiming Points —', value: '' }, ...aimRows] : [])];

  const statsHtml = allRows.map(r => `
    <div class="bow-stat-row">
      <span class="bow-stat-label">${r.label}</span>
      <span class="bow-stat-value">${r.value}</span>
    </div>`).join('');

  // Action buttons row
  const actionsHtml = `<div style="display:flex;gap:8px;margin-top:14px;">
    <button class="sort-btn" style="flex:1;justify-content:center;" onclick="openBowProfileOverlay(null)">
      <svg class="ui-icon" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      Edit
    </button>
    <button class="sort-btn" style="flex:1;justify-content:center;" onclick="openNewBowOverlay()">
      <svg class="ui-icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
      Add Bow
    </button>
    ${profiles.length > 1 ? `<button class="sort-btn danger" style="flex:1;justify-content:center;color:var(--red);" onclick="deleteActiveBow()">
      <svg class="ui-icon" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 12h8l1-12"/></svg>
      Delete
    </button>` : ''}
  </div>`;

  body.innerHTML = selectorHtml + statsHtml + actionsHtml;
}

function openNewBowOverlay() {
  editingBowId = null; // null = new bow
  editingBowArcherName = getDeviceArcherName();
  document.getElementById('bowProfileArcherName').textContent = editingBowArcherName;
  document.getElementById('bowNameInput').value = '';
  document.getElementById('bowTypeInput').value = '';
  document.getElementById('bowDrawWeightInput').value = '';
  document.getElementById('bowNotesInput').value = '';
  document.querySelectorAll('.aiming-input').forEach(i => { i.value = ''; });
  document.getElementById('bowProfileOverlay').classList.add('open');
}

function deleteActiveBow() {
  const name = getDeviceArcherName();
  const bow  = getActiveBow(name);
  if (!bow) return;
  appConfirm(`Delete "${bow.name || 'this bow'}"?`, () => {
    const profiles = getBowProfiles(name);
    const idx = profiles.findIndex(b => b.id === bow.id);
    if (idx !== -1) profiles.splice(idx, 1);
    if (profiles.length) {
      db.deviceProfile.activeBowId[name] = profiles[0].id;
    }
    save();
    renderBowInline();
    syncPreferencesToCloud();
  });
}

// ── Theme dropdown ─────────────────────────────────────────────────────────────
function syncThemeDropdown() {
  const sel = document.getElementById('themePresetSelect');
  if (sel) sel.value = themeState.preset || 'auto';
  // Update the accordion subtitle to reflect current preset
  const sub = document.getElementById('themeAccordionSub');
  if (sub) {
    const presetNames = { auto: 'Auto', dark: 'Dark', white: 'White', forest: 'Dark Green / White', moss: 'Green / Black' };
    sub.textContent = presetNames[themeState.preset || 'auto'] || 'Custom';
  }
}

function toggleThemeAccordion() {
  const body    = document.getElementById('themeAccordionBody');
  const chevron = document.getElementById('themeAccordionChevron');
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
}

function toggleLocationsAccordion() {
  const body    = document.getElementById('locationsAccordionBody');
  const chevron = document.getElementById('locationsAccordionChevron');
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
  if (isOpen) renderLocationsList();
}

function toggleGoalsAccordion() {
  // Goals moved into Display & Behaviour sub-accordion
  toggleSubAccordion('goals');
  const isOpen = document.getElementById('subAccordion-goals')?.classList.contains('open');
  if (isOpen) renderGoalsSettings();
}

function renderGoalsSettings() {
  const container = document.getElementById('goalsListContainer');
  const pbSwitchEl = document.getElementById('pbCelebrationsSwitch');
  const historySwitchEl = document.getElementById('historyCardSwitch');
  const addBtn = document.getElementById('addGoalBtn');
  if (pbSwitchEl) pbSwitchEl.classList.toggle('on', db.preferences?.pbCelebrationsEnabled !== false);
  if (historySwitchEl) historySwitchEl.classList.toggle('on', historyCardEnabled());
  if (!container) return;
  const goals = getActiveGoals();
  if (!goals.length) {
    container.innerHTML = '<div class="goal-empty">No active goals yet. Add one to show progress on the weekly summary card.</div>';
  } else {
    container.innerHTML = goals.map(goal => {
      const progress = getGoalProgress(goal);
      return `<div class="goal-row">
        <div class="goal-chip">${icon('target')}</div>
        <div class="goal-main">
          <div class="goal-title">${getGoalMetricLabel(goal.metric)}</div>
          <div class="goal-sub">${progress.complete ? 'Complete this week' : `${progress.current} of ${progress.target} this week`}</div>
        </div>
        <div class="goal-actions">
          <button class="icon-btn danger" onclick="deleteGoal('${goal.id}')" aria-label="Delete goal" style="width:36px;height:36px;">${icon('trash')}</button>
        </div>
      </div>`;
    }).join('');
  }
  if (addBtn) addBtn.disabled = goals.length >= 3;
}

function togglePbCelebrations() {
  db.preferences = normalizePreferences({ ...db.preferences, pbCelebrationsEnabled: !(db.preferences?.pbCelebrationsEnabled !== false) });
  save();
  renderGoalsSettings();
  syncPreferencesToCloud();
}

function toggleHistoryCard() {
  db.preferences = normalizePreferences({ ...db.preferences, historyCardEnabled: !historyCardEnabled() });
  save();
  updateWeeklySummaryCardVisibility();
  renderGoalsSettings();
  syncPreferencesToCloud();
}

function betaFeaturesEnabled() {
  return db.preferences?.betaFeaturesEnabled === true;
}

function toggleBetaFeaturesFromPopup() {
  db.preferences = normalizePreferences({ ...db.preferences, betaFeaturesEnabled: !betaFeaturesEnabled() });
  save();
  openAccountPopup();
  syncPreferencesToCloud();
}

function openGoalOverlay() {
  if (getActiveGoals().length >= 3) {
    appAlert('You can have up to 3 active goals at a time.');
    return;
  }
  document.getElementById('goalMetricInput').value = 'sessions';
  document.getElementById('goalTargetInput').value = '';
  document.getElementById('goalOverlay').classList.add('open');
}

function saveGoalFromOverlay() {
  const metric = document.getElementById('goalMetricInput').value;
  const target = Math.max(1, Number(document.getElementById('goalTargetInput').value) || 0);
  if (!target) {
    appAlert('Enter a target greater than zero.');
    return;
  }
  db.goals = normalizeGoals([
    ...normalizeGoals(db.goals).filter(goal => !goal.archived),
    { id: `goal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, metric, target, createdAt: new Date().toISOString(), archived: false }
  ]);
  save();
  closeOverlay('goalOverlay');
  renderGoalsSettings();
  renderHome();
  syncPreferencesToCloud();
}

function deleteGoal(goalId) {
  db.goals = normalizeGoals(db.goals).map(goal => goal.id === goalId ? { ...goal, archived: true } : goal);
  save();
  renderGoalsSettings();
  renderHome();
  syncPreferencesToCloud();
}

function renderLocationsList() {
  const container = document.getElementById('locationsListContainer');
  if (!container) return;
  
  const locations = db.savedLocations || [];
  
  if (locations.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px;">No saved locations yet.</div>';
    return;
  }
  
  container.innerHTML = locations.map((loc, idx) => `
    <div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg3);border-radius:10px;margin-bottom:8px;">
      <div style="flex:1;font-size:14px;color:var(--text);">${loc.label || 'Unnamed'}</div>
      <button class="icon-btn" onclick="editLocation(${idx})" style="width:36px;height:36px;" title="Edit location">
        <svg class="ui-icon" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
      </button>
      <button class="icon-btn danger" onclick="deleteLocation(${idx})" style="width:36px;height:36px;" title="Delete location">
        <svg class="ui-icon" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
  `).join('');
}

function editLocation(idx) {
  const loc = db.savedLocations[idx];
  if (!loc) return;
  
  const newName = prompt('Edit location name:', loc.label || '');
  if (newName === null) return; // User cancelled
  
  if (newName.trim() === '') {
    appAlert('Location name cannot be empty.');
    return;
  }
  
  db.savedLocations[idx].label = newName.trim();
  save();
  renderLocationsList();
  refreshSavedLocationOptions();
  renderHome();
  renderDiag();
  syncPreferencesToCloud();
}

function deleteLocation(idx) {
  const loc = db.savedLocations[idx];
  if (!loc) return;
  
  if (!confirm(`Delete location "${loc.label}"? This will not affect your saved sessions.`)) return;
  
  db.savedLocations.splice(idx, 1);
  save();
  renderLocationsList();
  refreshSavedLocationOptions();
  syncPreferencesToCloud();
}

// ── Settings page init ─────────────────────────────────────────────────────────
function initSettingsPage() {
  // Version
  const vEl = document.getElementById('settingsVersion');
  if (vEl) vEl.textContent = APP_VERSION;
  // Theme dropdown + subtitle
  syncThemeDropdown();
  // Theme accordion — open by default
  const themeBody    = document.getElementById('themeAccordionBody');
  const themeChevron = document.getElementById('themeAccordionChevron');
  if (themeBody)    themeBody.classList.add('open');
  if (themeChevron) themeChevron.style.transform = 'rotate(180deg)';
  // Bow inline — open by default and render content
  const body    = document.getElementById('bowInlineBody');
  const chevron = document.querySelector('.bow-chevron');
  if (body)    body.classList.add('open');
  if (chevron) chevron.style.transform = 'rotate(180deg)';
  const sub = document.getElementById('bowInlineSub');
  if (sub) {
    const name = getDeviceArcherName();
    const bow  = getActiveBow(name);
    const profiles = getBowProfiles(name);
    const countStr = profiles.length > 1 ? ` (${profiles.length} bows)` : '';
    sub.textContent = bow ? ([bow.name, bow.type].filter(Boolean).join(' · ') || 'Active bow') + countStr : 'No bow profile saved';
  }
  renderBowInline();
  renderGoalsSettings();
  renderDisplayPrefSwitches();
}

function openAboutOverlay() {
  document.getElementById('aboutVersion').textContent = APP_VERSION;
  document.getElementById('aboutOverlay').classList.add('open');
}

function openHelpOverlay() {
  document.getElementById('helpOverlay').classList.add('open');
}

function openExternalResource(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

if (systemThemeQuery) {
  const handleSystemThemeChange = () => { if (themeState.preset === 'auto') applyTheme(); };
  if (typeof systemThemeQuery.addEventListener === 'function') { systemThemeQuery.addEventListener('change', handleSystemThemeChange); } 
  else if (typeof systemThemeQuery.addListener === 'function') { systemThemeQuery.addListener(handleSystemThemeChange); }
}

function distanceBetweenCoords(aLat, aLng, bLat, bLng) {
  const dx = aLat - bLat; const dy = aLng - bLng;
  return dx * dx + dy * dy;
}

function getNearestSavedLocation(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  let best = null, bestDistance = Infinity;
  db.savedLocations.forEach(loc => {
    if (!loc?.label || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;
    const dist = distanceBetweenCoords(lat, lng, loc.lat, loc.lng);
    if (dist < bestDistance) { bestDistance = dist; best = loc; }
  });
  return best;
}

function refreshSavedLocationOptions() {
  const datalist = document.getElementById('savedLocationOptions');
  if (!datalist) return;
  const uniqueLabels = [...new Set(db.savedLocations.map(loc => loc?.label).filter(Boolean))];
  datalist.innerHTML = uniqueLabels.map(label => `<option value="${label.replace(/"/g, '&quot;')}"></option>`).join('');
}

function saveChosenLocation(location) {
  const label = location?.label?.trim();
  if (!label) return;
  const existing = db.savedLocations.find(loc => loc.label.toLowerCase() === label.toLowerCase());
  const next = { label, lat: typeof location.lat === 'number' ? location.lat : existing?.lat, lng: typeof location.lng === 'number' ? location.lng : existing?.lng, updatedAt: new Date().toISOString() };
  if (existing) Object.assign(existing, next);
  else db.savedLocations.push(next);
  save();
  syncPreferencesToCloud();
}

function assignLocationToSession(sessionId, location) {
  if (session?.id === sessionId) {
    if (session.location?.manual && !location.manual) return;
    session.location = {...session.location, ...location}; return;
  }
  if (finishingSession?.id === sessionId) {
    if (finishingSession.location?.manual && !location.manual) return;
    finishingSession.location = {...finishingSession.location, ...location};
    syncFinishLocationInput(); return;
  }
  const savedSession = db.sessions.find(s => s.id === sessionId);
  if (savedSession) {
    if (savedSession.location?.manual && !location.manual) return;
    savedSession.location = {...savedSession.location, ...location};
    save(); renderHome();
    if (activeSessionIdx !== null && db.sessions[activeSessionIdx]?.id === sessionId) openSessionOverlay(activeSessionIdx);
  }
}

function formatLocation(sessionLocation) {
  if (!sessionLocation) return '';
  if (sessionLocation.label) return sessionLocation.label;
  return '';
}

function summarizeReverseGeocode(data) {
  if (!data || typeof data !== 'object') return '';
  return data.city || data.locality || data.localityName || data.principalSubdivision || data.localityInfo?.administrative?.find(a => a.adminLevel === 6 || a.adminLevel === 5)?.name || '';
}

async function reverseGeocodeLocation(sessionId, lat, lng) {
  try {
    const url = `https://api-bdc.net/data/reverse-geocode?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;
    const res = await fetch(url, {headers: {Accept: 'application/json'}});
    if (!res.ok) return;
    const data = await res.json();
    const label = summarizeReverseGeocode(data);
    if (!label) return;
    assignLocationToSession(sessionId, {label});
  } catch { /* Fallback */ }
}

function sessionMetaText(sessionObj) {
  const parts = [];
  if (sessionObj?.archerName) parts.push(sessionObj.archerName);
  if (sessionObj?.date) {
    const d = new Date(sessionObj.date);
    parts.push(d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}));
  }
  if (sessionObj?.rounds) {
    const labels = [...new Set(sessionObj.rounds.map(r => roundDescriptor(r).shortLabel))];
    if (sessionObj.rounds.length) parts.push(`${sessionObj.rounds.length} rounds`);
    if (labels.length) parts.push(labels.join(' · '));
  }
  const locationLabel = formatLocation(sessionObj?.location);
  if (locationLabel) parts.push(`${icon('location', 'type-icon')}${locationLabel}`);
  return parts.join(' · ');
}

function buildFinishedSession() {
  if (!session) return null;
  const finished = {
    id: session.id, 
    sessionId: session.sessionId,
    type: session.type, 
    date: session.date,
    location: session.location ? {...session.location} : null,
    archerName: session.archerName || '',
    rounds: session.rounds.map(r => ({...r, arrows: [...r.arrows]})),
  };
  if (session.type === '3d_tournament') {
    finished.startAnimal = session.startAnimal; finished.direction = session.direction;
    finished.tournamentSequence = [...(session.tournamentSequence || [])];
  }
  if (session.currentRound.arrows.length > 0) finished.rounds.push({...session.currentRound, arrows: [...session.currentRound.arrows]});
  return finished;
}

function resetActiveSessionUI() {
  document.getElementById('scorePicker').style.display = 'flex';
  document.getElementById('scoreActive').style.display = 'none';
  closeOverlay('completedRoundsOverlay');
  updateScoreScrollLock();
  if (window.heatmapPanZoom) window.heatmapPanZoom.reset();
  if (window.timelinePanZoom) window.timelinePanZoom.reset();
}

function syncFinishLocationInput() {
  const input = document.getElementById('finishLocationInput');
  if (!input || !finishingSession || locationInputDirty) return;
  input.value = formatLocation(finishingSession.location) || '';
}

function getDeviceArcherName() {
  const acct = getLoggedInAccount();
  if (acct) return acct.username;
  return normalizePersonName(db.deviceProfile?.activeArcher);
}

// updateDeviceNameSummary → now just updates the account UI in settings
function updateDeviceNameSummary() { updateAccountUI(); }

let editingBowArcherName = '';
let editingBowId = null; // null = creating new, string = editing existing

function openBowProfileOverlay(name) {
  editingBowArcherName = name || getDeviceArcherName();
  editingBowId = null; // default to editing active bow
  document.getElementById('bowProfileArcherName').textContent = editingBowArcherName;
  const bow = getActiveBow(editingBowArcherName) || { aimingPoints: {} };
  if (bow.id) editingBowId = bow.id;
  document.getElementById('bowNameInput').value = bow.name || '';
  document.getElementById('bowTypeInput').value = bow.type || '';
  document.getElementById('bowDrawWeightInput').value = bow.drawWeight || '';
  document.getElementById('bowNotesInput').value = bow.notes || '';
  document.querySelectorAll('.aiming-input').forEach(input => {
    const target = input.getAttribute('data-target');
    input.value = (bow.aimingPoints || {})[target] || '';
  });
  document.getElementById('bowProfileOverlay').classList.add('open');
}

function saveBowProfile() {
  const bowName    = document.getElementById('bowNameInput').value.trim();
  const bowType    = document.getElementById('bowTypeInput').value;
  const drawWeight = document.getElementById('bowDrawWeightInput').value.trim();
  const notes      = document.getElementById('bowNotesInput').value.trim();
  const aimingPoints = {};
  document.querySelectorAll('.aiming-input').forEach(input => {
    const target = input.getAttribute('data-target');
    const val = input.value.trim();
    if (val) aimingPoints[target] = val;
  });

  if (!db.deviceProfile.bowProfiles) db.deviceProfile.bowProfiles = {};
  if (!db.deviceProfile.activeBowId) db.deviceProfile.activeBowId = {};

  const profiles = getBowProfiles(editingBowArcherName);
  const bowData  = { name: bowName, type: bowType, drawWeight, aimingPoints, notes };

  if (editingBowId) {
    // Update existing bow in array
    const idx = profiles.findIndex(b => b.id === editingBowId);
    if (idx !== -1) profiles[idx] = { ...profiles[idx], ...bowData };
    else profiles.push({ id: editingBowId, ...bowData });
  } else {
    // New bow
    const newId = 'bow-' + Date.now();
    profiles.push({ id: newId, ...bowData });
    db.deviceProfile.activeBowId[editingBowArcherName] = newId;
    editingBowId = newId;
  }

  // Also keep legacy bows field in sync for backward compat
  if (!db.deviceProfile.bows) db.deviceProfile.bows = {};
  const activeBow = getActiveBow(editingBowArcherName);
  if (activeBow) db.deviceProfile.bows[editingBowArcherName] = activeBow;

  save();
  closeOverlay('bowProfileOverlay');
  renderBowInline();
  syncPreferencesToCloud();
}

function ensureDeviceNameForScoring(type) {
  if (getDeviceArcherName()) return true;
  // Not logged in — show account overlay
  pendingSessionType = type;
  openAccountOverlay('login');
  return false;
}

function launchSession(type) {
  if (!ensureDeviceNameForScoring(type)) return;
  const normalizedType = normalizeSessionType(type);
  if (normalizedType === 'bullseye_tournament' || normalizedType === '3d_tournament') {
    if (!betaFeaturesEnabled()) {
      pendingTournamentModeType = null;
      startSession(normalizedType, { scoringMode: 'manual' });
      return;
    }
    pendingTournamentModeType = normalizedType;
    syncTournamentScoringModeOptions();
    document.getElementById('tournamentScoreModeOverlay').classList.add('open');
    return;
  }
  startSession(normalizedType);
}
function launchEphemeralSession() { startSession('practice', { ephemeral: true }); }

function syncTournamentScoringModeOptions() {
  const photoBtn = document.getElementById('photoTournamentModeBtn');
  const note = document.getElementById('tournamentScoreBetaNote');
  const enabled = betaFeaturesEnabled();
  if (photoBtn) photoBtn.style.display = enabled ? '' : 'none';
  if (note) note.style.display = enabled ? 'none' : 'block';
}

function confirmTournamentScoringMode(mode) {
  const type = pendingTournamentModeType;
  pendingTournamentModeType = null;
  closeOverlay('tournamentScoreModeOverlay');
  if (!type) return;
  if (mode === 'photo' && !betaFeaturesEnabled()) {
    appAlert('Enable Beta Features from your account popup to use photo scoring.');
    return;
  }
  startSession(type, { scoringMode: mode === 'photo' ? 'photo' : 'manual' });
}

function openFinishOverlay() {
  locationInputDirty = false;
  const nearest = getNearestSavedLocation(finishingSession?.location?.lat, finishingSession?.location?.lng);
  if (finishingSession && !finishingSession.location?.label && nearest) finishingSession.location = {...(finishingSession.location || {}), label: nearest.label};
  refreshSavedLocationOptions(); syncFinishLocationInput();
  document.getElementById('finishOverlay').classList.add('open');
}

function saveFinishedSession(withLocation = true) {
  if (!finishingSession) { closeOverlay('finishOverlay'); goPage('score', document.getElementById('nav-score')); return; }
  const input = document.getElementById('finishLocationInput');
  const typedLocation = input.value.trim();
  if (withLocation && typedLocation) finishingSession.location = {...(finishingSession.location || {}), label: typedLocation, manual: true};
  else if (!withLocation) finishingSession.location = {manual: true};
  else if (finishingSession.location?.label) finishingSession.location = {...finishingSession.location, label: finishingSession.location.label.trim()};
  else finishingSession.location = {manual: true};
  if (finishingSession.location?.label) saveChosenLocation(finishingSession.location);
  db.sessions.push(finishingSession);

  save(); refreshSavedLocationOptions();

  // Push to Cloudflare (silent, non-blocking)
  cfPushSession(finishingSession);

  finishingSession = null;
  closeOverlay('finishOverlay'); renderHome(); renderDiag(); goPage('score', document.getElementById('nav-score'));
}

function checkMedianAndroidLocationReady(sessionId) {
  try {
    const status = window.median?.android?.geoLocation?.isLocationServicesEnabled;
    if (typeof status !== 'function') { requestBrowserLocation(sessionId); return; }
    status({
      callback: result => {
        if (result?.enabled) { requestBrowserLocation(sessionId); return; }
        try { window.median.android.geoLocation.promptLocationServices(); } catch { requestBrowserLocation(sessionId); return; }
        setTimeout(() => { if (pendingLocationSessionId === sessionId) checkMedianAndroidLocationReady(sessionId); }, 1500);
      }
    });
  } catch { requestBrowserLocation(sessionId); }
}

function requestBrowserLocation(sessionId) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      pendingLocationSessionId = null;
      assignLocationToSession(sessionId, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date(pos.timestamp).toISOString() });
      reverseGeocodeLocation(sessionId, pos.coords.latitude, pos.coords.longitude);
    },
    () => { pendingLocationSessionId = null; },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

function requestSessionLocation(sessionId) {
  if (!navigator.geolocation) return;
  pendingLocationSessionId = sessionId;
  if (!medianIOSGeoReady) return;
  if (isMedianAndroidAvailable()) { checkMedianAndroidLocationReady(sessionId); return; }
  requestBrowserLocation(sessionId);
}

window.median_geolocation_ready = function medianGeolocationReady() {
  medianIOSGeoReady = true;
  if (pendingLocationSessionId) requestSessionLocation(pendingLocationSessionId);
};

function startSession(type, options = {}) {
  const normalizedType = normalizeSessionType(type);
  session = {
    id: Date.now(), 
    sessionId: generateSessionId(),
    type: normalizedType, 
    scoringMode: options.scoringMode === 'photo' ? 'photo' : 'manual',
    date: new Date().toISOString(), 
    location: null,
    archerName: getDeviceArcherName() || '', 
    ephemeral: options.ephemeral || false,
    rounds: [], 
    currentRound: createRound('bullseye', 10)
  };
  if (normalizedType === '3d_tournament') {
    session.startAnimal = threeDTournamentSetup.startAnimal; session.direction = threeDTournamentSetup.direction;
    session.tournamentSequence = getThreeDTournamentSequence(threeDTournamentSetup.startAnimal, threeDTournamentSetup.direction);
    session.currentRound = getCurrentTournamentRoundConfig(session);
  }
  
  practiceTargetExpanded = null;
  document.getElementById('scorePicker').style.display = 'none';
  document.getElementById('scoreActive').style.display = 'flex';
  goPage('score', document.getElementById('nav-score'));
  renderScorePage();
  requestSessionLocation(session.id);
}

function sessionRoundNumber() { return session.rounds.length + 1; }

function openThreeDTournamentSetup() { renderThreeDTournamentSetup(); document.getElementById('threeDTournamentOverlay').classList.add('open'); }

function renderThreeDTournamentSetup() {
  const startContainer = document.getElementById('threeDStartOptions'); const directionContainer = document.getElementById('threeDDirectionOptions');
  if (!startContainer || !directionContainer) return;
  startContainer.innerHTML = THREE_D_TARGETS.map(target => {
    const active = threeDTournamentSetup.startAnimal === target.key ? ' active' : '';
    return `<button class="setup-option${active}" onclick="selectThreeDStartAnimal('${target.key}')">${target.label}</button>`;
  }).join('');
  directionContainer.innerHTML = [ {value: 1, label: 'Toward Farther'}, {value: -1, label: 'Toward Closer'} ].map(option => {
    const active = threeDTournamentSetup.direction === option.value ? ' active' : '';
    return `<button class="setup-option${active}" onclick="selectThreeDDirection(${option.value})">${option.label}</button>`;
  }).join('');
}

function selectThreeDStartAnimal(animal) { if (!THREE_D_TARGET_LOOKUP[animal]) return; threeDTournamentSetup.startAnimal = animal; renderThreeDTournamentSetup(); }
function selectThreeDDirection(direction) { threeDTournamentSetup.direction = direction === -1 ? -1 : 1; renderThreeDTournamentSetup(); }
function confirmThreeDTournamentSetup() { closeOverlay('threeDTournamentOverlay'); launchSession('3d_tournament'); }

