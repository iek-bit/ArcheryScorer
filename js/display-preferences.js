// ═══════════════════════════════════════════════
//  DISPLAY PREFERENCES
// ═══════════════════════════════════════════════
function getPref(key) {
  const prefs = normalizePreferences(db.preferences || {});
  return prefs[key] !== false;
}

function togglePref(key) {
  const prefs = normalizePreferences(db.preferences || {});
  prefs[key] = !prefs[key];
  db.preferences = prefs;
  save();
  syncThemeDropdown && syncThemeDropdown();
  renderDisplayPrefSwitches();
  applyDisplayPrefs();
  syncPreferencesToCloud && syncPreferencesToCloud();
}

function renderDisplayPrefSwitches() {
  const prefs = normalizePreferences(db.preferences || {});
  const keys = ['showScoreFlash','showArrowDots','showMagnifier','showSessionAvg','showRoundComplete','showTypeStripes','compactHistory'];
  keys.forEach(k => {
    const el = document.getElementById('pref-' + k);
    if (el) el.classList.toggle('on', prefs[k] !== false);
  });
  // Also sync goals/celebrations switches that live in the sub-accordion
  renderGoalsSettings();
}

function applyDisplayPrefs() {
  const prefs = normalizePreferences(db.preferences || {});

  // Arrow dots visibility
  const arrowsRow = document.querySelector('.arrows-row');
  if (arrowsRow) arrowsRow.style.display = prefs.showArrowDots !== false ? '' : 'none';

  // Magnifier: disable long-press if off
  window._magnifierEnabled = prefs.showMagnifier !== false;

  // Avg / round stat
  const avgWrap = document.querySelector('.round-info > div:last-child');
  if (avgWrap) avgWrap.style.display = prefs.showSessionAvg !== false ? '' : 'none';

  // Compact history
  const list = document.getElementById('sessionList');
  if (list) list.classList.toggle('compact-history', prefs.compactHistory === true);

  // Type stripes
  document.querySelectorAll('.recent-item').forEach(el => {
    el.classList.toggle('stripes-hidden', prefs.showTypeStripes === false);
  });
}

function toggleSubAccordion(key) {
  const el = document.getElementById('subAccordion-' + key);
  if (!el) return;
  el.classList.toggle('open');
}

function toggleDisplayPrefsAccordion() {
  const body = document.getElementById('displayPrefsBody');
  const chevron = document.getElementById('displayPrefsChevron');
  if (!body) return;
  const open = body.classList.toggle('open');
  if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
}

