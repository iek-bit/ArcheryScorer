// ═══════════════════════════════════════════════
//  SESSION END
// ═══════════════════════════════════════════════
function isTournamentEarlyExit() { return !!session && isTournamentSession(session) && session.rounds.length < 6; }

function updateEndOverlay() {
  const title = document.getElementById('endOverlayTitle'), message = document.getElementById('endOverlayMessage');
  const primaryBtn = document.getElementById('endOverlayPrimaryBtn'), dangerBtn = document.getElementById('endOverlayDangerBtn'), cancelBtn = document.getElementById('endOverlayCancelBtn');

  if (session?.ephemeral) {
    title.textContent = 'End Quick Score?'; message.textContent = 'Your score will be shown but not saved.';
    primaryBtn.style.display = ''; primaryBtn.textContent = 'SEE RESULTS'; primaryBtn.onclick = endSession;
    dangerBtn.style.display = 'none'; cancelBtn.textContent = 'CONTINUE SCORING'; return;
  }
  if (isTournamentEarlyExit()) {
    title.textContent = 'Leave Tournament?'; message.textContent = 'Tournament sessions cannot be saved early. You can discard this session or keep scoring.';
    primaryBtn.style.display = 'none'; dangerBtn.style.display = ''; dangerBtn.textContent = 'DISCARD SESSION'; dangerBtn.onclick = openDiscardSessionConfirm;
    cancelBtn.textContent = 'CONTINUE SCORING'; return;
  }
  title.textContent = 'End Session?'; message.textContent = 'Choose whether to save your progress or discard this session entirely.';
  primaryBtn.style.display = ''; primaryBtn.textContent = 'SAVE & EXIT'; primaryBtn.onclick = endSession;
  dangerBtn.style.display = ''; dangerBtn.textContent = 'DISCARD SESSION'; dangerBtn.onclick = openDiscardSessionConfirm;
  cancelBtn.textContent = 'CONTINUE SESSION';
}

function openEndSession() { updateEndOverlay(); document.getElementById('endOverlay').classList.add('open'); }

function openNotesPopup() {
  if (!session || !session.currentRound) return;
  const cr = session.currentRound;
  const rn = sessionRoundNumber();
  const info = roundDescriptor(cr);
  const labelEl = document.getElementById('notesPopupRoundLabel');
  if (labelEl) labelEl.textContent = `Round ${rn} · ${info.label}`;
  const ta = document.getElementById('notesPopupTextarea');
  if (ta) {
    ta.value = cr.notes || '';
    ta.disabled = cr.locked;
  }
  document.getElementById('notesPopupOverlay').classList.add('open');
  setTimeout(() => { if (ta && !cr.locked) ta.focus(); }, 200);
}

function saveNotesPopup() {
  if (!session || !session.currentRound) return;
  const ta = document.getElementById('notesPopupTextarea');
  if (ta) {
    session.currentRound.notes = ta.value;
    const hidden = document.getElementById('activeRoundNotes');
    if (hidden) hidden.value = ta.value;
  }
  closeOverlay('notesPopupOverlay');
  const btn = document.getElementById('notesHeaderBtn');
  if (btn) {
    const hasNote = !!(ta && ta.value.trim());
    btn.style.borderColor = hasNote ? 'var(--accent)' : '';
    btn.style.color = hasNote ? 'var(--accent)' : '';
  }
}
function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
  // When the session history overlay is closed, clear the active index and
  // refresh the Stats page so stale round-1 data does not linger.
  if (id === 'sessionOverlay') {
    activeSessionIdx = null;
    if (document.getElementById('page-diag').classList.contains('active')) {
      renderDiag();
    }
  }
}
function sessionHasProgress() { return !!session && (session.rounds.length > 0 || session.currentRound.arrows.length > 0); }

function openPhotoScoreOverlay(context = 'beta') {
  photoScoreState.context = context === 'round' ? 'round' : 'beta';
  initPhotoScoreLibraries();
  updatePhotoScoreEngineAvailability();
  updatePhotoScoreReviewVisibility();
  document.getElementById('photoScoreOverlay').classList.add('open');
}

function closePhotoScoreOverlay() {
  closeOverlay('photoScoreOverlay');
}

function openRoundPhotoScoreOverlay() {
  if (!session || !isPhotoTournamentSession(session) || session.currentRound.locked) return;
  triggerRoundPhotoScorePicker();
}

function setPhotoScoreStatus(message, tone = '') {
  const el = document.getElementById('photoScoreStatus');
  el.textContent = message;
  el.className = `photo-score-status${tone ? ` ${tone}` : ''}`;
}

function resetPhotoScoreState() {
  photoScoreState = {
    context: photoScoreState.context === 'round' ? 'round' : 'beta',
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
    isReady: photoScoreEngine.opencvReady && photoScoreEngine.tesseractReady && !photoScoreEngine.error
  };

  const input = document.getElementById('photoScoreInput');
  if (input) input.value = '';
  const roundInput = document.getElementById('photoRoundInput');
  if (roundInput) roundInput.value = '';
  document.getElementById('photoScoreFileName').textContent = 'No image selected yet.';
  updatePhotoScoreEngineAvailability();
  document.getElementById('photoScoreResults').style.display = 'none';
  document.getElementById('photoScoreOriginalPreview').removeAttribute('src');
  const cropCanvas = document.getElementById('photoScoreCropCanvas');
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  const normalizedCanvas = document.getElementById('photoScoreNormalizedCanvas');
  normalizedCanvas.getContext('2d').clearRect(0, 0, normalizedCanvas.width, normalizedCanvas.height);
  const gridCanvas = document.getElementById('photoScoreGridCanvas');
  gridCanvas.getContext('2d').clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  document.getElementById('photoScoreRoundReview').style.display = 'none';
  document.getElementById('photoScoreReviewGrid').innerHTML = '';
  const validationList = document.getElementById('photoScoreValidationList');
  if (validationList) {
    validationList.innerHTML = '';
    validationList.style.display = 'none';
  }
  const debugList = document.getElementById('photoScoreDebugList');
  if (debugList) debugList.innerHTML = '';
  const inlineGrid = document.getElementById('photoRoundInlineReviewGrid');
  if (inlineGrid) inlineGrid.innerHTML = '';
  hideInlinePhotoReview();
  clearRoundPhotoScanState();
  updatePhotoScoreReviewVisibility();
  photoScoreScriptStatusApplied = false;
  updatePhotoScoreEngineAvailability();
}

async function handlePhotoScoreFileChange(event) {
  const file = event.target.files?.[0];
  await preparePhotoScoreFile(file, 'beta');
}

async function handleRoundPhotoScoreFileChange(event) {
  const file = event.target.files?.[0];
  await preparePhotoScoreFile(file, 'round', true);
}

