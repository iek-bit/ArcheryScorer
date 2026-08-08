// ═══════════════════════════════════════════════
//  ROUND DETAIL
// ═══════════════════════════════════════════════
const detailCanvas = document.getElementById('detailCanvas');
const dctx = detailCanvas.getContext('2d');

function openRoundDetail(sessionIdx, roundIdx) {
  const r = db.sessions[sessionIdx].rounds[roundIdx];
  const s = db.sessions[sessionIdx];
  document.getElementById('detailTitle').textContent = `Round ${roundIdx+1} · ${roundDescriptor(r).shortLabel}`;
  
  // Display session owner
  const ownerRow = document.getElementById('detailOwnerRow');
  const ownerName = document.getElementById('detailOwnerName');
  const normalizedOwner = normalizePersonName(s.archerName);
  ownerName.textContent = normalizedOwner || 'Unassigned';
  ownerName.classList.toggle('unassigned', !normalizedOwner);
  ownerRow.style.display = 'flex';
  
  drawTargetOnCtx(dctx, 600, r.arrows, r.mode);
  document.getElementById('detailArrows').innerHTML = r.arrows.map(a => { const bg = pipColor(a.score); const lt = pipLightText(a.score); return `<div class="detail-pip${lt?' dark-text':''}" style="background:${bg}">${a.score===0?'M':a.score}</div>`; }).join('');
  
  const notesEl = document.getElementById('detailNotes');
  if (notesEl) {
    if (r.notes) {
      notesEl.textContent = r.notes;
      notesEl.style.display = 'block';
    } else {
      notesEl.style.display = 'none';
    }
  }

  document.getElementById('detailScore').textContent = r.arrows.reduce((x,a)=>x+a.score,0);
  document.getElementById('detailOverlay').classList.add('open');
}

function drawTargetOnCtx(c, size, arrows=[], mode='bullseye') {
  const CX2=size/2, CY2=size/2, R2=size/2-10; const rings = getRingsForMode(mode); c.clearRect(0,0,size,size);
  for(let i=rings.length-1;i>=0;i--){
    const r=R2*rings[i].end; c.beginPath(); c.arc(CX2,CY2,r,0,Math.PI*2); c.fillStyle=rings[i].color; c.fill(); c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1; c.stroke();
  }
  c.strokeStyle='rgba(0,0,0,0.15)'; c.lineWidth=1; c.setLineDash([4,4]); c.beginPath(); c.moveTo(CX2,4); c.lineTo(CX2,size-4); c.stroke(); c.beginPath(); c.moveTo(4,CY2); c.lineTo(size-4,CY2); c.stroke(); c.setLineDash([]);
  const LC={'#f7e900':'#1a1000','#e84040':'#ffffff','#3b82f6':'#ffffff','#1a1a1a':'#cccccc','#ffffff':'#333333','#cccccc':'#555555'};
  c.textAlign='center'; c.textBaseline='middle';
  for(let i=0;i<rings.length;i++){
    const innerR=i===0 ? 0 : R2 * rings[i-1].end; const outerR=R2 * rings[i].end; const ringWidth=outerR-innerR; const labelR=innerR + ringWidth * 0.5; const fontSize=Math.max(10, Math.floor(ringWidth * 0.46));
    c.fillStyle=LC[rings[i].color]||'#fff'; c.font=`bold ${fontSize}px "DM Mono",monospace`;
    if (i === 0) { c.fillText(rings[i].score, CX2, CY2); continue; }
    const positions = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    positions.forEach(angle => { const x = CX2 + Math.cos(angle) * labelR; const y = CY2 + Math.sin(angle) * labelR; c.fillText(rings[i].score, x, y); });
  }
  arrows.forEach((a,idx)=>{
    // Ensure manual miss button arrows are not drawn on the face (they have nx/ny = 1.5)
    if(a.source === 'photo') return;
    if(a.score === 0 && a.nx === 1.5 && a.ny === 1.5) return; 
    if (typeof a.nx !== 'number' || typeof a.ny !== 'number') return;
    
    const px=CX2+a.nx*R2, py=CY2+a.ny*R2;
    c.beginPath(); c.arc(px+2,py+2,12,0,Math.PI*2); c.fillStyle='rgba(0,0,0,0.4)'; c.fill();
    c.beginPath(); c.arc(px,py,12,0,Math.PI*2); c.fillStyle='#e8c547'; c.strokeStyle='#fff'; c.lineWidth=2; c.fill(); c.stroke();
    c.fillStyle='#000'; c.font='bold 12px "DM Mono",monospace'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(idx+1, px, py);
  });
}

