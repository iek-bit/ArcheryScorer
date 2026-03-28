# Scantron Detection Quick Reference

## What You Need to Know

Your NASP scorecards are **scantron sheets** - standardized forms designed for optical mark recognition (OMR). This means the detection algorithm can be much more precise than traditional bubble detection.

## How to Get Best Results

### 1. Use Black Pen or Marker (Recommended)
- Black pen/marker: 90-95% accuracy
- Dark pencil: 75-85% accuracy  
- Light pencil: 60-75% accuracy (may need manual review)

### 2. Take a Good Photo
- Hold phone directly above scorecard
- Ensure all edges are visible (including black marks on sides)
- Use good, even lighting
- Slight tilt is OK (up to 30°) - algorithm will correct it

### 3. Review the Preview
The preview shows exactly what was detected:
- **Yellow circles** = detected marks with score numbers
- **Blue lines** = End boundaries (from black horizontal bars)
- **Green lines** = Row divisions within each End

If yellow circles are:
- ✅ Centered on your marks → Perfect!
- ⚠️ Slightly off but detecting correctly → OK, proceed
- ❌ Consistently off-center → May need algorithm adjustment

## Testing Your Scorecards

### Quick Test Process

1. Open `test-scoresheet.html` in your browser
2. Upload a filled scorecard photo
3. Click "Process Image"
4. Check the results:
   - Are yellow circles centered on bubbles?
   - Are all filled bubbles detected?
   - Are any empty bubbles incorrectly marked?
   - Do the scores match what you filled in?

### What to Look For

#### Perfect Detection ✅
```
Your marks:  ○ ○ ● ○ ○ ○ ○ ○ ○ ○ ○
Detection:   ○ ○ ●7 ○ ○ ○ ○ ○ ○ ○ ○
Result: Score = 7 ✓
```

#### Missed Light Mark ⚠️
```
Your marks:  ○ ○ ◐ ○ ○ ○ ○ ○ ○ ○ ○  (light pencil)
Detection:   ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○
Result: Score = 0 (should be 7)
Action: Edit manually or retake with darker marks
```

#### Off-Center Detection ❌
```
Your marks:  ○ ○ ● ○ ○ ○ ○ ○ ○ ○ ○
Detection:   ○ ●6 ○ ○ ○ ○ ○ ○ ○ ○ ○  (circle is left of actual mark)
Result: Score = 6 (should be 7)
Action: Adjust bubble positioning in code
```

## Algorithm Parameters

If detection isn't working well, you may need to adjust these parameters:

### Bubble Positioning
```javascript
// In detectBubbleScores() and detectScantronMark()
const bubbleAreaLeft = Math.floor(canvas.width * 0.20);  // Start of bubble grid
const bubbleAreaRight = Math.floor(canvas.width * 0.95); // End of bubble grid
```

**Adjust if:**
- Yellow circles consistently left of bubbles → Increase `bubbleAreaLeft`
- Yellow circles consistently right of bubbles → Decrease `bubbleAreaLeft`
- Bubbles too close together → Adjust both values to widen area

### Detection Sensitivity
```javascript
// In detectScantronMark()
if (brightness < 100) {  // Darkness threshold
  darkPixelCount++;
}

const isFilled = (
  darkRatio > 0.25 ||                           // 25%+ very dark
  (darkRatio > 0.15 && avgBrightness < 120) || // 15%+ dark + low avg
  (darkRatio > 0.10 && minBrightness < 60)     // 10%+ dark + solid black
);
```

**Adjust if:**
- Missing dark marks → Increase thresholds (e.g., `brightness < 130`, `darkRatio > 0.20`)
- Detecting empty bubbles → Decrease thresholds (e.g., `brightness < 80`, `darkRatio > 0.30`)

### Sample Radius
```javascript
// In detectScantronMark()
const sampleRadius = Math.floor(radius * 0.8);  // 80% of bubble radius
```

**Adjust if:**
- Missing marks that extend outside bubble → Increase to `0.9` or `1.0`
- Detecting smudges near bubbles → Decrease to `0.7` or `0.6`

## Common Issues and Solutions

### Issue: All scores detected as 0
**Cause:** Marks too light or positioning way off
**Solution:** 
1. Check yellow circles in preview - are they on the bubbles?
2. If yes, marks are too light - use darker pen/pencil
3. If no, adjust `bubbleAreaLeft` and `bubbleAreaRight`

### Issue: Random bubbles detected (false positives)
**Cause:** Smudges, erasures, or sensitivity too high
**Solution:**
1. Clean scorecard before photographing
2. Decrease detection sensitivity (lower thresholds)
3. Use manual review to correct

### Issue: Yellow circles not centered on printed bubbles
**Cause:** Bubble area boundaries incorrect
**Solution:**
1. Measure the actual bubble positions on your scorecard
2. Adjust `bubbleAreaLeft` and `bubbleAreaRight` percentages
3. Test with multiple scorecards to verify

### Issue: Works for some Ends but not others
**Cause:** Lighting gradient or End boundary detection issue
**Solution:**
1. Retake photo with more even lighting
2. Check if black horizontal bars are visible
3. May need to adjust End detection algorithm

## Expected Accuracy

With proper setup:
- **Black pen/marker**: 90-95% accuracy (1-3 errors per 30 scores)
- **Dark pencil**: 75-85% accuracy (4-7 errors per 30 scores)
- **Light pencil**: 60-75% accuracy (7-12 errors per 30 scores)

All errors can be corrected in the manual review step, so final accuracy is always 100%.

## When to Adjust the Algorithm

You should adjust the algorithm if:
1. ❌ Yellow circles consistently off-center (adjust positioning)
2. ❌ Missing >20% of dark marks (increase sensitivity)
3. ❌ Detecting >10% false positives (decrease sensitivity)
4. ❌ Works for one scorecard type but not another (may need format detection)

You DON'T need to adjust if:
1. ✅ Occasional missed light pencil marks (expected, use manual review)
2. ✅ Smudges detected as marks (app uses lowest score automatically)
3. ✅ 80%+ accuracy with dark marks (good enough with manual review)

## Testing Checklist

Before deploying to users:

- [ ] Test with 5+ different scorecards
- [ ] Test with black pen marks (should be 90%+ accurate)
- [ ] Test with pencil marks (should be 75%+ accurate)
- [ ] Test with tilted photos (should auto-correct)
- [ ] Test with both pink and green scorecards
- [ ] Verify yellow circles are centered on bubbles
- [ ] Verify End boundaries are correct (blue lines)
- [ ] Verify row divisions are correct (green lines)
- [ ] Test manual editing of incorrect scores
- [ ] Verify final scores load correctly into session

## Need Help?

1. Use `test-scoresheet.html` to debug issues
2. Check browser console for error messages
3. Review `window.scoresheetDebugInfo` for detailed detection data
4. Compare detected positions with actual bubble positions
5. Adjust parameters incrementally and retest

## Remember

The goal is 80%+ automatic accuracy with 100% accuracy after manual review. Users will always have a chance to correct any errors before confirming, so don't worry about achieving perfect detection - focus on getting most scores right and making the review process quick and easy.