async function preparePhotoScoreFile(file, context = 'beta', autoRun = false) {
  if (!file) {
    if (context !== 'round') resetPhotoScoreState();
    return;
  }
  if (!file.type.startsWith('image/')) {
    appAlert('Please choose an image file.');
    if (context !== 'round') resetPhotoScoreState();
    return;
  }

  photoScoreState.context = context === 'round' ? 'round' : 'beta';
  const imageDataUrl = await fileToDataUrl(file);
  photoScoreState.file = file;
  photoScoreState.originalImageDataUrl = imageDataUrl;
  photoScoreState.warpedImageDataUrl = '';
  photoScoreState.processedImageDataUrl = '';
  photoScoreState.overlayImageDataUrl = '';
  photoScoreState.imageMeta = null;
  photoScoreState.cellResults = [];
  photoScoreState.reviewTournamentScores = [];
  photoScoreState.predictionsCount = 0;
  photoScoreState.validationIssues = [];
  photoScoreState.isReady = photoScoreEngine.opencvReady && photoScoreEngine.tesseractReady && !photoScoreEngine.error;

  document.getElementById('photoScoreFileName').textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  document.getElementById('photoScoreOriginalPreview').src = imageDataUrl;
  updatePhotoScoreEngineAvailability();
  document.getElementById('photoScoreResults').style.display = 'none';
  if (context === 'round') {
    hideInlinePhotoReview();
    setRoundPhotoScanState(file.name, imageDataUrl, `Ready to process ${file.name}.`, 'processing');
    setPhotoRoundSubtitle(`Ready to process ${file.name}.`);
    if (autoRun) await runPhotoScoreDetection();
  } else {
    setPhotoScoreStatus('Image ready. Process the scorecard to straighten and read it.');
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

async function runPhotoScoreDetection() {
  if (!photoScoreState.originalImageDataUrl || photoScoreState.isLoading) return;
  const ready = await initPhotoScoreLibraries();
  if (!ready) {
    setPhotoScoreStatus(photoScoreEngine.error || 'The local photo-score engine could not be loaded.', 'error');
    return;
  }

  photoScoreState.isLoading = true;
  updatePhotoScoreEngineAvailability();
  if (photoScoreState.context === 'round') {
    setPhotoRoundSubtitle('Finding scorecard...');
    setRoundPhotoScanStatus('Finding scorecard...', 'processing');
  } else setPhotoScoreStatus('Finding scorecard...');

  try {
    const img = await loadPhotoScoreImage(photoScoreState.originalImageDataUrl);
    photoScoreState.imageMeta = { width: img.naturalWidth, height: img.naturalHeight };
    const sourceCanvas = imageToCanvas(img);
    const warpedCanvas = detectAndWarpScorecard(sourceCanvas, PHOTO_SCORE_TEMPLATE);
    photoScoreState.predictionsCount = 30;
    photoScoreState.warpedImageDataUrl = warpedCanvas.toDataURL('image/png');

    if (photoScoreState.context === 'round') {
      setPhotoRoundSubtitle('Straightening image...');
      setRoundPhotoScanStatus('Straightening image...', 'processing');
    } else {
      setPhotoScoreStatus('Straightening image...');
    }

    const processedCanvas = preprocessWarpedScorecard(warpedCanvas, PHOTO_SCORE_TEMPLATE);
    photoScoreState.processedImageDataUrl = processedCanvas.toDataURL('image/png');
    const overlayCanvas = drawPhotoScoreTemplateOverlay(warpedCanvas, PHOTO_SCORE_TEMPLATE);
    photoScoreState.overlayImageDataUrl = overlayCanvas.toDataURL('image/png');
    renderPhotoScorePreviewCanvases(warpedCanvas, processedCanvas, overlayCanvas);

    if (photoScoreState.context === 'round') {
      setPhotoRoundSubtitle('Reading score marks...');
      setRoundPhotoScanStatus('Reading score marks...', 'processing');
    } else {
      setPhotoScoreStatus('Reading score marks...');
    }

    const cellResults = await recognizePhotoScoreCells(processedCanvas, warpedCanvas, PHOTO_SCORE_TEMPLATE, session);
    photoScoreState.cellResults = cellResults;
    const detailedOverlayCanvas = drawPhotoScoreTemplateOverlay(
      warpedCanvas,
      PHOTO_SCORE_TEMPLATE,
      cellResults,
      session?.type === '3d_tournament' ? '3d' : 'bullseye'
    );
    photoScoreState.overlayImageDataUrl = detailedOverlayCanvas.toDataURL('image/png');
    renderPhotoScorePreviewCanvases(warpedCanvas, processedCanvas, detailedOverlayCanvas);
    photoScoreState.reviewTournamentScores = buildPhotoScoreReviewValuesFromCells(cellResults, PHOTO_SCORE_TEMPLATE.rows, PHOTO_SCORE_TEMPLATE.cols);
    photoScoreState.validationIssues = buildPhotoScoreValidationIssues(cellResults, photoScoreState.reviewTournamentScores, session);
    renderPhotoScoreResult();
    renderPhotoScoreReviewGrid();
    renderPhotoScoreDebugList();
    updatePhotoScoreReviewVisibility();
    if (photoScoreState.context === 'round') {
      showInlinePhotoReview();
      setPhotoRoundSubtitle('Review detected scores.');
      setRoundPhotoScanStatus(photoScoreState.validationIssues.length ? 'Review the highlighted cells before applying.' : 'Review detected scores.');
    } else {
      setPhotoScoreStatus(photoScoreState.validationIssues.length ? 'Review detected scores and highlighted cells.' : 'Review detected scores.', photoScoreState.validationIssues.length ? '' : 'success');
    }
  } catch (error) {
    if (photoScoreState.context === 'round') {
      setPhotoRoundSubtitle(error.message || 'Could not process the scorecard.', true);
      setRoundPhotoScanStatus(error.message || 'Could not process the scorecard.', 'error');
    } else setPhotoScoreStatus(error.message || 'Could not process the scorecard.', 'error');
  } finally {
    photoScoreState.isLoading = false;
    updatePhotoScoreEngineAvailability();
  }
}

function renderPhotoScoreResult() {
  if (!photoScoreState.warpedImageDataUrl) return;
  document.getElementById('photoScoreResults').style.display = 'block';
  const confidence = photoScoreState.cellResults.length
    ? Math.round(photoScoreState.cellResults.reduce((sum, cell) => sum + (cell.confidence || 0), 0) / photoScoreState.cellResults.length)
    : 0;
  document.getElementById('photoScoreConfidence').textContent = confidence ? `${confidence}%` : '--';
  document.getElementById('photoScoreDetections').textContent = String(photoScoreState.cellResults.length || 0);
}

async function loadPhotoScoreImage(imageDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open the selected image.'));
    img.src = imageDataUrl;
  });
}

function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}

