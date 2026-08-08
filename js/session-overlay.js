// ═══════════════════════════════════════════════
//  SESSION OVERLAY
// ═══════════════════════════════════════════════
let activeSessionIdx = null;

function pipColor(score) {
  if(score>=9) return '#f7e900'; if(score>=7) return '#e84040'; if(score>=5) return '#3b82f6';
  if(score>=3) return '#333333'; if(score>=1) return '#dddddd'; return '#555555';
}
function pipLightText(score) { return score>=3&&score<=4 || score>=1&&score<=2; }

function openSessionOverlay(idx) {
  activeSessionIdx = idx;
  const s = db.sessions[idx]; const d = new Date(s.date);
  const dateStr = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  document.getElementById('sessionOverlayTitle').innerHTML = sessionTypeBadge(s);
  const locationLabel = formatLocation(s.location);
  document.getElementById('sessionOverlayMeta').innerHTML = locationLabel ? `${dateStr} · ${icon('location', 'type-icon')}${locationLabel}` : dateStr;
  const owner = document.getElementById('sessionOverlayOwner'); const ownerName = normalizePersonName(s.archerName);
  owner.textContent = ownerName || 'Unassigned'; owner.classList.toggle('unassigned', !ownerName);

  // Check ownership for access control
  const activeArcher = normalizePersonName(db.deviceProfile?.activeArcher);
  const isOwner = normalizePersonName(s.archerName) === activeArcher;
  
  // Hide edit/delete buttons if not owner
  const editBtn = document.querySelector('[onclick="openSessionArcherOverlay()"]');
  const deleteBtn = document.querySelector('[onclick="deleteCurrentSession()"]');
  if (editBtn) editBtn.style.display = isOwner ? 'flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = isOwner ? 'flex' : 'none';

  document.getElementById('sessionOverlayTotal').textContent = getSessionTotal(s);

  const container = document.getElementById('sessionOverlayRounds');
  container.innerHTML = s.rounds.map((r,ri) => {
    const rs = r.arrows.reduce((x,a)=>x+a.score,0); const info = roundDescriptor(r);
    const pbBadge = isTournamentRoundPersonalBest(s, r)
      ? '<div class="sor-pb-badge">PB</div>'
      : '';
    const pips = r.arrows.map(a => { const bg = pipColor(a.score); const lt = pipLightText(a.score); return `<div class="sor-pip${lt?' lt':''}" style="background:${bg}">${a.score===0?'M':a.score}</div>`; }).join('');
    const notesHtml = r.notes ? `<div style="width:100%; font-size:12px; color:var(--muted); margin-top:6px; padding-left:66px; font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📝 ${r.notes}</div>` : '';
    // Hide delete button for rounds if not owner
    const deleteBtn = isOwner ? `<button class="sor-del" onclick="event.stopPropagation();deleteRound(${idx},${ri})" title="Delete round" aria-label="Delete round">${icon('trash')}</button>` : '';
    return `<div class="sor-row" onclick="openRoundDetail(${idx},${ri})" style="flex-wrap:wrap;">
      <div style="display:flex; width:100%; align-items:center; gap:10px;">
        <div class="sor-label">R${ri+1} · ${info.shortLabel}</div><div class="sor-pips">${pips}</div>${pbBadge}<div class="sor-score">${rs}</div>
        ${deleteBtn}
      </div>
      ${notesHtml}
    </div>`;
  }).join('');
  
  // Hide edit button in session owner row if not owner
  const ownerEditBtn = document.querySelector('.session-owner-row .icon-btn');
  if (ownerEditBtn) ownerEditBtn.style.display = isOwner ? 'flex' : 'none';
  
  document.getElementById('sessionOverlay').classList.add('open');
}

// ── Session Comparison ────────────────────────────────────────────────────────
// ── Compare picker state ──────────────────────────────────────────────────────
let compareSourceSession = null; // the session being compared FROM
let comparePickerTab = 'my';     // 'my' or 'club'

