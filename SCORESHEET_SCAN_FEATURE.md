# Scoresheet Scan Feature

## Overview
The scoresheet scan feature allows archers to quickly import tournament scores by uploading or photographing their official NASP scorecard instead of manually entering each arrow.

## How It Works

### For Users

1. **Start a Tournament Session**
   - Select "Bullseye Tournament" or "3D Tournament" from the home screen
   - A modal will appear asking you to choose your scoring method

2. **Choose Scoring Method**
   - **Score Manually**: Traditional tap-to-score interface
   - **Upload Scoresheet**: Select an image file from your device
   - **Take Photo** (mobile only): Use your camera to photograph the scorecard

3. **Review Detected Scores**
   - The app will process the image and detect filled bubbles
   - A preview shows all detected scores organized by End and Arrow
   - Tap any score to edit it if the detection was incorrect
   - The total score is calculated automatically

4. **Confirm and Continue**
   - Once you've verified all scores are correct, tap "CONFIRM SCORES"
   - All 6 rounds are imported into your session
   - You can continue scoring additional rounds manually if needed

### Technical Details

#### Image Processing Pipeline

1. **Cropping**: Uses the black registration marks on the left edge to detect and crop the scorecard to standard dimensions

2. **End Detection**: Identifies the blue vertical bars that mark each of the 6 Ends

3. **Bubble Detection**: 
   - Scans each row (5 rows per End)
   - Checks each bubble position (0-10) for darkness
   - A bubble is considered "filled" if >30% of its area is darker than the background
   - If multiple bubbles are detected in one row, the lower score is used (per tournament rules)

4. **Score Conversion**: Detected scores are converted to arrow coordinates for visualization in the app

#### Supported Scorecards

- NASP Official Score Cards
- 6 Ends × 5 Arrows per End = 30 total arrows
- Bubbles numbered 0-10 per row
- For Bullseye tournaments: First 3 Ends = 10m, Last 3 Ends = 15m

## Browser Compatibility

- **Desktop**: File upload via file picker
- **Mobile**: Camera capture or file upload
- Requires modern browser with Canvas API support
- Works offline (no server processing required)

## Limitations

- Only works for tournament sessions (not practice)
- Requires clear, well-lit photos
- Best results with flat, unfolded scorecards
- Manual review recommended to catch detection errors

## Future Enhancements

- OCR for archer name extraction
- Support for different scorecard formats
- Improved bubble detection algorithm
- Batch processing of multiple scorecards