function detectAndWarpScorecard(sourceCanvas, template) {
  const cv = window.cv;
  const src = cv.imread(sourceCanvas);
  const maxDimension = 1400;
  const scale = Math.min(1, maxDimension / Math.max(src.cols, src.rows));
  const working = new cv.Mat();
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edged = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const resized = new cv.Size(Math.max(1, Math.round(src.cols * scale)), Math.max(1, Math.round(src.rows * scale)));
  cv.resize(src, working, resized, 0, 0, cv.INTER_AREA);
  cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  cv.Canny(blurred, edged, 75, 200);
  cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  let bestContour = null;
  let bestArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const perimeter = cv.arcLength(contour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, perimeter * 0.02, true);
    if (approx.rows === 4) {
      const area = Math.abs(cv.contourArea(approx));
      if (area > bestArea) {
        if (bestContour) bestContour.delete();
        bestContour = approx;
        bestArea = area;
      } else {
        approx.delete();
      }
    } else {
      approx.delete();
    }
    contour.delete();
  }

  if (!bestContour) {
    src.delete(); working.delete(); gray.delete(); blurred.delete(); edged.delete(); contours.delete(); hierarchy.delete();
    throw new Error('Could not find the full scorecard. Retake the photo with all four corners visible.');
  }

  const points = [];
  for (let i = 0; i < 4; i++) {
    points.push({
      x: bestContour.data32S[i * 2] / scale,
      y: bestContour.data32S[i * 2 + 1] / scale
    });
  }
  const ordered = orderQuadPoints(points);
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flatMap(point => [point.x, point.y]));
  const dstTri = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    [0, 0, template.canonicalWidth - 1, 0, template.canonicalWidth - 1, template.canonicalHeight - 1, 0, template.canonicalHeight - 1]
  );
  const transform = cv.getPerspectiveTransform(srcTri, dstTri);
  const warped = new cv.Mat();
  cv.warpPerspective(src, warped, transform, new cv.Size(template.canonicalWidth, template.canonicalHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = template.canonicalWidth;
  outputCanvas.height = template.canonicalHeight;
  cv.imshow(outputCanvas, warped);

  src.delete(); working.delete(); gray.delete(); blurred.delete(); edged.delete(); contours.delete(); hierarchy.delete(); bestContour.delete(); srcTri.delete(); dstTri.delete(); transform.delete(); warped.delete();
  return outputCanvas;
}

function orderQuadPoints(points) {
  const sumSorted = [...points].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const diffSorted = [...points].sort((a, b) => (a.y - a.x) - (b.y - b.x));
  return [sumSorted[0], diffSorted[0], sumSorted[3], diffSorted[3]];
}

function preprocessWarpedScorecard(warpedCanvas, template) {
  const cv = window.cv;
  const src = cv.imread(warpedCanvas);
  const gray = new cv.Mat();
  const normalized = new cv.Mat();
  const thresh = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.equalizeHist(gray, normalized);
  cv.adaptiveThreshold(normalized, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 12);
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = template.canonicalWidth;
  outputCanvas.height = template.canonicalHeight;
  cv.imshow(outputCanvas, thresh);
  src.delete(); gray.delete(); normalized.delete(); thresh.delete();
  return outputCanvas;
}

function drawPhotoScoreTemplateOverlay(warpedCanvas, template, cellResults = null, mode = 'bullseye') {
  const canvas = document.createElement('canvas');
  canvas.width = warpedCanvas.width;
  canvas.height = warpedCanvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(warpedCanvas, 0, 0);
  ctx.strokeStyle = 'rgba(232,197,71,0.95)';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(232,197,71,0.12)';
  template.cells.flat().forEach(cell => {
    const x = cell.x * canvas.width;
    const y = cell.y * canvas.height;
    const w = cell.width * canvas.width;
    const h = cell.height * canvas.height;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  });
  const options = getPhotoScoreOptionLayout(template, mode);
  const sampleWidth = template.markSampleWidthRatio * canvas.width * template.scoreStripRegion.width;
  const flattenedResults = Array.isArray(cellResults) && cellResults.length ? cellResults : template.cells.flat().map(cell => ({
    roundIndex: cell.rowIndex,
    arrowIndex: cell.arrowIndex,
    cell,
    alignment: { dx: 0, dy: 0 },
    bestOption: '',
    valid: false
  }));
  flattenedResults.forEach(result => {
    const cell = result.cell || template.cells[result.roundIndex]?.[result.arrowIndex];
    if (!cell) return;
    const y = (cell.y + cell.height / 2) * canvas.height + (result.alignment?.dy || 0);
    const stripX = cell.x * canvas.width;
    const stripWidth = cell.width * canvas.width;
    const sampleHeight = cell.height * canvas.height * template.markSampleHeightRatio;
    const dx = result.alignment?.dx || 0;
    options.forEach(option => {
      const centerX = stripX + option.center * stripWidth + dx;
      const isBest = result.bestOption === option.label;
      ctx.strokeStyle = isBest
        ? (result.valid ? 'rgba(82,194,120,0.98)' : 'rgba(224,82,82,0.98)')
        : 'rgba(232,197,71,0.75)';
      ctx.lineWidth = isBest ? 2.6 : 1.4;
      ctx.strokeRect(centerX - sampleWidth / 2, y - sampleHeight / 2, sampleWidth, sampleHeight);
    });
  });
  return canvas;
}

function renderPhotoScorePreviewCanvases(warpedCanvas, processedCanvas, overlayCanvas) {
  const cropCanvas = document.getElementById('photoScoreCropCanvas');
  const normalizedCanvas = document.getElementById('photoScoreNormalizedCanvas');
  const gridCanvas = document.getElementById('photoScoreGridCanvas');
  drawCanvasIntoCanvas(warpedCanvas, cropCanvas);
  drawCanvasIntoCanvas(processedCanvas, normalizedCanvas);
  drawCanvasIntoCanvas(overlayCanvas, gridCanvas);
}

function drawCanvasIntoCanvas(sourceCanvas, targetCanvas) {
  const ctx = targetCanvas.getContext('2d');
  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0);
}

async function recognizePhotoScoreCells(processedCanvas, warpedCanvas, template, sessionObj = session) {
  const mode = sessionObj?.type === '3d_tournament' ? '3d' : 'bullseye';
  const results = [];
  for (let roundIndex = 0; roundIndex < template.rows; roundIndex++) {
    for (let arrowIndex = 0; arrowIndex < template.cols; arrowIndex++) {
      const cell = template.cells[roundIndex][arrowIndex];
      const markResult = detectPhotoScoreMark(processedCanvas, warpedCanvas, cell, template, mode);
      let rawText = markResult.rawText;
      let normalizedValue = markResult.normalizedValue;
      let confidence = markResult.confidence;
      if (!normalizedValue || confidence < 52) {
        const cropCanvas = cropPhotoScoreCell(warpedCanvas, cell);
        const raw = await window.Tesseract.recognize(cropCanvas, 'eng', { logger: () => {} });
        const ocrText = raw?.data?.text || '';
        const ocrConfidence = clamp(Math.round(raw?.data?.confidence || 0), 0, 100);
        const normalizedFromOcr = normalizePhotoScoreLabel(ocrText, mode);
        if (normalizedFromOcr && (!normalizedValue || ocrConfidence >= confidence)) {
          rawText = ocrText;
          normalizedValue = normalizedFromOcr;
          confidence = ocrConfidence;
        } else if (ocrText && !rawText) {
          rawText = ocrText;
        }
      }
      results.push({
        roundIndex,
        arrowIndex,
        rawText,
        confidence,
        normalizedValue,
        valid: !!normalizedValue,
        cell,
        bestOption: markResult.bestOption || null,
        runnerUpOption: markResult.runnerUpOption || null,
        alignment: markResult.alignment || { dx: 0, dy: 0 },
        ink: markResult.ink || 0,
        contrast: markResult.contrast || 0,
        ambiguity: markResult.ambiguity || 0,
        offsetOptions: markResult.offsetOptions || []
      });
    }
  }
  return results;
}