function renderComparePickerList() {
  const list = document.getElementById('sessionComparePickerList');
  if (!list) return;

  const pool = comparePickerTab === 'club' ? clubSessions : db.sessions;
  // Exclude the source session itself (match by id if available, else by reference)
  const sourceId = compareSourceSession?.id;
  const others = [...pool].reverse().filter(s =>
    !sourceId || String(s.id) !== String(sourceId)
  );

  if (!others.length) {
    const label = comparePickerTab === 'club' ? 'No club sessions available.' : 'No other sessions to compare.';
    list.innerHTML = `<div style="padding:16px;color:var(--muted);font-size:14px;">${label}</div>`;
    return;
  }

  const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  list.innerHTML = others.map(s => {
    const total   = (s.rounds || []).reduce((x, r) => x + r.arrows.reduce((y, a) => y + a.score, 0), 0);
    const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
    const archer  = comparePickerTab === 'club' ? (s.archerName || '') : '';
    const safeId  = esc(String(s.id));
    const src     = comparePickerTab === 'club' ? 'club' : 'my';
    return `<button class="sort-option" onclick="runSessionCompareById('${safeId}', '${src}')" style="display:flex;justify-content:space-between;align-items:center;">
      <div style="text-align:left;">
        <div style="font-size:13px;font-weight:500;">${esc(sessionTypeLabel(s))}${archer ? ` · ${esc(archer)}` : ''}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px;">${esc(dateStr)}${s.location?.label ? ' · ' + esc(s.location.label) : ''}</div>
      </div>
      <span style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--accent);">${total}</span>
    </button>`;
  }).join('');
}

function switchCompareTab(tab) {
  comparePickerTab = tab;
  document.getElementById('compareTabMy').classList.toggle('active', tab === 'my');
  document.getElementById('compareTabClub').classList.toggle('active', tab === 'club');
  renderComparePickerList();
}

function openSessionComparePicker() {
  if (activeSessionIdx === null) return;
  compareSourceSession = db.sessions[activeSessionIdx];
  comparePickerTab = 'my';
  document.getElementById('compareTabMy').classList.add('active');
  document.getElementById('compareTabClub').classList.remove('active');
  renderComparePickerList();
  document.getElementById('sessionComparePicker').classList.add('open');
}

function openSessionComparePickerFromClub() {
  const s = clubSessions.find(s => String(s.id) === String(activeGlobalSessionId));
  if (!s) return;
  compareSourceSession = s;
  // Default to My Sessions tab so the user can compare a club session to their own
  comparePickerTab = 'my';
  document.getElementById('compareTabMy').classList.add('active');
  document.getElementById('compareTabClub').classList.remove('active');
  renderComparePickerList();
  document.getElementById('sessionComparePicker').classList.add('open');
}

function runSessionCompareById(targetId, targetSrc) {
  const pool = targetSrc === 'club' ? clubSessions : db.sessions;
  const target = pool.find(s => String(s.id) === String(targetId));
  if (!target || !compareSourceSession) return;
  runSessionCompare(compareSourceSession, target);
}

function openSessionComparePicker_legacy() {} // kept to avoid reference errors

