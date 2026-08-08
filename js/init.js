// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
applyTheme();
refreshSavedLocationOptions();
renderHomeFilters();
renderDiagFilters();
renderThreeDTournamentSetup();
updateDeviceNameSummary();
loadCloudflareConfigIntoUI();

renderHome();
updateAllFilterBadges();
drawTarget([]);
resetPhotoScoreState();
renderScorePickerSummaries();
applyDisplayPrefs();

// On open: push any unsynced local sessions to the club server
setTimeout(async () => {
  await hydratePreferencesFromCloud({ preferServer: true });
  await autoSyncUnsyncedSessions();
}, 2000);

// Update sync status when network state changes
window.addEventListener('online',  () => { updateSyncStatus(); setTimeout(() => autoSyncUnsyncedSessions(), 1000); });
window.addEventListener('offline', () => { updateSyncStatus(); });

function wipeEphemeralOnExit() {
  if (session?.ephemeral) { session = null; localStorage.setItem(DB_KEY, JSON.stringify(db)); }
}
window.addEventListener('beforeunload', wipeEphemeralOnExit);
window.addEventListener('pagehide', wipeEphemeralOnExit);

// ── KEYBOARD-AWARE LAYOUT ──
// When the virtual keyboard opens (e.g. user taps the round notes field),
// the scoring page can get pushed down. We detect this via visualViewport
// and nudge the page back so the target stays visible.
if (window.visualViewport) {
  let keyboardOpen = false;
  window.visualViewport.addEventListener('resize', () => {
    const vvHeight = window.visualViewport.height;
    const winHeight = window.innerHeight;
    const isScorePage = document.getElementById('page-score').classList.contains('active');
    const scoreActive = document.getElementById('scoreActive');

    // Keyboard is open when viewport height is significantly smaller than window height
    if (vvHeight < winHeight * 0.75) {
      if (!keyboardOpen && isScorePage && scoreActive && scoreActive.style.display !== 'none') {
        keyboardOpen = true;
        // Scroll target canvas into view smoothly
        const targetCanvas = document.getElementById('targetCanvas');
        if (targetCanvas) {
          setTimeout(() => targetCanvas.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
        }
      }
    } else {
      keyboardOpen = false;
    }
  });
}

// --- NOTE TAKING PATCH ---
(function injectNotesFeature() {
  // 1. Inject CSS safely
  const style = document.createElement('style');
  style.innerHTML = `
    .modal-textarea { width: 100%; height: 90px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg3); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 16px; margin-bottom: 12px; outline: none; resize: none; }
    .session-notes-box { margin-bottom: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px dashed var(--border); font-size: 13px; color: var(--text); line-height: 1.5; white-space: pre-wrap; }
  `;
  document.head.appendChild(style);

  // 2. Inject HTML Elements
  const datalist = document.getElementById('savedLocationOptions');
  if (datalist) datalist.insertAdjacentHTML('beforebegin', '<textarea id="finishNotesInput" class="modal-textarea" placeholder="Add session notes (optional)..." inputmode="text" autocorrect="on" autocapitalize="sentences" spellcheck="true"></textarea>');

  const roundsContainer = document.getElementById('sessionOverlayRounds');
  if (roundsContainer) roundsContainer.insertAdjacentHTML('beforebegin', '<div id="sessionOverlayNotes" class="session-notes-box" style="display:none"></div>');

  // 3. Safely Intercept Functions
  const originalEndSession = endSession;
  endSession = function() {
    const notesInput = document.getElementById('finishNotesInput');
    if (notesInput) notesInput.value = ''; // Clear notes when starting end process
    originalEndSession();
  };

  const originalSaveFinishedSession = saveFinishedSession;
  saveFinishedSession = function(withLocation = true) {
    if (finishingSession) {
      const notesInput = document.getElementById('finishNotesInput');
      if (notesInput) finishingSession.notes = notesInput.value.trim(); // Save notes to session
    }
    originalSaveFinishedSession(withLocation);
  };

  const originalOpenSessionOverlay = openSessionOverlay;
  openSessionOverlay = function(idx) {
    originalOpenSessionOverlay(idx); // Load normal overlay first
    const s = db.sessions[idx];
    const notesEl = document.getElementById('sessionOverlayNotes');
    if (notesEl && s) {
      if (s.notes) {
        notesEl.textContent = s.notes;
        notesEl.style.display = 'block'; // Show notes if they exist
      } else {
        notesEl.style.display = 'none'; // Hide if no notes
      }
    }
  };
})();
