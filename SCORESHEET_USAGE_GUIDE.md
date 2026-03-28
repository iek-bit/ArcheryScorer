# Scoresheet Scan - Quick Start Guide

## For Archers

### Taking a Good Photo

For best results when scanning your scorecard:

1. **Lighting**: Use good, even lighting. Avoid shadows across the scorecard.

2. **Angle**: Hold your phone directly above the scorecard (not at an angle).

3. **Distance**: Get close enough that the scorecard fills most of the frame, but keep all edges visible.

4. **Flatness**: Lay the scorecard flat. Avoid wrinkles or folds.

5. **Focus**: Make sure the image is in focus and not blurry.

### Step-by-Step Instructions

1. **Start Tournament**
   - Open the app
   - Tap "Bullseye Tournament" or "3D Tournament"

2. **Choose Upload Method**
   - Tap "Take Photo" (mobile) or "Upload Scoresheet" (desktop)
   - On mobile: Your camera will open - take a photo of your scorecard
   - On desktop: Select the scorecard image file

3. **Wait for Processing**
   - The app will analyze the image (takes 2-5 seconds)
   - You'll see a "Processing Scoresheet" message

4. **Review Scores**
   - Check each End's scores
   - If any score is wrong, tap it to edit
   - The total score updates automatically

5. **Confirm**
   - Once everything looks correct, tap "CONFIRM SCORES"
   - Your tournament is now loaded with all 6 rounds!

### Troubleshooting

**"Failed to process scoresheet"**
- Try taking a clearer photo with better lighting
- Make sure the entire scorecard is visible
- Use the manual scoring option instead

**Scores detected incorrectly**
- Tap any incorrect score to edit it manually
- Common issues: light pencil marks, smudges, or unclear bubbles
- Always review before confirming!

**Camera button not showing**
- The camera option only appears on mobile devices
- On desktop, use "Upload Scoresheet" instead

## For Developers

### Testing the Feature

1. Open `test-scoresheet.html` in a browser
2. Upload a scorecard image
3. Click "Process Image"
4. Review the detected scores and cropped image

### Adjusting Detection Parameters

In `index.html`, look for these key parameters in the `detectBubbleScores` function:

```javascript
// Bubble detection threshold (0.3 = 30% of bubble must be dark)
const fillRatio = darkPixels / totalPixels;
if (fillRatio > 0.3) {
  filledBubbles.push(bubbleIdx);
}
```

Adjust `0.3` higher (e.g., `0.4`) if too many false positives, or lower (e.g., `0.2`) if missing filled bubbles.

### Cropping Parameters

```javascript
// Dark threshold for registration marks
const darkThreshold = 80; // RGB values below this are "dark"

// Scan width for left edge detection
const leftScanWidth = Math.floor(canvas.width * 0.15); // Left 15% of image
```

Adjust these if the cropping isn't working correctly for your scorecard format.

## Known Limitations

- Only works for NASP official scorecards
- Requires clear, well-lit photos
- May struggle with very light pencil marks
- Cannot detect archer name (must be entered manually)
- Best results with flat, unfolded scorecards

## Future Improvements

- [ ] Support for different scorecard formats
- [ ] OCR for archer name extraction
- [ ] Improved bubble detection algorithm
- [ ] Real-time camera preview with alignment guides
- [ ] Batch processing for multiple scorecards
- [ ] Support for 3D tournament scorecards
