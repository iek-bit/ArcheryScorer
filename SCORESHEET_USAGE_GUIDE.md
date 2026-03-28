# Scoresheet Scan - Quick Start Guide

## For Archers

### Taking a Good Photo

For best results when scanning your scorecard:

1. **Lighting**: Use good, even lighting. Avoid shadows across the scorecard.

2. **Angle**: Hold your phone directly above the scorecard (not at an angle).

3. **Distance**: Get close enough that the scorecard fills most of the frame, but keep all edges visible.

4. **Flatness**: Lay the scorecard flat. Avoid wrinkles or folds.

5. **Focus**: Make sure the image is in focus and not blurry.

6. **Pencil Marks**: Don't worry about perfect coloring! The app handles:
   - Light or dark pencil marks
   - Partial fills (you don't need to fill the entire circle)
   - Marks that go slightly outside the bubble
   - Different shading intensities

### Step-by-Step Instructions

1. **Start Tournament**
   - Open the app
   - Tap "Bullseye Tournament" or "3D Tournament"

2. **Choose Upload Method**
   - **Take Photo**: Opens camera to photograph scorecard
   - **Upload from Gallery**: Select existing photo from your device
   - **Score Manually**: Traditional tap-to-score interface

3. **Wait for Processing**
   - The app will analyze the image (takes 2-5 seconds)
   - You'll see a "Processing Scoresheet" message

4. **Review Scores**
   - The preview shows your cropped scorecard with detection overlay:
     - **Yellow circles** highlight detected marks with the score number
     - **Blue lines** show End boundaries (6 sections)
     - **Green lines** show row divisions (5 rows per End)
   - Check each End's scores in the list below
   - If any score is wrong, tap it to edit
   - The total score updates automatically

5. **Confirm**
   - Once everything looks correct, tap "CONFIRM SCORES"
   - Your tournament is now loaded with all 6 rounds!

### Understanding the Detection Overlay

The preview image shows exactly what the app detected:

```
┌─────────────────────────────┐
│ Blue Line ← End #1 starts  │
│   ●7  ●8  ●9  ●10 ●9       │ ← Yellow circles = detected
│   Green lines = rows        │
│ Blue Line ← End #2 starts  │
│   ●6  ●7  ●8  ●9  ●10      │
└─────────────────────────────┘
```

If you see:
- **Yellow circle on wrong bubble**: Tap the score in the list to edit
- **Missing yellow circle**: The mark might be too light - edit manually
- **Extra yellow circles**: The app uses the lowest score automatically

### Troubleshooting

**"Failed to process scoresheet"**
- Try taking a clearer photo with better lighting
- Make sure the entire scorecard is visible
- Use the manual scoring option instead

**Scores detected incorrectly**
- Check the yellow circles on the preview - they show what was detected
- Tap any incorrect score to edit it manually
- Common issues: very light pencil marks, smudges, or unclear bubbles
- Always review before confirming!

**No yellow circles showing**
- Your pencil marks might be too light
- Try retaking with better lighting
- Or manually enter the scores

**Wrong bubbles highlighted**
- Smudges or stray marks can be detected
- The app automatically uses the lowest score if multiple bubbles are marked
- Edit any incorrect scores before confirming

## For Developers

### Enhanced Detection Algorithm

The new algorithm handles real-world pencil marks by:

1. **Adaptive Thresholding**: Compares each bubble to its surrounding background
2. **Multi-Zone Sampling**: Checks both center and ring areas of each bubble
3. **Contrast Analysis**: Measures relative darkness vs. background
4. **Partial Fill Detection**: Detects marks that don't fill the entire circle

### Detection Parameters

```javascript
// A bubble is considered filled if:
centerFillRatio > 0.25 ||  // Center is 25% darker than background
(ringFillRatio > 0.20 && contrastRatio > 0.15) ||  // Ring is 20% dark + 15% contrast
(centerFillRatio > 0.15 && ringFillRatio > 0.15)   // Both areas moderately dark
```

### Testing the Feature

1. Open `test-scoresheet.html` in a browser
2. Upload a scorecard image
3. Click "Process Image"
4. Review the detection overlay showing:
   - Yellow circles on detected marks
   - Blue lines for End boundaries
   - Green lines for row divisions
5. Check the detailed scores and JSON output

### Adjusting Detection Sensitivity

In `index.html`, look for these parameters in `detectBubbleScores`:

**Make more sensitive (detect lighter marks):**
```javascript
centerFillRatio > 0.20 ||  // was 0.25
(ringFillRatio > 0.15 && contrastRatio > 0.12)  // was 0.20 and 0.15
```

**Make less sensitive (reduce false positives):**
```javascript
centerFillRatio > 0.30 ||  // was 0.25
(ringFillRatio > 0.25 && contrastRatio > 0.20)  // was 0.20 and 0.15
```

**Adjust background sampling:**
```javascript
const bgRadius = sampleRadius * 2.0;  // was 1.8 (sample farther from bubble)
const isDark = brightness < (bgBrightness - 40);  // was 30 (require more contrast)
```

## Known Limitations

- Only works for NASP official scorecards
- Requires clear, well-lit photos
- Very light pencil marks may not be detected
- Cannot detect archer name (must be entered manually)
- Best results with flat, unfolded scorecards

## Future Improvements

- [ ] Support for different scorecard formats
- [ ] OCR for archer name extraction
- [ ] Machine learning for improved detection
- [ ] Real-time camera preview with alignment guides
- [ ] Batch processing for multiple scorecards
- [ ] Support for 3D tournament scorecards
- [ ] Confidence scores for each detection