function runSessionCompare(a, b) {
  closeOverlay('sessionComparePicker');
  if (!a || !b) return;

  function sessionStats(s) {
    const rounds  = s.rounds;
    const arrows  = rounds.flatMap(r => r.arrows);
    const total   = arrows.reduce((x, a) => x + a.score, 0);
    const scores  = rounds.map(r => r.arrows.reduce((x, a) => x + a.score, 0));
    const avg     = scores.length ? (scores.reduce((x, y) => x + y, 0) / scores.length).toFixed(1) : '—';
    const best    = scores.length ? Math.max(...scores) : '—';
    const golds   = arrows.filter(a => a.score >= 9).length;
    const reds    = arrows.filter(a => a.score >= 7 && a.score <= 8).length;
    const misses  = arrows.filter(a => a.score === 0).length;
    // Grouping: average distance of tapped arrows from centre (lower = tighter)
    const tapped  = arrows.filter(a => typeof a.nx === 'number' && typeof a.ny === 'number' && !(a.score === 0 && a.nx === 1.5 && a.ny === 1.5));
    const avgDist = tapped.length
      ? (tapped.reduce((s, a) => s + Math.hypot(a.nx, a.ny), 0) / tapped.length).toFixed(3)
      : null;
    return { total, avg, best, rounds: rounds.length, arrows, golds, reds, misses, avgDist };
  }

  const sa = sessionStats(a), sb = sessionStats(b);

  // ── Stat row helper (higher = better by default, pass lowerBetter=true for grouping) ──
  function statRow(label, va, vb, lowerBetter = false) {
    const na = Number(va), nb = Number(vb);
    const valid = !isNaN(na) && !isNaN(nb);
    const aWins = valid && (lowerBetter ? na < nb : na > nb);
    const bWins = valid && (lowerBetter ? nb < na : nb > na);
    const hi = 'color:var(--accent);';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="text-align:right;padding:10px 14px;font-family:'Bebas Neue',sans-serif;font-size:24px;${aWins ? hi : ''}">${va}</td>
      <td style="text-align:center;padding:10px 6px;font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);white-space:nowrap;line-height:1.4;">${label}</td>
      <td style="text-align:left;padding:10px 14px;font-family:'Bebas Neue',sans-serif;font-size:24px;${bWins ? hi : ''}">${vb}</td>
    </tr>`;
  }

  // ── Zone distribution bar for one session ──
  function zoneBar(arrows, zone) {
    const total = arrows.length || 1;
    const count = arrows.filter(a => a.score >= zone.min && a.score <= zone.max).length;
    const pct   = ((count / total) * 100).toFixed(0);
    return { count, pct };
  }

  function zoneDistRow(zone) {
    const ra = zoneBar(sa.arrows, zone);
    const rb = zoneBar(sb.arrows, zone);
    const aWider = Number(ra.pct) > Number(rb.pct);
    const bWider = Number(rb.pct) > Number(ra.pct);
    return `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);">${ra.pct}%</span>
        <div style="height:10px;width:${Math.max(2, ra.pct)}%;max-width:100%;background:${zone.color};border-radius:3px;opacity:${aWider ? '1' : '0.45'};"></div>
      </div>
      <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-align:center;white-space:nowrap;">${zone.label}</span>
      <div style="display:flex;align-items:center;gap:4px;">
        <div style="height:10px;width:${Math.max(2, rb.pct)}%;max-width:100%;background:${zone.color};border-radius:3px;opacity:${bWider ? '1' : '0.45'};"></div>
        <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);">${rb.pct}%</span>
      </div>
    </div>`;
  }

  // ── Mini heatmap drawn onto an off-screen canvas, returned as data URL ──
  function heatmapDataURL(arrows) {
    const S = 300, CX = S / 2, R = S / 2 - 3;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const cx = cv.getContext('2d');

    // 1. Clip everything to the circular target boundary
    cx.save();
    cx.beginPath(); cx.arc(CX, CX, R, 0, Math.PI * 2); cx.clip();

    // 2. Draw target rings (outermost first)
    for (let i = BULLSEYE_RINGS.length - 1; i >= 0; i--) {
      const r = R * BULLSEYE_RINGS[i].end;
      cx.beginPath(); cx.arc(CX, CX, r, 0, Math.PI * 2);
      // Lighten very dark rings so heat is visible over them
      const col = BULLSEYE_RINGS[i].color === '#1a1a1a' ? '#3a3a3a' : BULLSEYE_RINGS[i].color;
      cx.fillStyle = col; cx.fill();
    }

    // 3. Draw heat blobs on top of rings
    const tapped = arrows.filter(a =>
      typeof a.nx === 'number' && typeof a.ny === 'number' &&
      !(a.score === 0 && a.nx === 1.5 && a.ny === 1.5) &&
      a.source !== 'photo'
    );
    if (tapped.length) {
      // Darker semi-transparent overlay so heat stands out against coloured rings
      cx.globalCompositeOperation = 'source-over';
      tapped.forEach(a => {
        const ax = CX + a.nx * R, ay = CX + a.ny * R;
        const blobR = Math.max(10, R * 0.12);
        const grad = cx.createRadialGradient(ax, ay, 0, ax, ay, blobR);
        grad.addColorStop(0, 'rgba(232,197,71,0.80)');
        grad.addColorStop(0.4, 'rgba(232,197,71,0.35)');
        grad.addColorStop(1, 'rgba(232,197,71,0)');
        cx.beginPath(); cx.arc(ax, ay, blobR, 0, Math.PI * 2);
        cx.fillStyle = grad; cx.fill();
      });

      // Draw a crisp dot at each arrow position
      tapped.forEach(a => {
        const ax = CX + a.nx * R, ay = CX + a.ny * R;
        cx.beginPath(); cx.arc(ax, ay, 2.5, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(255,255,255,0.9)'; cx.fill();
      });
    }

    cx.restore(); // remove clip

    // 4. Redraw ring outlines on top so the target structure stays crisp
    for (let i = BULLSEYE_RINGS.length - 1; i >= 0; i--) {
      const r = R * BULLSEYE_RINGS[i].end;
      cx.beginPath(); cx.arc(CX, CX, r, 0, Math.PI * 2);
      cx.strokeStyle = 'rgba(0,0,0,0.25)'; cx.lineWidth = 0.75; cx.stroke();
    }
    // Outer border
    cx.beginPath(); cx.arc(CX, CX, R, 0, Math.PI * 2);
    cx.strokeStyle = 'rgba(0,0,0,0.5)'; cx.lineWidth = 1.5; cx.stroke();

    return cv.toDataURL();
  }

  const dateA = a.date ? new Date(a.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
  const dateB = b.date ? new Date(b.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
  const locA  = formatLocation(a.location);
  const locB  = formatLocation(b.location);

  const groupA = sa.avgDist !== null ? sa.avgDist : '—';
  const groupB = sb.avgDist !== null ? sb.avgDist : '—';
  // Convert avgDist to a readable "tightness" percentage (lower dist = higher %)
  const groupLabelA = sa.avgDist !== null ? Math.round((1 - Math.min(Number(sa.avgDist), 1)) * 100) + '%' : '—';
  const groupLabelB = sb.avgDist !== null ? Math.round((1 - Math.min(Number(sb.avgDist), 1)) * 100) + '%' : '—';

  const imgA = heatmapDataURL(sa.arrows);
  const imgB = heatmapDataURL(sb.arrows);

  const sectionHead = (label) =>
    `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;padding:14px 14px 6px;border-top:1px solid var(--border);">${label}</div>`;

  document.getElementById('sessionCompareContent').innerHTML = `
    <!-- Header -->
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:4px;margin-bottom:4px;text-align:center;padding:4px 0 12px;">
      <div>
        <div style="font-size:13px;font-weight:500;">${sessionTypeLabel(a)}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px;">${dateA}</div>
        ${locA ? `<div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:1px;">${locA}</div>` : ''}
      </div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--muted);display:flex;align-items:center;padding:0 6px;">VS</div>
      <div>
        <div style="font-size:13px;font-weight:500;">${sessionTypeLabel(b)}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:2px;">${dateB}</div>
        ${locB ? `<div style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;margin-top:1px;">${locB}</div>` : ''}
      </div>
    </div>

    <!-- Score stats table -->
    <table style="width:100%;border-collapse:collapse;background:var(--bg3);border-radius:14px;overflow:hidden;border:1px solid var(--border);">
      ${statRow('Total Score',   sa.total,   sb.total)}
      ${statRow('Avg / Round',   sa.avg,     sb.avg)}
      ${statRow('Best Round',    sa.best,    sb.best)}
      ${statRow('Rounds',        sa.rounds,  sb.rounds)}
      ${statRow('Total Arrows',  sa.arrows.length, sb.arrows.length)}
      ${statRow('Golds (9–10)',  sa.golds,   sb.golds)}
      ${statRow('Reds  (7–8)',   sa.reds,    sb.reds)}
      ${statRow('Misses',        sa.misses,  sb.misses, true)}
    </table>

    <!-- Arrow grouping -->
    ${sectionHead('Arrow Grouping')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 14px 4px;">
      <div style="text-align:center;">
        <img src="${imgA}" style="width:100%;max-width:160px;border-radius:50%;display:block;margin:0 auto;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);margin-top:6px;">${groupLabelA}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);">TIGHTNESS</div>
      </div>
      <div style="text-align:center;">
        <img src="${imgB}" style="width:100%;max-width:160px;border-radius:50%;display:block;margin:0 auto;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);margin-top:6px;">${groupLabelB}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);">TIGHTNESS</div>
      </div>
    </div>

    <!-- Score distribution -->
    ${sectionHead('Score Distribution')}
    <div style="padding:4px 14px 16px;">
      ${ZONES.map(z => zoneDistRow(z)).join('')}
    </div>`;

  document.getElementById('sessionCompareOverlay').classList.add('open');
}

function deleteCurrentSession() { deleteSession(); }

function deleteSession() {
  appConfirm('Delete this entire session?', async () => {
    const sessionToDelete = db.sessions[activeSessionIdx];
    if (!sessionToDelete) return;
    try {
      await cfDeleteSession(sessionToDelete.id);
    } catch (e) {
      appAlert('Could not delete this session globally. Please make sure you are logged in and try again.');
      return;
    }
    db.sessions.splice(activeSessionIdx, 1);
    save();
    closeOverlay('sessionOverlay');
    renderHome();
    renderDiag();
  });
}

function deleteRound(sessionIdx, roundIdx) {
  appConfirm('Delete this round?', async () => {
    const removedRound = db.sessions[sessionIdx]?.rounds?.[roundIdx];
    if (!removedRound) return;
    db.sessions[sessionIdx].rounds.splice(roundIdx, 1);
    if (db.sessions[sessionIdx].rounds.length === 0) {
      const sessionToDelete = db.sessions[sessionIdx];
      try {
        await cfDeleteSession(sessionToDelete.id);
      } catch (e) {
        db.sessions[sessionIdx].rounds.splice(roundIdx, 0, removedRound);
        appAlert('Could not delete this session globally. Please make sure you are logged in and try again.');
        return;
      }
      db.sessions.splice(sessionIdx, 1);
      closeOverlay('sessionOverlay');
    } else {
      openSessionOverlay(sessionIdx);
      // Session still has rounds — push the updated version to the server
      cfPatchSession(db.sessions[sessionIdx]);
    }
    save(); renderHome(); renderDiag();
  });
}

function openSessionArcherOverlay() {
  if (activeSessionIdx === null || !db.sessions[activeSessionIdx]) return;
  const input = document.getElementById('sessionArcherInput'); input.value = db.sessions[activeSessionIdx].archerName || '';
  document.getElementById('sessionArcherOverlay').classList.add('open'); setTimeout(() => { input.focus(); input.select(); }, 60);
}

function saveSessionArcherName() {
  if (activeSessionIdx === null || !db.sessions[activeSessionIdx]) return;
  const input = document.getElementById('sessionArcherInput'); const nextName = normalizePersonName(input.value); const existingName = normalizePersonName(db.sessions[activeSessionIdx].archerName);
  if (nextName && nextName.toLowerCase() !== (existingName || '').toLowerCase()) {
    const duplicate = db.sessions.some((s, i) => i !== activeSessionIdx && normalizePersonName(s.archerName)?.toLowerCase() === nextName.toLowerCase());
    if (duplicate) { appAlert(`The name "${nextName}" is already used in saved sessions. Please choose a different name.`); input.focus(); return; }
  }
  db.sessions[activeSessionIdx].archerName = nextName; save(); closeOverlay('sessionArcherOverlay'); openSessionOverlay(activeSessionIdx); renderHome();
  // Push updated session to server so the archer name change is reflected everywhere
  cfPatchSession(db.sessions[activeSessionIdx]);
}