function getPhotoScoreOptionLayout(template, mode = 'bullseye') {
  if (mode === '3d') {
    return template.threeDOptions.map((label, index) => ({ label, center: template.threeDOptionCenters[index] }));
  }
  return template.bullseyeOptions.map((label, index) => ({ label, center: template.bullseyeOptionCenters[index] }));
}

function detectPhotoScoreMark(processedCanvas, warpedCanvas, cell, template, mode = 'bullseye') {
  const options = getPhotoScoreOptionLayout(template, mode);
  const binaryCtx = processedCanvas.getContext('2d', { willReadFrequently: true });
  const warpedCtx = warpedCanvas.getContext('2d', { willReadFrequently: true });
  const x = Math.round(cell.x * processedCanvas.width);
  const y = Math.round(cell.y * processedCanvas.height);
  const width = Math.max(1, Math.round(cell.width * processedCanvas.width));
  const height = Math.max(1, Math.round(cell.height * processedCanvas.height));
  const binaryData = binaryCtx.getImageData(x, y, width, height).data;
  const warpedData = warpedCtx.getImageData(x, y, width, height).data;
  const sampleWidth = Math.max(4, Math.round(width * (template.markSampleWidthRatio * 1.15)));
  const sampleHeight = Math.max(4, Math.round(height * (template.markSampleHeightRatio * 0.9)));
  const centerY = Math.round(height / 2);
  const dxCandidates = [-0.02, -0.012, -0.006, 0, 0.006, 0.012, 0.02].map(ratio => Math.round(width * ratio));
  const dyCandidates = [-0.18, -0.1, -0.05, 0, 0.05, 0.1, 0.18].map(ratio => Math.round(height * ratio));
  let bestCandidate = null;

  dyCandidates.forEach(dy => {
    dxCandidates.forEach(dx => {
      const scores = options.map(option => {
        const centerX = Math.round(option.center * width) + dx;
        const sample = samplePhotoScoreInk(binaryData, warpedData, width, height, centerX, centerY + dy, sampleWidth, sampleHeight);
        return { ...option, ...sample };
      }).sort((a, b) => b.score - a.score);
      const best = scores[0];
      const runnerUp = scores[1] || { score: 0 };
      const medianScore = robustQuantile(scores.map(score => score.score), 0.5) || 0;
      const contrast = best.score - Math.max(runnerUp.score, medianScore);
      const ambiguity = Math.max(0, runnerUp.score - medianScore);
      const candidateScore = best.score * 1.1 + contrast * 1.8 - ambiguity * 0.9;
      if (!bestCandidate || candidateScore > bestCandidate.candidateScore) {
        bestCandidate = {
          dx,
          dy,
          scores,
          best,
          runnerUp,
          contrast,
          ambiguity,
          candidateScore
        };
      }
    });
  });

  const best = bestCandidate?.best || { label: '', score: 0, binaryInk: 0, grayscaleInk: 0 };
  const runnerUp = bestCandidate?.runnerUp || { label: '', score: 0 };
  const contrast = bestCandidate?.contrast || 0;
  const normalizedValue = normalizePhotoScoreLabel(best.label, mode);
  const confidence = clamp(Math.round(14 + best.score * 115 + contrast * 540 - (bestCandidate?.ambiguity || 0) * 180), 0, 100);
  const valid = !!normalizedValue && best.score > 0.22 && contrast > 0.035 && (bestCandidate?.ambiguity || 0) < 0.03;
  return {
    rawText: best.label,
    normalizedValue: valid ? normalizedValue : '',
    confidence: valid ? confidence : clamp(Math.round(confidence * 0.45), 0, 55),
    bestOption: best.label || '',
    runnerUpOption: runnerUp.label || '',
    alignment: { dx: bestCandidate?.dx || 0, dy: bestCandidate?.dy || 0 },
    ink: best.score || 0,
    contrast,
    ambiguity: bestCandidate?.ambiguity || 0,
    offsetOptions: bestCandidate?.scores || []
  };
}

function samplePhotoScoreInk(binaryData, warpedData, width, height, centerX, centerY, sampleWidth, sampleHeight) {
  const startX = clamp(Math.round(centerX - sampleWidth / 2), 0, width - 1);
  const startY = clamp(Math.round(centerY - sampleHeight / 2), 0, height - 1);
  const endX = clamp(startX + sampleWidth, 1, width);
  const endY = clamp(startY + sampleHeight, 1, height);
  let totalBinaryInk = 0;
  let totalGrayInk = 0;
  let count = 0;
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const idx = (py * width + px) * 4;
      const binaryShade = binaryData[idx];
      const grayShade = warpedData[idx];
      totalBinaryInk += 1 - binaryShade / 255;
      totalGrayInk += 1 - grayShade / 255;
      count++;
    }
  }
  const binaryInk = count ? totalBinaryInk / count : 0;
  const grayscaleInk = count ? totalGrayInk / count : 0;
  return {
    binaryInk,
    grayscaleInk,
    score: binaryInk * 0.65 + grayscaleInk * 0.35
  };
}

