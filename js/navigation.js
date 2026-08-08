// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
function goPage(name, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const pageEl = document.getElementById('page-'+name);
  pageEl.classList.add('active');
  // Trigger transition: reset to invisible, then let CSS animate in on next frame
  pageEl.style.opacity = '0';
  pageEl.style.transform = 'translateY(6px)';
  requestAnimationFrame(() => {
    pageEl.style.opacity = '';
    pageEl.style.transform = '';
  });
  btn.classList.add('active');

  if (name !== 'home') {
    isHomeSelectMode = false;
    homeSelectedSessions.clear();
  }

  if(name==='score') {
    if(session) { document.getElementById('scorePicker').style.display = 'none'; document.getElementById('scoreActive').style.display = 'flex'; renderScorePage(); }
    else { document.getElementById('scorePicker').style.display = 'flex'; document.getElementById('scoreActive').style.display = 'none'; drawTarget([]); renderScorePickerSummaries(); }
  }
  if(name==='diag') { renderDiag(); lockPortrait(); }
  else { unlockOrientation(); }
  if(name==='home') renderHome();
  if(name==='settings') { updateDeviceNameSummary(); initSettingsPage(); }
  updateScoreScrollLock();
  window.scrollTo(0,0);
  if (window.heatmapPanZoom) window.heatmapPanZoom.reset();
  if (window.timelinePanZoom) window.timelinePanZoom.reset();
}

function openInsightsPage() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-insights').classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  unlockOrientation();
  renderInsightsPage();
  window.scrollTo(0, 0);
}

function closeInsightsPage() {
  goPage('diag', document.getElementById('nav-diag'));
}

