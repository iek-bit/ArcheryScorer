# Scoresheet Scan - Quick Reference

## User Flow

```
START TOURNAMENT
       ↓
┌──────────────────┐
│ Choose Method:   │
│ • Manual Score   │
│ • Upload Photo   │
│ • Take Photo     │
└──────────────────┘
       ↓
┌──────────────────┐
│ Processing...    │
│ (2-5 seconds)    │
└──────────────────┘
       ↓
┌──────────────────┐
│ Review Scores    │
│ Tap to edit      │
│ Total: 285       │
└──────────────────┘
       ↓
   CONFIRM
       ↓
  6 Rounds Loaded!
```

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main app with scan feature |
| `test-scoresheet.html` | Standalone testing tool |
| `SCORESHEET_SCAN_FEATURE.md` | Technical documentation |
| `SCORESHEET_USAGE_GUIDE.md` | User instructions |
| `IMPLEMENTATION_SUMMARY.md` | Developer reference |

## Detection Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `fillRatio` | 0.3 | Bubble darkness threshold (30%) |
| `darkThreshold` | 80 | Registration mark detection |
| `leftScanWidth` | 15% | Left edge scan area |
| `bubbleStartX` | 25% | Bubble grid start position |
| `bubbleEndX` | 95% | Bubble grid end position |

## Scorecard Layout

```
┌─────────────────────────────────┐
│ NASP Official Score Card        │
├─┬───────────────────────────────┤
│█│ End #1 (10m)                  │
│█│ ○○○○○○○○○○○  (5 rows)        │
├─┼───────────────────────────────┤
│█│ End #2 (10m)                  │
│█│ ○○○○○○○○○○○  (5 rows)        │
├─┼───────────────────────────────┤
│█│ End #3 (10m)                  │
│█│ ○○○○○○○○○○○  (5 rows)        │
├─┼───────────────────────────────┤
│█│ End #4 (15m)                  │
│█│ ○○○○○○○○○○○  (5 rows)        │
├─┼───────────────────────────────┤
│█│ End #5 (15m)                  │
│█│ ○○○○○○○○○○○  (5 rows)        │
├─┼───────────────────────────────┤
│█│ End #6 (15m)                  │
│█│ ○○○○○○○○○○○  (5 rows)        │
└─┴───────────────────────────────┘
  ↑ Registration marks (black)
    Blue bars mark each End
```

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Scores not detected | Increase lighting, retake photo |
| Wrong scores detected | Tap score to edit manually |
| Cropping incorrect | Ensure all edges visible in photo |
| Camera not working | Check browser permissions |
| Processing failed | Use manual scoring instead |

## Testing Checklist

- [ ] Upload clear scorecard photo
- [ ] Verify cropping is accurate
- [ ] Check all 30 scores detected
- [ ] Edit a score manually
- [ ] Confirm total is correct
- [ ] Verify rounds loaded in session
- [ ] Test on mobile device
- [ ] Test camera capture
- [ ] Test file upload

## Code Locations

### Main Functions
- Line ~3147: `startSession()` - Entry point
- Line ~3170: `showScoresheetChoice()` - Modal display
- Line ~3200: `processScoresheetImage()` - Image processing
- Line ~3230: `detectAndCropScorecard()` - Cropping logic
- Line ~3310: `detectBubbleScores()` - Score detection
- Line ~3420: `confirmScoresheetScores()` - Save to session

### UI Elements
- Line ~2200: Scoresheet choice modal HTML
- Line ~2220: Processing overlay HTML
- Line ~2240: Preview/edit overlay HTML
- Line ~850: Scoresheet CSS styles

## Browser DevTools Tips

### Check Image Processing
```javascript
// In browser console after upload:
console.log(window.scoresheetDetectedScores);
// Should show: [[5,7,8,9,10], [6,7,8,9,10], ...]
```

### Debug Cropping
```javascript
// Add to detectAndCropScorecard():
console.log('Crop bounds:', {leftEdge, rightEdge, topEdge, bottomEdge});
```

### Monitor Performance
```javascript
// Add to processScoresheetImage():
console.time('processing');
// ... processing code ...
console.timeEnd('processing');
```

## Quick Adjustments

### Make Detection More Sensitive
```javascript
// Line ~3390 in detectBubbleScores()
if (fillRatio > 0.2) { // was 0.3
```

### Make Detection Less Sensitive
```javascript
// Line ~3390 in detectBubbleScores()
if (fillRatio > 0.4) { // was 0.3
```

### Adjust Bubble Grid Position
```javascript
// Line ~3360 in detectBubbleScores()
const bubbleStartX = Math.floor(canvas.width * 0.20); // was 0.25
const bubbleEndX = Math.floor(canvas.width * 0.98); // was 0.95
```

## Support Contacts

- Technical issues: Check browser console
- Feature requests: Document in GitHub issues
- User questions: Refer to SCORESHEET_USAGE_GUIDE.md
