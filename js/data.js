// ═══════════════════════════════════════════════
//  DATA LAYER & INITIALIZATION
// ═══════════════════════════════════════════════
const DB_KEY = 'arrowmark_v2';
const APP_VERSION = '3.4.20';
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let db = JSON.parse(localStorage.getItem(DB_KEY) || '{"sessions":[],"savedLocations":[],"deviceProfile":{"name":""}}');
db.sessions = Array.isArray(db.sessions) ? db.sessions : [];
db.savedLocations = Array.isArray(db.savedLocations) ? db.savedLocations : [];
db.deviceProfile = db.deviceProfile && typeof db.deviceProfile === 'object' ? db.deviceProfile : {name: ''};
function normalizePreferences(raw = {}) {
  return {
    pbCelebrationsEnabled: raw?.pbCelebrationsEnabled !== false,
    historyCardEnabled: raw?.historyCardEnabled !== false,
    betaFeaturesEnabled: raw?.betaFeaturesEnabled === true,
    // Display preferences
    showScoreFlash: raw?.showScoreFlash !== false,
    showRoundComplete: raw?.showRoundComplete !== false,
    showArrowDots: raw?.showArrowDots !== false,
    showSessionAvg: raw?.showSessionAvg !== false,
    showMagnifier: raw?.showMagnifier !== false,
    compactHistory: raw?.compactHistory === true,
    showTypeStripes: raw?.showTypeStripes !== false,
  };
}
function normalizeGoals(rawGoals = []) {
  return (Array.isArray(rawGoals) ? rawGoals : [])
    .filter(goal => goal && typeof goal === 'object')
    .map(goal => ({
      id: typeof goal.id === 'string' ? goal.id : `goal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      metric: ['sessions', 'arrows', 'avg_score', 'best_round'].includes(goal.metric) ? goal.metric : 'sessions',
      target: Math.max(1, Number(goal.target) || 1),
      createdAt: typeof goal.createdAt === 'string' ? goal.createdAt : new Date().toISOString(),
      archived: !!goal.archived
    }))
    .slice(0, 12);
}
function normalizeSavedLocations(rawLocations = []) {
  return (Array.isArray(rawLocations) ? rawLocations : [])
    .filter(location => location && typeof location === 'object')
    .map(location => ({
      label: typeof location.label === 'string' ? location.label.trim() : '',
      lat: Number.isFinite(Number(location.lat)) ? Number(location.lat) : undefined,
      lng: Number.isFinite(Number(location.lng)) ? Number(location.lng) : undefined,
      updatedAt: typeof location.updatedAt === 'string' ? location.updatedAt : new Date().toISOString()
    }))
    .filter(location => location.label)
    .slice(0, 200);
}
function normalizeBowSyncData(rawDeviceProfile = {}) {
  return {
    bows: rawDeviceProfile?.bows && typeof rawDeviceProfile.bows === 'object' ? rawDeviceProfile.bows : {},
    bowProfiles: rawDeviceProfile?.bowProfiles && typeof rawDeviceProfile.bowProfiles === 'object' ? rawDeviceProfile.bowProfiles : {},
    activeBowId: rawDeviceProfile?.activeBowId && typeof rawDeviceProfile.activeBowId === 'object' ? rawDeviceProfile.activeBowId : {}
  };
}
if (!db.deviceProfile.archers) {
  db.deviceProfile.archers = db.deviceProfile.name ? [db.deviceProfile.name] : [];
  db.deviceProfile.activeArcher = db.deviceProfile.name || '';
}
if (!db.deviceProfile.bows) {
  db.deviceProfile.bows = {};
}
db.preferences = normalizePreferences(db.preferences);
db.goals = normalizeGoals(db.goals);
db.savedLocations = normalizeSavedLocations(db.savedLocations);
const save = () => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
    // Continue silently - app will still work with in-memory data
  }
};

// Location Filter States
let activeLocationFilters = { home: new Set(), diag: new Set() };
let activeArcherFilters = { home: new Set(), diag: new Set() };
let activeRoundTypeFilters = { home: 'all', diag: 'all', club: 'all' };
let activeDateFilters = { home: { start: null, end: null }, diag: { start: null, end: null } };
let activeDateFilterContext = 'home';
let activeArcherFilterContext = 'home';

const THEME_KEY = 'achery_scorer_theme_v1';
const THEME_PRESETS = {
  auto: { name: 'Auto', followsSystem: true },
  dark: { name: 'Dark', bg: '#0a0f1a', bg2: '#111827', bg3: '#1e2a3a', accent: '#e8c547', accent2: '#f0a04b', accent3: '#f7d978', text: '#e8eaf0', muted: '#6b7a99', border: '#2a3a50', gold: '#e8c547', silver: '#9daab8' },
  white: { name: 'White', bg: '#f7f7f2', bg2: '#ffffff', bg3: '#edf0e8', accent: '#1f2937', accent2: '#64748b', accent3: '#94a3b8', text: '#0f172a', muted: '#5f6c80', border: '#d0d5dd', gold: '#1f2937', silver: '#98a2b3' },
  forest: { name: 'Dark Green / White', bg: '#102019', bg2: '#163126', bg3: '#214536', accent: '#f6f7f2', accent2: '#9ed3b0', accent3: '#d8e7dc', text: '#fbfdf8', muted: '#a2bcaf', border: '#335c49', gold: '#f6f7f2', silver: '#b5c7bd' },
  moss: { name: 'Green / Black', bg: '#0f1511', bg2: '#18211b', bg3: '#243229', accent: '#79c08f', accent2: '#aed7a4', accent3: '#5f8f6c', text: '#f2f7f2', muted: '#9cb0a5', border: '#33463b', gold: '#79c08f', silver: '#a4b7ad' }
};
const THEME_SWATCH_KEYS = ['accent', 'accent2', 'accent3', 'text'];
const THEME_COLOR_OPTIONS = {
  accent: ['#e8c547', '#f97316', '#ef4444', '#79c08f', '#14b8a6', '#3b82f6', '#8b5cf6', '#f43f5e', '#9ca3af', '#6b7280', '#374151', '#000000', '#7c5a00', '#7a2e0e', '#1f4d36', '#1e3a8a'],
  accent2: ['#f0a04b', '#fb7185', '#f59e0b', '#aed7a4', '#67e8f9', '#60a5fa', '#c084fc', '#f9a8d4', '#d1d5db', '#9ca3af', '#4b5563', '#111827', '#8a5a12', '#7a1f3d', '#365314', '#1f2937'],
  accent3: ['#f7d978', '#fdba74', '#fca5a5', '#d8e7dc', '#99f6e4', '#93c5fd', '#d8b4fe', '#5f8f6c', '#e5e7eb', '#9ca3af', '#6b7280', '#000000', '#334155', '#3f3f46', '#14532d'],
  text: ['#ffffff', '#f8fafc', '#ecf3ec', '#e8eaf0', '#d1fae5', '#d1d5db', '#9ca3af', '#111827', '#0f172a', '#000000', '#1f2937', '#374151', '#0b0f19', '#1c1917']
};
let themeState = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(THEME_KEY) || '');
    return parsed && typeof parsed === 'object' ? parsed : {preset: 'auto', accent: THEME_PRESETS.dark.accent, accent2: THEME_PRESETS.dark.accent2, accent3: THEME_PRESETS.dark.accent3, text: THEME_PRESETS.dark.text};
  } catch { return {preset: 'auto', accent: THEME_PRESETS.dark.accent, accent2: THEME_PRESETS.dark.accent2, accent3: THEME_PRESETS.dark.accent3, text: THEME_PRESETS.dark.text}; }
})();
let activeThemeColorKey = 'accent';

function normalizePersonName(value) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 40) : ''; }

function normalizeDeviceProfile(raw = {}) { 
  return { 
    name: normalizePersonName(raw.name),
    archers: Array.isArray(raw.archers) ? raw.archers.map(normalizePersonName).filter(Boolean) : (raw.name ? [normalizePersonName(raw.name)] : []),
    activeArcher: normalizePersonName(raw.activeArcher) || normalizePersonName(raw.name) || '',
    bows: (raw.bows && typeof raw.bows === 'object') ? raw.bows : {}
  }; 
}

function normalizeRound(round = {}) {
  const mode = round.mode || (round.animal ? '3d' : 'bullseye');
  const normalizeArrowScore = score => {
    const base = typeof score === 'number' ? score : 0;
    if (mode === '3d' && base > 0 && base < 7) return 7;
    return base;
  };
  return {
    mode,
    distance: mode === 'bullseye' ? (round.distance === 15 ? 15 : 10) : null,
    animal: mode === '3d' ? (THREE_D_TARGET_LOOKUP[round.animal] ? round.animal : 'turkey') : null,
    notes: typeof round.notes === 'string' ? round.notes.trim() : '',
    arrows: Array.isArray(round.arrows) ? round.arrows.map(arrow => ({
      nx: typeof arrow?.nx === 'number' ? arrow.nx : null,
      ny: typeof arrow?.ny === 'number' ? arrow.ny : null,
      score: normalizeArrowScore(arrow?.score),
      source: arrow?.source === 'photo' ? 'photo' : 'manual'
    })) : [],
    locked: !!round.locked
  };
}

function normalizeSessionType(type) {
  if (type === 'tournament') return 'bullseye_tournament';
  if (type === 'bullseye_tournament' || type === '3d_tournament') return type;
  return 'practice';
}

function generateSessionId() {
  // Timestamp + cryptographically secure random 4-digit suffix for collision avoidance
  const randomArray = new Uint16Array(1);
  (window.crypto || self.crypto).getRandomValues(randomArray);
  const suffix = randomArray[0] % 10000;
  return Date.now() * 10000 + suffix;
}

function normalizeSessionData(raw = {}) {
  const type = normalizeSessionType(raw.type);
  return {
    id: raw.id || Date.now(),
    sessionId: raw.sessionId || generateSessionId(),
    type,
    date: raw.date || new Date().toISOString(),
    location: raw.location || null,
    archerName: normalizePersonName(raw.archerName),
    scoringMode: raw.scoringMode === 'photo' ? 'photo' : 'manual',
    rounds: Array.isArray(raw.rounds) ? raw.rounds.map(normalizeRound) : [],
    currentRound: raw.currentRound ? normalizeRound(raw.currentRound) : {mode: 'bullseye', distance: 10, animal: null, arrows: [], locked: false},
    startAnimal: type === '3d_tournament' && THREE_D_TARGET_LOOKUP[raw.startAnimal] ? raw.startAnimal : undefined,
    direction: type === '3d_tournament' && (raw.direction === -1 ? -1 : 1),
    tournamentSequence: type === '3d_tournament' && Array.isArray(raw.tournamentSequence)
      ? raw.tournamentSequence.filter(animal => THREE_D_TARGET_LOOKUP[animal]).slice(0, 6)
      : undefined
  };
}

function detectMigrationNeeded() {
  // Check if migration has already been completed
  const migrationCompleted = localStorage.getItem('migration_completed_v1');
  if (migrationCompleted === 'true') {
    return { needed: false, unmigrated: [] };
  }
  
  // Check for sessions without archerName field
  const unmigrated = db.sessions.filter(session => !session.archerName || session.archerName === '');
  
  return {
    needed: unmigrated.length > 0,
    unmigrated: unmigrated
  };
}

function performMigration() {
  // Check if migration has already been completed
  const migrationCompleted = localStorage.getItem('migration_completed_v1');
  if (migrationCompleted === 'true') {
    return; // Migration already done
  }
  
  // Ensure archer name is set before migrating
  let archerName = getDeviceArcherName();
  if (!archerName) {
    // Prompt user for archer name
    return new Promise((resolve) => {
      // Store the resolve callback to be called after user sets name
      window.migrationResolveCallback = resolve;
      openDeviceNameOverlay('migration');
    });
  }
  
  // Perform the actual migration
  completeMigration(archerName);
}

function completeMigration(archerName) {
  // Add archerName to all sessions without it
  db.sessions.forEach(session => {
    if (!session.archerName || session.archerName === '') {
      session.archerName = archerName;
    }
    // Generate sessionId for sessions that lack one
    if (!session.sessionId) {
      session.sessionId = generateSessionId();
    }
  });
  
  // Save the migrated sessions
  save();
  
  // Set migration complete flag
  try {
    localStorage.setItem('migration_completed_v1', 'true');
  } catch (error) {
    console.warn('Failed to set migration completed flag:', error);
  }
}

db.sessions = db.sessions.map(normalizeSessionData);
db.deviceProfile = normalizeDeviceProfile(db.deviceProfile);

// Initialize app on DOM ready
function initializeApp() {
  const account = getLoggedInAccount();
  if (!account) {
    if (isGuestMode()) {
      if (!normalizePersonName(db.deviceProfile?.activeArcher)) {
        db.deviceProfile.activeArcher = 'Guest';
        db.deviceProfile.archers = ['Guest'];
        save();
      }
      updateAccountUI();
      updateSyncStatus();
      return;
    }
    const existingName = normalizePersonName(db.deviceProfile?.activeArcher);
    if (existingName && db.sessions.length > 0) {
      // Existing user without a password — prompt to set one
      setTimeout(() => openPasswordSetupOverlay(existingName), 300);
    } else {
      // Brand new user — show login/register
      setTimeout(() => openAccountOverlay('login'), 300);
    }
  } else {
    // Already logged in — sync active archer name
    db.deviceProfile.activeArcher = account.username;
    db.deviceProfile.archers = [account.username];
    updateAccountUI();
  }
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initPhotoScoreLibraries();
  });
} else {
  initializeApp();
  initPhotoScoreLibraries();
}

// Custom Dialog Utilities
function appAlert(message) {
  document.getElementById('customAlertMessage').textContent = message;
  document.getElementById('customAlertOverlay').classList.add('open');
}

let appConfirmCallback = null;
function appConfirm(message, callback) {
  document.getElementById('customConfirmMessage').textContent = message;
  appConfirmCallback = callback;
  document.getElementById('customConfirmOverlay').classList.add('open');
}

function execAppConfirm() {
  closeOverlay('customConfirmOverlay');
  if (appConfirmCallback) appConfirmCallback();
}

