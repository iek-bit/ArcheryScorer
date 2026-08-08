// ═══════════════════════════════════════════════
//  ACCOUNT & AUTH LAYER
// ═══════════════════════════════════════════════
const SYNCED_KEY    = 'achery_synced_ids';
const ACCOUNT_KEY   = 'achery_account'; // { username, password }
const GUEST_MODE_KEY = 'achery_guest_mode';

function getCfUrl()    { return 'https://archery-worker.isaacekern.workers.dev'; }
const PHOTO_SCORE_TEMPLATE = {
  canonicalWidth: 900,
  canonicalHeight: 1500,
  expectedAspectRatio: 0.6,
  rows: 6,
  cols: 5,
  scoreStripRegion: { x: 0.148, y: 0.131, width: 0.648, height: 0.713 },
  rowGapRatio: 0.0065,
  markSampleWidthRatio: 0.052,
  markSampleHeightRatio: 0.54,
  bullseyeOptions: ['M', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  bullseyeOptionCenters: [0.02, 0.12, 0.215, 0.308, 0.4, 0.492, 0.585, 0.677, 0.77, 0.862, 0.956],
  threeDOptions: ['M', '7', '8', '9', '10'],
  threeDOptionCenters: [0.05, 0.39, 0.58, 0.77, 0.95]
};
const photoScoreEngine = {
  opencvReady: false,
  tesseractReady: false,
  initializing: false,
  error: '',
  readinessPromise: null
};
let photoScoreScriptStatusApplied = false;

function buildPhotoScoreTemplateCells(template = PHOTO_SCORE_TEMPLATE) {
  const { rows, cols, scoreStripRegion, rowGapRatio } = template;
  const totalRows = rows * cols;
  const rowGap = scoreStripRegion.height * rowGapRatio;
  const cellHeight = (scoreStripRegion.height - rowGap * (totalRows - 1)) / totalRows;
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => ({
      x: scoreStripRegion.x,
      y: scoreStripRegion.y + (rowIndex * cols + colIndex) * (cellHeight + rowGap),
      width: scoreStripRegion.width,
      height: cellHeight,
      rowIndex,
      arrowIndex: colIndex
    }))
  );
}
PHOTO_SCORE_TEMPLATE.cells = buildPhotoScoreTemplateCells(PHOTO_SCORE_TEMPLATE);

function getSyncedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || '[]')); } catch { return new Set(); }
}
function markSynced(id) {
  try { const s = getSyncedIds(); s.add(String(id)); localStorage.setItem(SYNCED_KEY, JSON.stringify([...s])); } catch {}
}
function unmarkSynced(id) {
  try { const s = getSyncedIds(); s.delete(String(id)); localStorage.setItem(SYNCED_KEY, JSON.stringify([...s])); } catch {}
}
function cfReady() { return true; }

function getLoggedInAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); } catch { return null; }
}
function setLoggedInAccount(username, password) {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ username, password })); } catch {}
}
function clearLoggedInAccount() {
  try { localStorage.removeItem(ACCOUNT_KEY); } catch {}
}
function isGuestMode() {
  try { return localStorage.getItem(GUEST_MODE_KEY) === 'true'; } catch { return false; }
}
function setGuestMode() {
  try { localStorage.setItem(GUEST_MODE_KEY, 'true'); } catch {}
}
function clearGuestMode() {
  try { localStorage.removeItem(GUEST_MODE_KEY); } catch {}
}
function hasGlobalAccount() {
  const account = getLoggedInAccount();
  return !!(account?.username && account?.password);
}
function migrateLocalDataToAccount(username, previousName = normalizePersonName(db.deviceProfile?.activeArcher)) {
  const nextName = normalizePersonName(username);
  const priorName = normalizePersonName(previousName);
  db.sessions.forEach(s => {
    const sessionOwner = normalizePersonName(s.archerName);
    if (!sessionOwner || (priorName && sessionOwner.toLowerCase() === priorName.toLowerCase())) {
      s.archerName = nextName;
    }
  });
  db.deviceProfile.bows = db.deviceProfile.bows || {};
  if (priorName && priorName !== nextName && db.deviceProfile.bows[priorName] && !db.deviceProfile.bows[nextName]) {
    db.deviceProfile.bows[nextName] = db.deviceProfile.bows[priorName];
    delete db.deviceProfile.bows[priorName];
  }
  db.deviceProfile.activeArcher = nextName;
  db.deviceProfile.archers = [nextName];
  clearGuestMode();
}

