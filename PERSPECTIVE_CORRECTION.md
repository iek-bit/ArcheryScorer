# Perspective Correction & Multi-Format Support

## Overview

The scoresheet scanner now includes:
1. **Automatic perspective correction** for tilted/angled photos
2. **Multi-format support** for both pink/red and green scorecards
3. **Adaptive color detection** for End markers

## Perspective Correction

### What It Does

When you take a photo at an angle (tilted down, to the side, or rotated), the scorecard appears distorted. Perspective correction automatically straightens the image before processing.

### How It Works

```
Original Photo (Tilted):        After Correction:
┌────────────────┐             ┌──────────────┐
│  ╱────────╲    │             │ ┌──────────┐ │
│ ╱  NASP   ╲   │    ───→     │ │   NASP   │ │
│╱  Scorecard╲  │             │ │ Scorecard│ │
│╲           ╱  │             │ │          │ │
│ ╲─────────╱   │             │ └──────────┘ │
└────────────────┘             └──────────────┘
```

### Algorithm Steps

1. **Corner Detection**
   - Finds black registration marks on left edge
   - Identifies top-left and bottom-left corners
   - Scans for right edge content boundary
   - Calculates all four corners

2. **Perspective Transform**
   - Uses bilinear interpolation
   - Maps each output pixel to source image
   - Handles rotation, tilt, and skew
   - Preserves image quality

3. **Output**
   - Straightened, rectangular scorecard
   - Ready for bubble detection
   - No distortion artifacts

### Supported Angles

- ✅ Tilted down (looking from above)
- ✅ Tilted to the side (left or right)
- ✅ Slight rotation (up to ~30°)
- ✅ Combined tilt + rotation
- ⚠️ Extreme angles (>45°) may not work well

### Example Transformations

#### Tilted Down
```
Before:                After:
  ┌─────┐             ┌─────┐
 ╱       ╲            │     │
╱  Card   ╲    →      │Card │
╲         ╱            │     │
 ╲───────╱             └─────┘
```

#### Tilted Sideways
```
Before:                After:
┌╲                     ┌─────┐
│ ╲                    │     │
│  ╲ Card       →      │Card │
│  ╱                   │     │
│ ╱                    └─────┘
└╱
```

#### Rotated
```
Before:                After:
    ╱─────╲            ┌─────┐
   ╱  Card ╲           │     │
  ╱         ╲    →     │Card │
 ╱           ╲         │     │
╱─────────────╲        └─────┘
```

## Multi-Format Support

### Scorecard Types

The scanner now automatically detects and handles two scorecard formats:

#### Type 1: Pink/Red Scorecard
- Pink/red colored End markers
- Pink/red vertical bars on left
- Most common format
- RGB detection: R > 150, R > G+30, R > B+30

#### Type 2: Green Scorecard
- Green colored End markers
- Green vertical bars on left
- Alternative format
- RGB detection: G > 150, G > R+30, G > B+30

### Automatic Detection

The scanner samples the left side of the scorecard and counts red vs. green pixels:

```javascript
// Sample left 15% of image, top 30%
for each pixel:
  if (red > 150 && red > green+30 && red > blue+30):
    redCount++
  if (green > 150 && green > red+30 && green > blue+30):
    greenCount++

scorecardType = greenCount > redCount ? 'green' : 'red'
```

### Color Thresholds

#### Red/Pink Scorecard
```javascript
colorThreshold = {
  r: [150, 255],  // Red channel: 150-255
  g: [50, 200],   // Green channel: 50-200
  b: [100, 220]   // Blue channel: 100-220
}
```

#### Green Scorecard
```javascript
colorThreshold = {
  r: [50, 180],   // Red channel: 50-180
  g: [120, 255],  // Green channel: 120-255
  b: [50, 180]    // Blue channel: 50-180
}
```

### Visual Feedback

During processing, you'll see:
```
Processing Scoresheet
Detected Pink/Red scorecard. Reading scores...
```
or
```
Processing Scoresheet
Detected Green scorecard. Reading scores...
```

## Combined Processing Pipeline

```
1. Load Image
   ↓
2. Detect Corners (registration marks)
   ↓
3. Apply Perspective Correction (if needed)
   ↓
4. Detect Scorecard Type (red vs green)
   ↓
5. Crop to Boundaries
   ↓
6. Detect Colored End Markers
   ↓
7. Detect Filled Bubbles
   ↓
8. Show Preview with Overlay
```

## Performance Impact

### Perspective Correction
- Processing time: +1-2 seconds
- Only applied if corners detected
- Skipped if image is already straight
- Memory: +2-4 MB during processing

### Color Detection
- Processing time: +0.1 seconds
- Minimal overhead
- Samples only 4.5% of image (15% × 30%)

### Total Impact
- Straight photo: ~2-5 seconds (no change)
- Tilted photo: ~3-7 seconds (+1-2 seconds)
- Still acceptable for mobile devices

## Limitations

### Perspective Correction
- Requires visible registration marks
- Works best with angles < 45°
- May struggle with extreme distortion
- Cannot fix motion blur or out-of-focus images

### Color Detection
- Requires sufficient colored area visible
- May misdetect if lighting is very poor
- Assumes standard NASP scorecard colors
- Cannot detect custom/modified scorecards

## Troubleshooting

### Perspective Correction Not Working

**Symptom**: Image still looks tilted after processing

**Possible Causes**:
- Registration marks not visible
- Extreme angle (>45°)
- Poor lighting obscuring marks

**Solutions**:
- Retake photo from more direct angle
- Ensure left edge registration marks are visible
- Improve lighting

### Wrong Scorecard Type Detected

**Symptom**: Says "Green" but you have pink/red (or vice versa)

**Possible Causes**:
- Poor lighting affecting color detection
- Unusual lighting (colored lights)
- Faded/old scorecard

**Solutions**:
- Retake with better white lighting
- Ensure colored bars are visible
- Manual correction not needed (detection is for optimization only)

### Distorted Output

**Symptom**: Scorecard looks warped or stretched

**Possible Causes**:
- Corners detected incorrectly
- Extreme perspective angle
- Wrinkled or folded scorecard

**Solutions**:
- Flatten scorecard completely
- Take photo from more direct angle
- Ensure all four corners are visible

## Testing

### Test Cases

1. **Straight Photo**
   - Should skip perspective correction
   - Fast processing
   - No distortion

2. **Tilted Down 20°**
   - Should apply correction
   - Output should be rectangular
   - Bubbles should be circular

3. **Tilted Sideways 15°**
   - Should apply correction
   - Vertical lines should be straight
   - Text should be readable

4. **Pink Scorecard**
   - Should detect as "red" type
   - Red/pink bars should be found
   - All Ends detected correctly

5. **Green Scorecard**
   - Should detect as "green" type
   - Green bars should be found
   - All Ends detected correctly

### Manual Testing

Use `test-scoresheet.html`:
1. Upload tilted photo
2. Check "Cropped Scorecard" section
3. Verify image is straightened
4. Check console for scorecard type
5. Verify all 6 Ends detected

## Future Enhancements

### Short Term
- Show perspective correction visualization
- Display detected corners on preview
- Add confidence score for correction

### Medium Term
- Support more extreme angles (up to 60°)
- Automatic rotation detection
- Handle partially visible scorecards

### Long Term
- Machine learning for corner detection
- Support for damaged/torn scorecards
- Real-time preview with correction overlay
- Automatic photo quality assessment