function cropPhotoScoreCell(processedCanvas, cell) {
  const canvas = document.createElement('canvas');
  const x = Math.round(cell.x * processedCanvas.width);
  const y = Math.round(cell.y * processedCanvas.height);
  const width = Math.max(1, Math.round(cell.width * processedCanvas.width));
  const height = Math.max(1, Math.round(cell.height * processedCanvas.height));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(processedCanvas, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function buildPhotoScoreReviewValuesFromCells(cellResults, rows = 6, cols = 5) {
  const values = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
  cellResults.forEach(cell => {
    values[cell.roundIndex][cell.arrowIndex] = cell.normalizedValue || '';
  });
  return values;
}

function buildPhotoScoreValidationIssues(cellResults, reviewValues, sessionObj = session) {
  const issues = [];
  const mode = sessionObj?.type === '3d_tournament' ? '3d' : 'bullseye';
  cellResults.forEach(cell => {
    if (!cell.normalizedValue) {
      issues.push({ tone: 'error', roundIndex: cell.roundIndex, arrowIndex: cell.arrowIndex, message: `Round ${cell.roundIndex + 1}, Arrow ${cell.arrowIndex + 1}: the score mark was unclear. Retake or correct this ${mode === '3d' ? '3D' : 'bullseye'} arrow manually.` });
    } else if (cell.confidence < 82) {
      issues.push({ tone: '', roundIndex: cell.roundIndex, arrowIndex: cell.arrowIndex, message: `Round ${cell.roundIndex + 1}, Arrow ${cell.arrowIndex + 1}: the detected mark is low-confidence (${cell.confidence}%). Double-check this row.` });
    }
    if ((cell.contrast || 0) < 0.055) {
      issues.push({ tone: '', roundIndex: cell.roundIndex, arrowIndex: cell.arrowIndex, message: `Round ${cell.roundIndex + 1}, Arrow ${cell.arrowIndex + 1}: the top two mark candidates were very close. This row may be ambiguous.` });
    }
  });
  if (reviewValues.some(round => round.some(value => !value))) {
    issues.push({ tone: 'error', roundIndex: null, arrowIndex: null, message: 'One or more score cells are blank or invalid. Review every arrow before applying the tournament.' });
  }
  return issues;
}

function fitRectWithin(sourceWidth, sourceHeight, targetWidth, targetHeight, insetRatio = 0) {
  const insetX = targetWidth * insetRatio;
  const insetY = targetHeight * insetRatio;
  const maxWidth = Math.max(1, targetWidth - insetX * 2);
  const maxHeight = Math.max(1, targetHeight - insetY * 2);
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const dw = sourceWidth * scale;
  const dh = sourceHeight * scale;
  return {
    dx: (targetWidth - dw) / 2,
    dy: (targetHeight - dh) / 2,
    dw,
    dh
  };
}

function downloadPhotoScoreCanvas(canvasId, filename) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

function updatePhotoScoreReviewVisibility() {
  const reviewPanel = document.getElementById('photoScoreRoundReview');
  const isRoundContext = photoScoreState.context === 'round' && isPhotoTournamentSession(session);
  reviewPanel.style.display = isRoundContext && photoScoreState.reviewTournamentScores.length ? 'block' : 'none';
}

function inferPhotoTournamentScores(predictions, sessionObj = session) {
  return buildPhotoScoreReviewValuesFromCells(predictions || [], PHOTO_SCORE_TEMPLATE.rows, PHOTO_SCORE_TEMPLATE.cols);
}

function robustQuantile(values, ratio = 0.5) {
  const nums = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return NaN;
  if (nums.length === 1) return nums[0];
  const clamped = clamp(ratio, 0, 1);
  const index = (nums.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return nums[lower];
  const weight = index - lower;
  return nums[lower] * (1 - weight) + nums[upper] * weight;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePhotoScoreLabel(rawLabel, mode = 'bullseye') {
  const label = String(rawLabel).trim().toUpperCase().replace(/\s+/g, '');
  if (!label) return '';
  if (['X', '×'].includes(label)) return mode === '3d' ? '10' : 'X';
  if (['M', 'MISS', '0', 'O'].includes(label)) return 'M';
  if (['I', 'L', '|'].includes(label)) return '1';
  if (label === 'S') return '5';
  if (mode === '3d') {
    if (['10', '9', '8', '7'].includes(label)) return label;
    if (['6', '5', '4', '3', '2', '1'].includes(label)) return '7';
  }
  return ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'].includes(label) ? label : '';
}

function getPhotoScoreCellResult(roundIndex, arrowIndex) {
  return photoScoreState.cellResults.find(cell => cell.roundIndex === roundIndex && cell.arrowIndex === arrowIndex) || null;
}

function getPhotoReviewCellState(roundIndex, arrowIndex, value) {
  const cell = getPhotoScoreCellResult(roundIndex, arrowIndex);
  if (!value || !cell || !cell.valid) return 'invalid';
  if ((cell.confidence || 0) < 82 || (cell.contrast || 0) < 0.055) return 'uncertain';
  return 'good';
}

function renderPhotoScoreDebugList() {
  const debugList = document.getElementById('photoScoreDebugList');
  if (!debugList) return;
  if (!photoScoreState.cellResults.length) {
    debugList.innerHTML = '';
    return;
  }
  debugList.innerHTML = photoScoreState.cellResults.map(cell => {
    const state = getPhotoReviewCellState(cell.roundIndex, cell.arrowIndex, cell.normalizedValue);
    const topOptions = Array.isArray(cell.offsetOptions)
      ? cell.offsetOptions.slice(0, 3).map(option => `${option.label}:${(option.score || 0).toFixed(2)}`).join(' · ')
      : '';
    const chosen = cell.normalizedValue || 'blank';
    const runnerUp = cell.runnerUpOption || 'none';
    return `
      <div class="photo-score-debug-item ${state}">
        <div class="photo-score-debug-head">
          <span>Round ${cell.roundIndex + 1} · Arrow ${cell.arrowIndex + 1}</span>
          <span>${cell.confidence || 0}%</span>
        </div>
        <div class="photo-score-debug-value">Chosen: <strong>${chosen}</strong> · Runner-up: <strong>${runnerUp}</strong> · Raw: <strong>${cell.rawText || '—'}</strong></div>
        <div class="photo-score-debug-metrics">Ink ${(cell.ink || 0).toFixed(3)} · Contrast ${(cell.contrast || 0).toFixed(3)} · Ambiguity ${(cell.ambiguity || 0).toFixed(3)} · Offset ${cell.alignment?.dx || 0}px / ${cell.alignment?.dy || 0}px</div>
        <div class="photo-score-debug-metrics">Top candidates: ${topOptions || 'No candidates captured'}</div>
      </div>
    `;
  }).join('');
}

function renderPhotoScoreReviewGrid() {
  const modalGrid = document.getElementById('photoScoreReviewGrid');
  const inlineGrid = document.getElementById('photoRoundInlineReviewGrid');
  const validationList = document.getElementById('photoScoreValidationList');
  const mode = session?.type === '3d_tournament' ? '3d' : 'bullseye';
  const values = photoScoreState.reviewTournamentScores.length
    ? photoScoreState.reviewTournamentScores
    : getExistingPhotoTournamentReviewValues();
  const modalMarkup = values.map((roundValues, roundIndex) => {
    const roundInfo = getTournamentRoundConfigByIndex(session, roundIndex);
    const descriptor = roundDescriptor(roundInfo).shortLabel;
    const cells = roundValues.map((value, arrowIndex) => `
      <div class="score-review-cell ${getPhotoReviewCellState(roundIndex, arrowIndex, value)}">
        <label>Arrow ${arrowIndex + 1}</label>
        <select data-round-index="${roundIndex}" data-arrow-index="${arrowIndex}" onchange="updatePhotoReviewScore(${roundIndex}, ${arrowIndex}, this.value)">
          ${getPhotoReviewOptions(mode, value)}
        </select>
      </div>
    `).join('');
    return `
      <div class="photo-tournament-review-row" style="margin-bottom:16px">
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Round ${roundIndex + 1} · ${descriptor}</div>
        <div class="score-review-grid">${cells}</div>
      </div>
    `;
  }).join('');
  const inlineMarkup = `
    <div class="photo-inline-rounds">
      ${values.map((roundValues, roundIndex) => {
        const roundInfo = getTournamentRoundConfigByIndex(session, roundIndex);
        const descriptor = roundDescriptor(roundInfo).shortLabel;
        const cells = roundValues.map((value, arrowIndex) => `
          <div class="score-review-cell ${getPhotoReviewCellState(roundIndex, arrowIndex, value)}">
            <label>A${arrowIndex + 1}</label>
            <select data-round-index="${roundIndex}" data-arrow-index="${arrowIndex}" onchange="updatePhotoReviewScore(${roundIndex}, ${arrowIndex}, this.value)">
              ${getPhotoReviewOptions(mode, value)}
            </select>
          </div>
        `).join('');
        return `
          <div class="photo-inline-round-card">
            <div class="photo-inline-round-header">
              <div class="photo-inline-round-title">Round ${roundIndex + 1} · ${descriptor}</div>
            </div>
            <div class="photo-inline-arrow-grid">${cells}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  if (modalGrid) modalGrid.innerHTML = modalMarkup;
  if (inlineGrid) inlineGrid.innerHTML = inlineMarkup;
  if (validationList) {
    if (photoScoreState.validationIssues.length) {
      validationList.innerHTML = photoScoreState.validationIssues.map(issue => `
        <div class="photo-score-validation-item${issue.tone ? ` ${issue.tone}` : ''}">${issue.message}</div>
      `).join('');
      validationList.style.display = 'flex';
    } else {
      validationList.innerHTML = '';
      validationList.style.display = 'none';
    }
  }
  document.getElementById('photoScoreReviewNote').textContent = 'Green cells are solid reads. Amber cells are low-confidence. Red cells need manual correction before applying.';
  const inlineNote = document.getElementById('photoRoundInlineReviewNote');
  if (inlineNote) inlineNote.textContent = 'Green cells are solid reads. Amber cells are low-confidence. Red cells need manual correction before applying.';
  document.getElementById('photoScoreApplyBtn').textContent = 'Apply Tournament';
}

function getPhotoReviewOptions(mode = 'bullseye', selected = '') {
  const values = mode === '3d' ? ['', '10', '9', '8', '7', 'M'] : ['', 'X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'];
  return values.map(value => {
    const label = value || '—';
    const isSelected = value === selected ? ' selected' : '';
    return `<option value="${value}"${isSelected}>${label}</option>`;
  }).join('');
}

function updatePhotoReviewScore(roundIndex, arrowIndex, value) {
  if (!photoScoreState.reviewTournamentScores[roundIndex]) {
    photoScoreState.reviewTournamentScores[roundIndex] = Array.from({ length: 5 }, () => '');
  }
  photoScoreState.reviewTournamentScores[roundIndex][arrowIndex] = value;
  const existing = getPhotoScoreCellResult(roundIndex, arrowIndex);
  if (existing) {
    existing.normalizedValue = value;
    existing.valid = !!value;
    existing.confidence = Math.max(existing.confidence || 0, value ? 100 : existing.confidence || 0);
  }
  photoScoreState.validationIssues = buildPhotoScoreValidationIssues(photoScoreState.cellResults, photoScoreState.reviewTournamentScores, session);
  renderPhotoScoreReviewGrid();
  renderPhotoScoreDebugList();
}

function applyPhotoScoresToCurrentRound() {
  if (!session || !isPhotoTournamentSession(session)) return;
  const values = photoScoreState.reviewTournamentScores.length
    ? photoScoreState.reviewTournamentScores.map(round => Array.from({ length: 5 }, (_, index) => round?.[index] || ''))
    : [];
  if (!values.length || values.some(round => round.some(value => !value))) {
    appAlert('Please review all detected rounds and fill every arrow value before applying the tournament.');
    return;
  }

  session.rounds = values.map((roundValues, roundIndex) => {
    const baseRound = getTournamentRoundConfigByIndex(session, roundIndex);
    return normalizeRound({
      ...baseRound,
      arrows: roundValues.map((value, arrowIndex) => buildPhotoRoundArrow(value, arrowIndex, baseRound.mode)),
      locked: true
    });
  });
  const newPbRound = session.rounds.find(round => {
    const bucketKey = getPbBucketKey(round);
    const total = round.arrows.reduce((sum, arrow) => sum + arrow.score, 0);
    const existingBest = getBestSavedRoundScoreForBucket(bucketKey);
    return existingBest === null || total > existingBest;
  });
  if (newPbRound) showPersonalBestCelebration(newPbRound);
  session.currentRound = getTournamentRoundConfigByIndex(session, 0);
  session.currentRound.arrows = [];
  hideInlinePhotoReview();
  closePhotoScoreOverlay();
  renderScorePage();
  endSession();
}

function buildPhotoRoundArrow(label, index, mode = 'bullseye') {
  const numericScore = label === 'M' ? 0 : label === 'X' ? 10 : Number(label || 0);
  const normalizedScore = normalizeRoundScore(mode, numericScore);
  const fallbackX = -0.78 + index * 0.39;
  const fallbackY = 1.28;
  return {
    nx: fallbackX,
    ny: fallbackY,
    score: normalizedScore,
    source: 'photo'
  };
}

function scoreToReviewLabel(score, mode = 'bullseye') {
  if (score === 0) return 'M';
  if (mode !== '3d' && score === 10) return '10';
  return String(score);
}

function getTournamentRoundConfigByIndex(sessionObj = session, roundIndex = 0) {
  if (!sessionObj) return createRound('bullseye', 10);
  if (sessionObj.type === '3d_tournament') {
    const sequence = Array.isArray(sessionObj.tournamentSequence) && sessionObj.tournamentSequence.length === 6
      ? sessionObj.tournamentSequence
      : getThreeDTournamentSequence(sessionObj.startAnimal, sessionObj.direction);
    return createRound('3d', sequence[roundIndex] || sequence[0] || 'turkey');
  }
  return createRound('bullseye', roundIndex < 3 ? 10 : 15);
}

function getExistingPhotoTournamentReviewValues() {
  if (!session || !isTournamentSession(session)) return [];
  const values = Array.from({ length: 6 }, (_, roundIndex) => {
    const existingRound = session.rounds[roundIndex];
    if (!existingRound) return Array.from({ length: 5 }, () => '');
    return Array.from({ length: 5 }, (_, arrowIndex) => scoreToReviewLabel(existingRound.arrows?.[arrowIndex]?.score ?? '', existingRound.mode));
  });
  if (!session.rounds.length && session.currentRound?.arrows?.length) {
    values[0] = Array.from({ length: 5 }, (_, arrowIndex) => scoreToReviewLabel(session.currentRound.arrows?.[arrowIndex]?.score ?? '', session.currentRound.mode));
  }
  return values;
}

function triggerRoundPhotoScorePicker() {
  if (!session || !isPhotoTournamentSession(session) || session.currentRound.locked) return;
  const input = document.getElementById('photoRoundInput');
  if (input) {
    input.value = '';
    input.click();
  }
}

function setPhotoRoundSubtitle(message, isError = false) {
  const el = document.getElementById('photoRoundSubtitle');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? 'var(--danger)' : 'var(--muted)';
}

function setRoundPhotoScanState(fileName, imageSrc, status, tone = '') {
  const panel = document.getElementById('photoRoundScanState');
  const img = document.getElementById('photoRoundScanPreview');
  const fileEl = document.getElementById('photoRoundScanFile');
  if (panel) panel.classList.add('open');
  if (img && imageSrc) img.src = imageSrc;
  if (fileEl) fileEl.textContent = fileName || 'No image selected yet.';
  setRoundPhotoScanStatus(status, tone);
}

function setRoundPhotoScanStatus(message, tone = '') {
  const el = document.getElementById('photoRoundScanStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `photo-round-scan-status${tone ? ` ${tone}` : ''}`;
}

function clearRoundPhotoScanState() {
  const panel = document.getElementById('photoRoundScanState');
  const img = document.getElementById('photoRoundScanPreview');
  const fileEl = document.getElementById('photoRoundScanFile');
  if (panel) panel.classList.remove('open');
  if (img) img.removeAttribute('src');
  if (fileEl) fileEl.textContent = 'No image selected yet.';
  setRoundPhotoScanStatus('Choose a scorecard image to begin.');
}

function showInlinePhotoReview() {
  const panel = document.getElementById('photoRoundInlineReview');
  if (panel) panel.style.display = 'block';
  const editBtn = document.getElementById('photoRoundEditBtn');
  if (editBtn) editBtn.style.display = '';
}

function hideInlinePhotoReview() {
  const panel = document.getElementById('photoRoundInlineReview');
  if (panel) panel.style.display = 'none';
}

function toggleInlinePhotoReview() {
  const panel = document.getElementById('photoRoundInlineReview');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function openDiscardSessionConfirm() {
  if (!session) { closeOverlay('endOverlay'); goPage('score', document.getElementById('nav-score')); return; }
  if (!sessionHasProgress()) { confirmDiscardSession(); return; }
  document.getElementById('discardSessionOverlay').classList.add('open');
}

function endSession() {
  closeOverlay('endOverlay');
  if(!session) { goPage('score', document.getElementById('nav-score')); return; }
  if (session.ephemeral) {
    const cr = session.currentRound; if (cr.arrows.length > 0) session.rounds.push({...cr, arrows:[...cr.arrows]});
    showQuickScoreSummary(); return;
  }
  const finished = buildFinishedSession();
  session = null; resetActiveSessionUI();
  if (!finished || !finished.rounds.length) { renderHome(); goPage('score', document.getElementById('nav-score')); return; }
  finishingSession = finished; openFinishOverlay();
}

function showQuickScoreSummary() {
  const allRounds = session.rounds;
  const grandTotal = allRounds.reduce((t, r) => t + r.arrows.reduce((s, a) => s + a.score, 0), 0);
  document.getElementById('quickScoreTotalDisplay').textContent = grandTotal;
  const listEl = document.getElementById('quickScoreRoundList');
  listEl.innerHTML = allRounds.map((r, i) => {
    const rs = r.arrows.reduce((s, a) => s + a.score, 0);
    const pips = r.arrows.map(a => {
      const bg = quickScorePipColor(a.score); const light = a.score >= 3 && a.score <= 4 || a.score >= 1 && a.score <= 2;
      return `<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${bg};font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${light?'#bbb':'#000'}">${a.score===0?'M':a.score}</span>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);width:52px;flex-shrink:0">R${i+1} · ${r.distance}m</span>
      <div style="display:flex;gap:4px;flex:1;flex-wrap:wrap">${pips}</div>
      <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent);width:32px;text-align:right">${rs}</span>
    </div>`;
  }).join('');
  closeOverlay('roundCompleteOverlay'); document.getElementById('quickScoreSummaryOverlay').classList.add('open');
}

function quickScorePipColor(score) {
  if (score >= 9) return '#f7e900'; if (score >= 7) return '#e84040'; if (score >= 5) return '#3b82f6';
  if (score >= 3) return '#333333'; if (score >= 1) return '#dddddd'; return '#555555';
}

function exitEphemeralSession() {
  session = null; document.getElementById('quickScoreSummaryOverlay').classList.remove('open');
  resetActiveSessionUI(); renderHome(); goPage('score', document.getElementById('nav-score'));
}
function discardSession() { openDiscardSessionConfirm(); }
function confirmDiscardSession() {
  if (!session) { closeOverlay('discardSessionOverlay'); closeOverlay('endOverlay'); goPage('score', document.getElementById('nav-score')); return; }
  closeOverlay('discardSessionOverlay'); closeOverlay('endOverlay'); session = null;
  resetActiveSessionUI(); renderHome(); goPage('score', document.getElementById('nav-score'));
}

const FILTER_DEFS = [
  {key: 'all', label: 'All', group: 'meta'},
  {key: 'practice', label: 'Practice', group: 'scope'},
  {key: 'tournament', label: 'Tournament', group: 'scope'},
  {key: 'bullseye', label: 'Bullseye', group: 'family'},
  {key: '3d', label: '3D', group: 'family'},
  {key: '10m', label: '10m', group: 'value', family: 'bullseye'},
  {key: '15m', label: '15m', group: 'value', family: 'bullseye'},
  ...THREE_D_TARGETS.map(target => ({key: target.key, label: target.label, group: 'value', family: '3d'})),
  {key: 'arrow_filter', label: 'Arrow', group: 'arrow_parent'},
  {key: 'arrow_1', label: '1', group: 'arrow_num', parent: 'arrow_filter'},
  {key: 'arrow_2', label: '2', group: 'arrow_num', parent: 'arrow_filter'},
  {key: 'arrow_3', label: '3', group: 'arrow_num', parent: 'arrow_filter'},
  {key: 'arrow_4', label: '4', group: 'arrow_num', parent: 'arrow_filter'},
  {key: 'arrow_5', label: '5', group: 'arrow_num', parent: 'arrow_filter'}
];

const homeFilters = new Set();
const diagFilters = new Set();

let homeSort = 'newest';
let diagSort = 'newest';
let homeSearchQuery = '';
let activeSortContext = 'home';
let activeLocationContext = 'home';

function handleHomeSearch(val) {
  homeSearchQuery = val.toLowerCase().trim();
  const container = document.getElementById('homeSearchContainer');
  if (val) container.classList.add('has-text');
  else container.classList.remove('has-text');
  if (activeHistoryTab === 'club') renderClubHistory();
  else renderHome();
}

function buildSessionSearchCorpus(sessionObj) {
  const date = new Date(sessionObj.date);
  const total = getSessionTotal(sessionObj);
  const locStr = formatLocation(sessionObj.location);
  const roundDetails = (sessionObj.rounds || []).map((r, idx) => {
    const descriptor = roundDescriptor(r);
    const roundScore = (r.arrows || []).reduce((sum, a) => sum + (a.score || 0), 0);
    const arrowScores = (r.arrows || []).map(a => a.score === 0 ? 'miss' : String(a.score)).join(' ');
    const arrowLabels = (r.arrows || []).map(a => a.score === 0 ? 'm' : String(a.score)).join(' ');
    const animal = r.animal || '';
    const notes = r.notes || '';
    return [
      `round ${idx + 1}`,
      descriptor.shortLabel,
      descriptor.label || '',
      r.mode || '',
      animal,
      `${r.distance || ''}m`,
      `score ${roundScore}`,
      `round score ${roundScore}`,
      arrowScores,
      arrowLabels,
      notes
    ].join(' ');
  }).join(' ');

  return [
    sessionObj.archerName || '',
    normalizePersonName(sessionObj.archerName) || '',
    sessionTypeLabel(sessionObj),
    isTournamentSession(sessionObj) ? 'tournament tournament session' : 'practice practice session',
    locStr,
    sessionObj.location?.label || '',
    sessionObj.location?.city || '',
    sessionObj.location?.state || '',
    sessionObj.location?.country || '',
    sessionObj.notes || '',
    `score ${total}`,
    `total ${total}`,
    String(total),
    date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }),
    date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
    String(date.getFullYear()),
    date.toLocaleString('en-US', { month:'long' }),
    roundDetails
  ].join(' ').toLowerCase();
}

function sessionMatchesSearch(sessionObj, queryStr) {
  if (!queryStr) return true;
  const tokens = queryStr.split(/\s+/);
  const corpus = buildSessionSearchCorpus(sessionObj);

  // Check if EVERY token is found in the corpus (allows "tournament missed" to match)
  return tokens.every(token => corpus.includes(token));
}

function openLocationOverlay(context) {
  activeLocationContext = context;
  const container = document.getElementById('locationOptionsContainer');
  const uniqueLocations = [...new Set(db.sessions.map(s => s.location?.label).filter(Boolean))].sort();
  const activeLocSet = activeLocationFilters[context];
  
  let html = `<button class="sort-option ${activeLocSet.size === 0 ? 'active' : ''}" onclick="setLocationFilter('all')"><span>All Locations</span><span class="so-check">✓</span></button>`;
  uniqueLocations.forEach(loc => {
    html += `<button class="sort-option ${activeLocSet.has(loc) ? 'active' : ''}" onclick="setLocationFilter('${loc.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"><span>${loc}</span><span class="so-check">✓</span></button>`;
  });
  
  if (uniqueLocations.length === 0) {
    html += `<div style="padding: 12px 14px; color: var(--muted); font-size: 14px;">No locations saved yet.</div>`;
  }
  
  container.innerHTML = html;
  document.getElementById('locationOverlay').classList.add('open');
}

function setLocationFilter(locLabel) {
  const activeLocSet = activeLocationFilters[activeLocationContext];
  if (locLabel === 'all') {
    activeLocSet.clear();
  } else {
    if (activeLocSet.has(locLabel)) {
      activeLocSet.delete(locLabel);
    } else {
      activeLocSet.add(locLabel);
    }
  }
  
  const btn = document.getElementById(`${activeLocationContext}LocationBtn`);
  if (btn) btn.classList.toggle('active', activeLocSet.size > 0);
  
  // Update overlay UI to show multiple checks without closing it
  openLocationOverlay(activeLocationContext);
  
  if (activeLocationContext === 'home') renderHome();
  else if (activeLocationContext === 'diag') renderDiag();
}

function openArcherFilterOverlay(context) {
  activeArcherFilterContext = context;
  const container = document.getElementById('archerOptionsContainer');
  const uniqueArchers = [...new Set(db.sessions.map(s => normalizePersonName(s.archerName)).filter(Boolean))].sort();
  db.deviceProfile.archers.forEach(a => { if(a && !uniqueArchers.includes(a)) uniqueArchers.push(a); });

  const activeSet = activeArcherFilters[context];
  let html = `<button class="sort-option ${activeSet.size === 0 ? 'active' : ''}" onclick="setArcherFilter('all')"><span>All Archers</span><span class="so-check">✓</span></button>`;
  uniqueArchers.forEach(arch => {
    const archLiteral = JSON.stringify(arch);
    html += `<button class="sort-option ${activeSet.has(arch) ? 'active' : ''}" onclick="setArcherFilter(${archLiteral})"><span>${arch}</span><span class="so-check">✓</span></button>`;
  });
  
  if (uniqueArchers.length === 0) {
    html += `<div style="padding: 12px 14px; color: var(--muted); font-size: 14px;">No archers saved yet.</div>`;
  }

  container.innerHTML = html;
  document.getElementById('archerFilterOverlay').classList.add('open');
}

function setArcherFilter(archLabel) {
  const activeSet = activeArcherFilters[activeArcherFilterContext];
  if (archLabel === 'all') {
    activeSet.clear();
  } else {
    if (activeSet.has(archLabel)) activeSet.delete(archLabel);
    else activeSet.add(archLabel);
  }
  
  const btn = document.getElementById(`${activeArcherFilterContext}ArcherBtn`);
  if (btn) btn.classList.toggle('active', activeSet.size > 0);
  
  openArcherFilterOverlay(activeArcherFilterContext);
  
  if (activeArcherFilterContext === 'home') renderHome();
  else if (activeArcherFilterContext === 'diag') renderDiag();
}

function openDateFilterOverlay(context) {
  activeDateFilterContext = context;
  const dateFilter = activeDateFilters[context];
  
  document.getElementById('dateFilterStart').value = dateFilter.start || '';
  document.getElementById('dateFilterEnd').value = dateFilter.end || '';
  
  document.getElementById('dateFilterOverlay').classList.add('open');
}

function applyDateFilter() {
  const startVal = document.getElementById('dateFilterStart').value;
  const endVal = document.getElementById('dateFilterEnd').value;
  
  activeDateFilters[activeDateFilterContext] = {
    start: startVal || null,
    end: endVal || null
  };
  
  const btn = document.getElementById(`${activeDateFilterContext}DateBtn`);
  if (btn) btn.classList.toggle('active', !!(startVal || endVal));
  
  closeOverlay('dateFilterOverlay');
  
  if (activeDateFilterContext === 'home') renderHome();
  else if (activeDateFilterContext === 'diag') renderDiag();
}

function clearDateFilter() {
  activeDateFilters[activeDateFilterContext] = { start: null, end: null };
  
  const btn = document.getElementById(`${activeDateFilterContext}DateBtn`);
  if (btn) btn.classList.remove('active');
  
  closeOverlay('dateFilterOverlay');
  
  if (activeDateFilterContext === 'home') renderHome();
  else if (activeDateFilterContext === 'diag') renderDiag();
}

