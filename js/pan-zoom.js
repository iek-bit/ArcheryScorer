// ═══════════════════════════════════════════════
//  PAN/ZOOM UTILITIES
// ═══════════════════════════════════════════════
function attachPanZoom(containerId, wrapId, options = {}) {
  const constrainHorizontal = options.constrainHorizontal || false;
  const container = document.getElementById(containerId);
  const wrap = document.getElementById(wrapId);
  let scale = 1, tx = 0, ty = 0;
  let initialScale = 1;
  let initialPinchDist = null;
  let lastPinchCenter = null;
  let lastTouch = null;

  function updateTransform() {
    if (options.onUpdate) {
      options.onUpdate();
    } else {
      wrap.style.transform = `translate(${tx}px, ${ty}px) scale(${scale}${constrainHorizontal ? ', 1' : ''})`;
    }
  }

  container.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      initialScale = scale;
      lastPinchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - container.getBoundingClientRect().left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - container.getBoundingClientRect().top
      };
    } else if (e.touches.length === 1) {
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, {passive: true});

  container.addEventListener('touchmove', e => {
    e.preventDefault(); // Prevent scroll while pinching/panning
    if (e.touches.length === 2) {
      const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const currentCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - container.getBoundingClientRect().left,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - container.getBoundingClientRect().top
      };

      if (initialPinchDist) {
        const newScale = Math.max(1, Math.min(10, initialScale * (currentDist / initialPinchDist)));
        const scaleRatio = newScale / scale;

        tx = currentCenter.x - (lastPinchCenter.x - tx) * scaleRatio;
        if (!constrainHorizontal) {
          ty = currentCenter.y - (lastPinchCenter.y - ty) * scaleRatio;
        }

        scale = newScale;
        lastPinchCenter = currentCenter;
      }
    } else if (e.touches.length === 1 && scale > 1) {
      const currentTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (lastTouch) {
        tx += (currentTouch.x - lastTouch.x);
        if (!constrainHorizontal) ty += (currentTouch.y - lastTouch.y);
      }
      lastTouch = currentTouch;
    }

    // Boundaries
    const maxTx = 0;
    const minTx = -container.clientWidth * (scale - 1);
    tx = Math.max(minTx, Math.min(maxTx, tx));

    if (!constrainHorizontal) {
      const maxTy = 0;
      const minTy = -container.clientHeight * (scale - 1);
      ty = Math.max(minTy, Math.min(maxTy, ty));
    } else {
      ty = 0;
    }

    updateTransform();
  }, {passive: false});

  container.addEventListener('touchend', e => {
    if (e.touches.length === 1) {
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPinchDist = null;
    } else if (e.touches.length === 0) {
      lastTouch = null;
      initialPinchDist = null;
    }
  });

  return {
    getTransform: () => ({scale, tx, ty, rect: container.getBoundingClientRect()}),
    reset: () => { scale = 1; tx = 0; ty = 0; updateTransform(); }
  };
}

window.timelinePanZoom = attachPanZoom('timelineContainer', 'timelineTransformWrap', {
  constrainHorizontal: true,
  onUpdate: () => {
    if (window.currentTimelineRounds) drawTimeline(window.currentTimelineRounds);
  }
});
window.heatmapPanZoom = attachPanZoom('heatmapContainer', 'heatmapTransformWrap', {
  constrainHorizontal: false
});

// Redraw timeline at correct width when the tile becomes visible (page-diag activates)
if (window.ResizeObserver) {
  let _tlRafPending = false;
  new ResizeObserver(entries => {
    const w = entries[0]?.contentRect?.width || 0;
    if (w > 0 && !_tlRafPending) {
      _tlRafPending = true;
      requestAnimationFrame(() => {
        _tlRafPending = false;
        if (window.currentTimelineRounds) drawTimeline(window.currentTimelineRounds);
      });
    }
  }).observe(document.getElementById('timelineContainer'));
}