function cfHeaders() {
  const h = { 'Content-Type': 'application/json' };
  // Attach Basic Auth if logged in (used for /sessions and authenticated routes)
  const account = getLoggedInAccount();
  if (account?.username && account?.password) {
    h['Authorization'] = 'Basic ' + btoa(`${account.username}:${account.password}`);
  }
  return h;
}

async function cfFetch(path, opts = {}) {
  const url = getCfUrl().replace(/\/$/, '') + path;
  const res = await fetch(url, { ...opts, headers: { ...cfHeaders(), ...(opts.headers || {}) } });
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error ? `: ${data.error}` : '';
    } catch {
      try {
        const text = await res.text();
        detail = text ? `: ${text}` : '';
      } catch {}
    }
    throw new Error(`CF ${res.status}${detail}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (res.status === 204 || !ct.includes('json')) return null;
  return res.json();
}

async function cfRegister(username, password) {
  return cfFetch('/account/register', { method: 'POST', body: JSON.stringify({ username, password }) });
}
async function cfLogin(username, password) {
  return cfFetch('/account/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}
async function cfCheckUsername(username) {
  try { const r = await cfFetch(`/account/check?username=${encodeURIComponent(username)}`); return r.taken; } catch { return false; }
}
async function cfGetPreferences() {
  if (!cfReady() || !hasGlobalAccount()) throw new Error('Not configured');
  return cfFetch('/account/preferences');
}
async function cfPatchPreferences(payload) {
  if (!cfReady() || !hasGlobalAccount()) return null;
  return cfFetch('/account/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}
async function cfPushSession(sessionObj) {
  if (!cfReady() || !hasGlobalAccount()) { updateSyncStatus(); return; }
  try {
    await cfFetch('/sessions', { method: 'POST', body: JSON.stringify(sessionObj) });
    markSynced(sessionObj.id);
    updateSyncStatus();
  } catch (e) {
    console.warn('CF push failed:', e.message);
    if (e.message.includes('401')) {
      handleServerAuthInvalid();
    } else if (e.message.includes('404')) {
      handleGhostAccount();
    }
    updateSyncStatus();
  }
}
async function cfDeleteOwnAccount(username, password) {
  return cfFetch(`/account/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    body: JSON.stringify({ password })
  });
}
async function cfPullSessions() {
  if (!cfReady() || !hasGlobalAccount()) throw new Error('Not configured');
  return cfFetch('/sessions');
}
async function cfDeleteSession(sessionId) {
  if (!cfReady() || !hasGlobalAccount()) return;
  try {
    await cfFetch(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    unmarkSynced(sessionId);
    updateSyncStatus();
  } catch (e) {
    console.warn('CF delete session failed:', e.message);
    if (e.message.includes('401')) handleServerAuthInvalid();
    throw e;
  }
}
async function cfPatchSession(sessionObj) {
  if (!cfReady() || !hasGlobalAccount()) return;
  try {
    await cfFetch(`/sessions/${encodeURIComponent(sessionObj.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(sessionObj)
    });
    markSynced(sessionObj.id);
    updateSyncStatus();
  } catch (e) {
    console.warn('CF patch session failed:', e.message);
    if (e.message.includes('401')) handleServerAuthInvalid();
  }
}

function saveCloudflareConfig() {
  try {
    const secret = document.getElementById('cfSecret')?.value.trim() || '';
    // Store the secret only in memory to avoid clear-text persistent storage.
    window._cfSecret = secret;
  } catch {}
}
function loadCloudflareConfigIntoUI() {
  const secretEl = document.getElementById('cfSecret');
  if (secretEl && typeof window._cfSecret === 'string') {
    secretEl.value = window._cfSecret;
  }
}

async function autoSyncUnsyncedSessions() {
  if (!cfReady()) return;
  if (!hasGlobalAccount()) { updateSyncStatus(); return; }
  updateSyncStatus('syncing');
  // Pull first so cross-device deletions/edits are reflected locally
  const account = getLoggedInAccount();
  if (account) await pullSessionsForAccount(account.username);
  // Then push any sessions that haven't made it to the server yet
  const synced = getSyncedIds();
  const unsynced = db.sessions.filter(s => !synced.has(String(s.id)));
  for (const s of unsynced) { await cfPushSession(s); }
  updateSyncStatus();
}
async function syncUnsyncedSessions() {
  if (!hasGlobalAccount()) { appAlert('Guest sessions stay on this device until you sign in or create an account.'); return; }
  const synced = getSyncedIds();
  const unsynced = db.sessions.filter(s => !synced.has(String(s.id)));
  if (!unsynced.length) { appAlert('All sessions are already synced.'); return; }
  let ok = 0;
  for (const s of unsynced) { try { await cfPushSession(s); ok++; } catch {} }
  appAlert(`Synced ${ok} of ${unsynced.length} sessions to the club.`);
}

// ── 5-tap hidden settings tap (unused admin path removed) ────────────────────
let _settingsTapCount = 0, _settingsTapTimer = null;
function handleSettingsTap() {
  _settingsTapCount++;
  clearTimeout(_settingsTapTimer);
  if (_settingsTapCount >= 5) {
    _settingsTapCount = 0;
    appAlert('No hidden admin mode is enabled on this account.');
  } else { _settingsTapTimer = setTimeout(() => { _settingsTapCount = 0; }, 1500); }
}

// ── Account overlay ───────────────────────────────────────────────────────────
function showAccountTab(tab) {
  document.getElementById('accountLoginForm').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('accountRegisterForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('accountTabLogin').classList.toggle('active',    tab === 'login');
  document.getElementById('accountTabRegister').classList.toggle('active', tab === 'register');
}

function openAccountOverlay(context) {
  showAccountTab('login');
  document.getElementById('loginUsernameInput').value = '';
  document.getElementById('loginPasswordInput').value = '';
  document.getElementById('regUsernameInput').value = '';
  document.getElementById('regPasswordInput').value = '';
  document.getElementById('regPasswordConfirm').value = '';
  document.getElementById('accountCancelBtn').style.display = context === 'switch' ? 'block' : 'none';
  document.getElementById('continueGuestBtn').style.display = context === 'switch' ? 'none' : 'block';
  document.getElementById('accountOverlay').classList.add('open');
  setTimeout(() => document.getElementById('loginUsernameInput').focus(), 80);
}

function continueAsGuest() {
  setGuestMode();
  if (!normalizePersonName(db.deviceProfile?.activeArcher)) {
    db.deviceProfile.activeArcher = 'Guest';
    db.deviceProfile.archers = ['Guest'];
  }
  save();
  closeOverlay('accountOverlay');
  updateAccountUI();
  renderHome();
  renderDiag();
  updateSyncStatus();
  if (pendingSessionType) {
    const nextType = pendingSessionType;
    pendingSessionType = null;
    startSession(nextType);
  }
}

async function submitLogin() {
  const username = document.getElementById('loginUsernameInput').value.trim();
  const password = document.getElementById('loginPasswordInput').value;
  if (!username || !password) { appAlert('Please enter your username and password.'); return; }
  try {
    const res = await cfLogin(username, password);
    if (res.ok) {
      const previousName = normalizePersonName(db.deviceProfile?.activeArcher);
      setLoggedInAccount(res.username, password);
      migrateLocalDataToAccount(res.username, previousName);
      save();
      closeOverlay('accountOverlay');
      updateAccountUI();
      renderHome(); renderDiag();
      if (pendingSessionType) {
        const nextType = pendingSessionType;
        pendingSessionType = null;
        startSession(nextType);
      }
      await hydratePreferencesFromCloud({ preferServer: true });
      // Pull existing sessions from server, then push any local ones
      setTimeout(async () => {
        await pullSessionsForAccount(res.username);
        await autoSyncUnsyncedSessions();
      }, 300);
    }
  } catch(e) {
    if (e.message.includes('401')) appAlert('Incorrect username or password.');
    else if (e.message.includes('500') || e.message.includes('1101')) appAlert('The club server is misconfigured right now. Please verify the Cloudflare worker and KV binding.');
    else appAlert('Could not reach the club server. Check your connection.');
  }
}

async function submitRegister() {
  const username = document.getElementById('regUsernameInput').value.trim();
  const password = document.getElementById('regPasswordInput').value;
  const confirm  = document.getElementById('regPasswordConfirm').value;
  if (!username) { appAlert('Please enter a username.'); return; }
  if (!password) { appAlert('Please enter a password.'); return; }
  if (password !== confirm) { appAlert('Passwords do not match.'); return; }
  if (password.length < 4) { appAlert('Password must be at least 4 characters.'); return; }
  try {
    const res = await cfRegister(username, password);
    if (res.taken) { appAlert(`The username "${username}" is already taken. Please choose another.`); return; }
    if (res.ok) {
      const previousName = normalizePersonName(db.deviceProfile?.activeArcher);
      setLoggedInAccount(res.username, password);
      migrateLocalDataToAccount(res.username, previousName);
      save();
      closeOverlay('accountOverlay');
      updateAccountUI();
      renderHome(); renderDiag();
      if (pendingSessionType) {
        const nextType = pendingSessionType;
        pendingSessionType = null;
        startSession(nextType);
      }
      await hydratePreferencesFromCloud({ preferServer: false });
      setTimeout(() => autoSyncUnsyncedSessions(), 500);
    }
  } catch(e) {
    if (e.message.includes('409')) appAlert(`The username "${username}" is already taken.`);
    else if (e.message.includes('500') || e.message.includes('1101')) appAlert('The club server is misconfigured right now. Please verify the Cloudflare worker and KV binding.');
    else appAlert('Could not reach the club server. Check your connection.');
  }
}

function continueAsGuest() {
  closeOverlay('accountOverlay');
  if (pendingSessionType) {
    const nextType = pendingSessionType;
    pendingSessionType = null;
    startSession(nextType);
  }
}

// ── Password setup overlay (backward compat for existing users) ───────────────
function openPasswordSetupOverlay(suggestedUsername) {
  document.getElementById('setupUsernameInput').value = suggestedUsername || '';
  document.getElementById('setupPasswordInput').value = '';
  document.getElementById('setupPasswordConfirm').value = '';
  document.getElementById('passwordSetupOverlay').classList.add('open');
  setTimeout(() => { const u = document.getElementById('setupUsernameInput'); u.focus(); u.select(); }, 80);
}

async function submitPasswordSetup() {
  const username = document.getElementById('setupUsernameInput').value.trim();
  const password = document.getElementById('setupPasswordInput').value;
  const confirm  = document.getElementById('setupPasswordConfirm').value;
  if (!username) { appAlert('Please enter a username.'); return; }
  if (!password) { appAlert('Please enter a password.'); return; }
  if (password !== confirm) { appAlert('Passwords do not match.'); return; }
  if (password.length < 4) { appAlert('Password must be at least 4 characters.'); return; }
  try {
    const res = await cfRegister(username, password);
    if (res.taken) { appAlert(`The username "${username}" is already taken. Please choose another.`); return; }
    if (res.ok) {
      const previousName = normalizePersonName(db.deviceProfile?.activeArcher);
      setLoggedInAccount(res.username, password);
      migrateLocalDataToAccount(res.username, previousName);
      save();
      closeOverlay('passwordSetupOverlay');
      updateAccountUI();
      renderHome(); renderDiag();
      if (pendingSessionType) {
        const nextType = pendingSessionType;
        pendingSessionType = null;
        startSession(nextType);
      }
      await hydratePreferencesFromCloud({ preferServer: false });
      setTimeout(async () => {
        await pullSessionsForAccount(res.username);
        await autoSyncUnsyncedSessions();
      }, 300);
    }
  } catch(e) {
    if (e.message.includes('409')) appAlert(`The username "${username}" is already taken.`);
    else if (e.message.includes('500') || e.message.includes('1101')) appAlert('The club server is misconfigured right now. Please verify the Cloudflare worker and KV binding.');
    else appAlert('Could not reach the club server. Check your connection.');
  }
}

// Pull all sessions for the logged-in account from the server and merge into local db
async function pullSessionsForAccount(username) {
  try {
    const all = await cfPullSessions();
    const mine = all.filter(s => (s.archerName || '').toLowerCase() === username.toLowerCase());

    // Build a set of server-side IDs for this account
    const serverIds = new Set(mine.map(s => String(s.id)));

    // Add any server sessions not already in local db (by id)
    const localIds = new Set(db.sessions.map(s => String(s.id)));
    let added = 0;
    mine.forEach(s => {
      if (!localIds.has(String(s.id))) {
        db.sessions.push(normalizeSessionData(s));
        markSynced(s.id);
        added++;
      }
    });

    // Remove local sessions owned by this account that no longer exist on the server
    // (they were deleted on another device)
    const before = db.sessions.length;
    db.sessions = db.sessions.filter(s => {
      const isOwnedByMe = (s.archerName || '').toLowerCase() === username.toLowerCase();
      if (!isOwnedByMe) return true; // keep sessions belonging to other archers
      // Keep if it was never synced (only exists locally so far)
      const synced = getSyncedIds();
      if (!synced.has(String(s.id))) return true;
      // Keep if it still exists on the server
      return serverIds.has(String(s.id));
    });
    const removed = before - db.sessions.length;

    if (added > 0 || removed > 0) { save(); renderHome(); renderDiag(); }
  } catch (e) {
    console.warn('Pull failed:', e.message);
    if (e.message.includes('401')) handleServerAuthInvalid();
  }
}

function updateAccountUI() {
  const account = getLoggedInAccount();
  const guest = !account && isGuestMode();
  const name = account ? account.username : (guest ? (normalizePersonName(db.deviceProfile?.activeArcher) || 'Guest') : '—');
  // Settings header
  const nameEl = document.getElementById('settingsAccountName');
  if (nameEl) nameEl.textContent = name;
  // Account popup (if open)
  const popupName = document.getElementById('accountPopupName');
  if (popupName) popupName.textContent = name;
}

function updateSyncStatus(state) {
  const dot  = document.getElementById('syncStatusDot');
  const text = document.getElementById('syncStatusText');
  if (!dot || !text) return;

  if (state === 'syncing') {
    dot.style.background  = 'var(--accent)';
    text.style.color      = 'var(--accent)';
    text.textContent      = 'Syncing...';
    return;
  }

  const account  = getLoggedInAccount();
  if (!account) {
    if (isGuestMode()) {
      dot.style.background = 'var(--muted)';
      text.style.color     = 'var(--muted)';
      text.textContent     = 'Guest mode — local only';
      return;
    }
    dot.style.background = 'var(--muted)';
    text.style.color     = 'var(--muted)';
    text.textContent     = 'Not logged in';
    return;
  }

  const synced   = getSyncedIds();
  const unsynced = db.sessions.filter(s => !synced.has(String(s.id))).length;

  if (!navigator.onLine) {
    dot.style.background = 'var(--accent2)';
    text.style.color     = 'var(--accent2)';
    text.textContent     = unsynced > 0 ? `Offline — ${unsynced} session(s) pending` : 'Offline';
  } else if (unsynced > 0) {
    dot.style.background = 'var(--accent2)';
    text.style.color     = 'var(--accent2)';
    text.textContent     = `${unsynced} session(s) not yet synced`;
  } else {
    dot.style.background = 'var(--green)';
    text.style.color     = 'var(--green)';
    text.textContent     = 'All sessions synced';
  }
}

function handleGhostAccount() {
  // Account was deleted server-side while user was logged in locally
  clearLoggedInAccount();
  try { localStorage.removeItem(SYNCED_KEY); } catch {}
  db.deviceProfile.activeArcher = '';
  db.deviceProfile.archers = [];
  save();
  updateSyncStatus();
  // Give a brief moment before showing the overlay so it doesn't feel jarring
  setTimeout(() => {
    appAlert('Your account no longer exists on the server. Please create a new account or contact your club admin.');
    openAccountOverlay('login');
  }, 400);
}

let serverSignOutNoticePending = false;
function handleServerAuthInvalid(message = 'You were signed out on this device because your password was changed on another device. Please sign in again.') {
  if (serverSignOutNoticePending) return;
  serverSignOutNoticePending = true;
  const lastKnownName = normalizePersonName(getLoggedInAccount()?.username || db.deviceProfile?.activeArcher);
  clearLoggedInAccount();
  try { localStorage.removeItem(SYNCED_KEY); } catch {}
  if (lastKnownName) {
    db.deviceProfile.activeArcher = lastKnownName;
    db.deviceProfile.archers = [lastKnownName];
  }
  save();
  updateAccountUI();
  updateSyncStatus();
  setTimeout(() => {
    appAlert(message);
    openAccountOverlay('login');
    serverSignOutNoticePending = false;
  }, 250);
}

// ── Club history tab ─────────────────────────────────────────────────────────
let activeHistoryTab = 'my';
let clubSort = 'newest';
let clubSessions = [];
let activeGlobalSessionId = null;
const clubFilters = new Set();
const activeClubFilters = { club: new Set() };
const activeDateFiltersClub = { start: null, end: null };

function switchHistoryTab(tab) {
  activeHistoryTab = tab;
  document.getElementById('tabMyHistory').classList.toggle('active',   tab === 'my');
  document.getElementById('tabClubHistory').classList.toggle('active', tab === 'club');
  document.getElementById('myHistoryPanel').style.display   = tab === 'my'   ? 'block' : 'none';
  document.getElementById('clubHistoryPanel').style.display = tab === 'club' ? 'block' : 'none';

  if (tab === 'my') { renderHome(); return; }

  loadClubHistory();
}

async function loadClubHistory() {
  if (!hasGlobalAccount()) {
    showClubError('Sign in or create an account to view global scores.');
    document.getElementById('clubList').innerHTML = '';
    setTimeout(() => openAccountOverlay('login'), 150);
    return;
  }
  showClubError(null); // clear error
  document.getElementById('clubList').innerHTML =
    `<div class="empty-state" style="padding:40px 0">
       <div class="spinner" style="width:32px;height:32px;border-width:3px;margin:0 auto 12px"></div>
       Loading club sessions...
     </div>`;
  try {
    const all = await cfPullSessions();
    const myName = getDeviceArcherName().toLowerCase();
    // Exclude the current archer's own sessions
    clubSessions = all.filter(s => (s.archerName || '').toLowerCase() !== myName);
    renderClubHistory();
  } catch (e) {
    if (e.message.includes('401')) {
      handleServerAuthInvalid();
      showClubError('Please sign in again to view global scores.');
    } else if (e.message.includes('500') || e.message.includes('1101')) {
      showClubError('The club server is misconfigured right now. Please verify the Cloudflare worker and KV binding.');
    } else {
      showClubError('Could not load club sessions. The server may be unreachable.');
    }
    document.getElementById('clubList').innerHTML = '';
  }
}

function showClubError(msg) {
  const banner = document.getElementById('clubErrorBanner');
  const msgEl  = document.getElementById('clubErrorMsg');
  if (!banner) return;
  if (msg) { msgEl.textContent = msg; banner.style.display = 'flex'; }
  else { banner.style.display = 'none'; }
}

function renderClubHistory() {
  const list   = document.getElementById('clubList');
  let filtered = clubSessions.filter(s => sessionMatchesFilter(s, clubFilters, 'club') &&
                                          sessionMatchesSearch(s, homeSearchQuery));
  filtered = applySortToSessions(filtered, clubSort);

  if (!filtered.length) {
    const hasActiveCriteria = !!homeSearchQuery ||
      clubFilters.size > 0 ||
      (activeArcherFilters.club && activeArcherFilters.club.size > 0) ||
      !!activeDateFiltersClub.start ||
      !!activeDateFiltersClub.end;
    list.innerHTML = hasActiveCriteria
      ? `<div class="empty-state"><div class="es-icon">${icon('search')}</div>No club sessions match your search or filters.</div>`
      : `<div class="empty-state"><div class="es-icon">${icon('users')}</div>No club sessions yet.</div>`;
    return;
  }

  list.innerHTML = filtered.map(s => {
    const total   = getSessionTotal(s);
    const archer  = s.archerName || 'Unknown';
    const dateStr = new Date(s.date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const loc     = formatLocation(s.location);
    const typeClass2 = s.type === 'bullseye_tournament' ? 'type-tournament' : s.type === '3d_tournament' ? 'type-3d' : 'type-practice';
    return `<div class="recent-item ${typeClass2}" onclick="openGlobalSessionOverlay(${JSON.stringify(s.id)})" style="touch-action:pan-y;">
      <div class="ri-left">
        <span style="font-size:13px;font-weight:500;">${archer}</span>
        <span class="session-type">${sessionTypeBadge(s)}</span>
        <span style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;">${dateStr}${loc ? ' · ' + loc : ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <div class="ri-score">${total}</div>
        <span class="ri-chevron">${icon('arrowUpRight')}</span>
      </div>
    </div>`;
  }).join('');
}

function openGlobalSessionOverlay(id) {
  activeGlobalSessionId = String(id);
  const s = clubSessions.find(s => String(s.id) === String(id));
  if (!s) return;
  const d = new Date(s.date);
  const dateStr = d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  document.getElementById('globalSessionTitle').innerHTML = sessionTypeBadge(s);
  const loc = formatLocation(s.location);
  document.getElementById('globalSessionMeta').textContent = loc ? `${dateStr} · ${loc}` : dateStr;
  document.getElementById('globalSessionOwner').textContent = s.archerName || 'Unknown';

  const container = document.getElementById('globalSessionRounds');
  container.innerHTML = (s.rounds || []).map((r, ri) => {
    const rs = r.arrows.reduce((x, a) => x + a.score, 0);
    const info = roundDescriptor(r);
    const pbBadge = isTournamentRoundPersonalBest(s, r, clubSessions)
      ? '<div class="sor-pb-badge">PB</div>'
      : '';
    const pips = r.arrows.map(a => {
      const bg = pipColor(a.score);
      const lt = pipLightText(a.score);
      return `<div class="sor-pip${lt ? ' lt' : ''}" style="background:${bg}">${a.score === 0 ? 'M' : a.score}</div>`;
    }).join('');
    return `<div class="sor-row" style="cursor:default">
      <div style="display:flex;width:100%;align-items:center;gap:10px;">
        <div class="sor-label">R${ri+1} · ${info.shortLabel}</div>
        <div class="sor-pips">${pips}</div>
        ${pbBadge}
        <div class="sor-score">${rs}</div>
        <button class="icon-btn" onclick="printGlobalSessionRound('${String(s.id)}', ${ri})" title="Print round" aria-label="Print round" style="margin-left:auto">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V4h12v5"></path><rect x="6" y="14" width="12" height="6"></rect><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('globalSessionTotal').textContent = getSessionTotal(s);
  document.getElementById('globalSessionOverlay').classList.add('open');
}

// Sort for club tab
function setSortOnly_club(key) {
  clubSort = key;
  document.querySelectorAll('#sortOnlyOverlay .sort-option[data-sort]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-sort') === key);
  });
  renderClubHistory();
}

