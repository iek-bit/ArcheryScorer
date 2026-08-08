// ═══════════════════════════════════════════════
// FILTERS OVERLAY FUNCTIONS
// ═══════════════════════════════════════════════
let activeFiltersContext = null;

function escapeJsSingleQuoted(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

// ── Filter badge helpers ──────────────────────────────────────────────────────
function countActiveFilters(context) {
  let n = 0;
  // Location
  const locSet = activeLocationFilters[context];
  if (context !== 'club' && locSet && locSet.size > 0) n++;
  // Round type
  if ((activeRoundTypeFilters[context] || 'all') !== 'all') n++;
  // Date
  const dateF = context === 'club' ? activeDateFiltersClub : (activeDateFilters[context] || {});
  if (dateF.start || dateF.end) n++;
  // Archer (club only)
  if (context === 'club') {
    const archSet = activeArcherFilters.club;
    if (archSet && archSet.size > 0) n++;
  }
  return n;
}

function updateFilterBadge(context) {
  const btnId = context === 'home' ? 'filterBtnHome'
              : context === 'club' ? 'filterBtnClub'
              : 'filterBtnDiag';
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const count = countActiveFilters(context);
  // Remove any existing badge
  const existing = btn.querySelector('.filter-badge');
  if (existing) existing.remove();
  if (count > 0) {
    btn.classList.add('active');
    const badge = document.createElement('span');
    badge.className = 'filter-badge';
    badge.textContent = count;
    btn.appendChild(badge);
  } else {
    btn.classList.remove('active');
  }
}

function updateAllFilterBadges() {
  updateFilterBadge('home');
  updateFilterBadge('club');
  updateFilterBadge('diag');
}

function openFiltersOverlay(context) {
  activeFiltersContext = context;
  
  // Populate location filter dropdown
  const locationSelect = document.getElementById('filtersLocationSelect');
  if (locationSelect) {
    const uniqueLocations = [...new Set(db.sessions.map(s => s.location?.label).filter(Boolean))].sort();
    const activeLocSet = activeLocationFilters[context];
    const currentLoc = activeLocSet.size === 1 ? [...activeLocSet][0] : 'all';
    locationSelect.innerHTML = `<option value="all">All Locations</option>` +
      uniqueLocations.map(loc => `<option value="${loc.replace(/"/g,'&quot;')}"${currentLoc === loc ? ' selected' : ''}>${loc}</option>`).join('');
  }
  
  // Populate round type dropdown
  const rtSelect = document.getElementById('filtersRoundTypeSelect');
  if (rtSelect) {
    const activeRt = activeRoundTypeFilters[context] || 'all';
    rtSelect.value = activeRt;
  }
  
  // Populate date filter
  const dateFilter = activeDateFilters[context];
  document.getElementById('filtersDateStart').value = dateFilter.start || '';
  document.getElementById('filtersDateEnd').value = dateFilter.end || '';
  
  document.getElementById('filtersOverlay').classList.add('open');
}

function setFiltersLocationFromDropdown(locLabel) {
  const activeLocSet = activeLocationFilters[activeFiltersContext];
  if (locLabel === 'all') {
    activeLocSet.clear();
  } else {
    activeLocSet.clear();
    activeLocSet.add(locLabel);
  }
  updateFilterBadge(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'diag') renderDiag();
}

// Round type filter state

function setFiltersRoundType(val) {
  activeRoundTypeFilters[activeFiltersContext] = val;
  updateFilterBadge(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'diag') renderDiag();
}

function setFiltersOnlyRoundType(val) {
  activeRoundTypeFilters[activeFiltersContext] = val;
  updateFilterBadge(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'club') renderClubHistory();
}

function sessionMatchesRoundTypeFilter(sessionObj, context) {
  const rt = activeRoundTypeFilters[context] || 'all';
  if (rt === 'all') return true;
  return sessionObj.type === rt;
}

function setFiltersArcherFilter(archLabel) {
  const activeSet = activeArcherFilters[activeFiltersContext];
  if (archLabel === 'all') {
    activeSet.clear();
  } else {
    if (activeSet.has(archLabel)) activeSet.delete(archLabel);
    else activeSet.add(archLabel);
  }
  updateFilterBadge(activeFiltersContext);
  openFiltersOverlay(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'diag') renderDiag();
}

function setFiltersLocationFilter(locLabel) {
  const activeLocSet = activeLocationFilters[activeFiltersContext];
  if (locLabel === 'all') {
    activeLocSet.clear();
  } else {
    if (activeLocSet.has(locLabel)) {
      activeLocSet.delete(locLabel);
    } else {
      activeLocSet.add(locLabel);
    }
  }
  updateFilterBadge(activeFiltersContext);
  openFiltersOverlay(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'diag') renderDiag();
}

function applyFiltersDateFilter() {
  const startVal = document.getElementById('filtersDateStart').value;
  const endVal = document.getElementById('filtersDateEnd').value;
  activeDateFilters[activeFiltersContext] = {
    start: startVal || null,
    end: endVal || null
  };
  updateFilterBadge(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'diag') renderDiag();
}

function clearFiltersDateFilter() {
  activeDateFilters[activeFiltersContext] = { start: null, end: null };
  document.getElementById('filtersDateStart').value = '';
  document.getElementById('filtersDateEnd').value = '';
  updateFilterBadge(activeFiltersContext);
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'diag') renderDiag();
}

function setFiltersSort(key) {
  if (activeFiltersContext === 'home') { homeSort = key; }
  else if (activeFiltersContext === 'diag') { diagSort = key; }
  
  if (activeFiltersContext === 'home') renderHome();
  else if (activeFiltersContext === 'diag') renderDiag();
}

