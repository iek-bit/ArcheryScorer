# Quick Test Guide

## 5-Minute Test

Want to quickly test if the scantron detection is working? Follow these steps:

### Step 1: Open Test Page (30 seconds)
```bash
# Open test-scoresheet.html in your browser
open test-scoresheet.html
```

### Step 2: Upload Photo (30 seconds)
- Click "Choose File"
- Select a filled scorecard photo
- Click "Process Image"

### Step 3: Check Positioning (1 minute)
Look at the preview image:
- ✅ Are yellow circles centered on filled bubbles?
- ✅ Are blue lines at End boundaries?
- ✅ Are there 6 Ends with 5 rows each?

**If YES:** Positioning is good! Continue to Step 4.
**If NO:** See [Positioning Issues](#positioning-issues) below.

### Step 4: Check Detection (2 minutes)
Count the scores:
- How many bubbles did you fill? ___
- How many yellow circles do you see? ___
- How many are correct? ___

Calculate accuracy: (correct / total) × 100 = ___%

**Target Accuracy:**
- Black pen: 90%+ ✅
- Dark pencil: 75%+ ✅
- Light pencil: 60%+ ⚠️

### Step 5: Verify Scores (1 minute)
Check the "Detected Scores" section:
- Do the numbers match your marks?
- Is the total score correct?
- Are there any obvious errors?

## Quick Results Interpretation

### ✅ PASS - Ready to Use
- Yellow circles centered on bubbles (±10%)
- 80%+ accuracy with dark marks
- Easy to spot and fix errors
- Processing time < 10 seconds

**Action:** Deploy to users! The manual review step will catch any errors.

### ⚠️ NEEDS TUNING - Almost There
- Yellow circles slightly off-center (10-20%)
- 60-80% accuracy with dark marks
- Some systematic errors (e.g., always missing score 0)

**Action:** See [Quick Fixes](#quick-fixes) below.

### ❌ NEEDS WORK - Not Ready
- Yellow circles way off-center (>20%)
- <60% accuracy with dark marks
- Many false positives or false negatives

**Action:** See [Troubleshooting](#troubleshooting) below.

## Quick Fixes

### Fix 1: Circles Too Far Left
```javascript
// In index.html and test-scoresheet.html
// Find this line (around line 3642 in index.html):
const bubbleAreaLeft = Math.floor(canvas.width * 0.20);

// Change to:
const bubbleAreaLeft = Math.floor(canvas.width * 0.22);  // Shift right
```

### Fix 2: Circles Too Far Right
```javascript
// Change to:
const bubbleAreaLeft = Math.floor(canvas.width * 0.18);  // Shift left
```

### Fix 3: Missing Dark Marks (Too Strict)
```javascript
// In detectScantronMark() function (around line 3750):
if (brightness < 100) {  // Current threshold

// Change to:
if (brightness < 120) {  // More lenient
```

### Fix 4: Too Many False Positives (Too Lenient)
```javascript
// In detectScantronMark() function:
const isFilled = (
  darkRatio > 0.25 ||  // Current threshold

// Change to:
const isFilled = (
  darkRatio > 0.30 ||  // More strict
```

### Fix 5: Bubbles Too Close Together
```javascript
// Adjust the right edge:
const bubbleAreaRight = Math.floor(canvas.width * 0.95);

// Change to:
const bubbleAreaRight = Math.floor(canvas.width * 0.97);  // Wider area
```

## Troubleshooting

### Problem: No yellow circles at all
**Quick Check:**
1. Can you see the marks in the preview image?
2. Are the marks very light or faint?

**Quick Fix:**
- If marks are visible but light: Increase brightness threshold to 130
- If marks are not visible: Retake photo with better lighting

### Problem: Yellow circles on wrong bubbles
**Quick Check:**
1. Are circles consistently off (all left or all right)?
2. By how much? (count bubbles)

**Quick Fix:**
- Consistently left by 1 bubble: Increase `bubbleAreaLeft` by 0.02
- Consistently right by 1 bubble: Decrease `bubbleAreaLeft` by 0.02

### Problem: Only some Ends detected correctly
**Quick Check:**
1. Are blue lines visible?
2. Are they at the black horizontal bars?

**Quick Fix:**
- If no blue lines: Check if black bars are visible in photo
- If blue lines wrong: May need better photo with clearer bars

### Problem: Processing takes too long (>10 seconds)
**Quick Check:**
1. How large is the photo file? (should be <5MB)
2. Is perspective correction running? (check console)

**Quick Fix:**
- Resize photo to max 2000px width before uploading
- Take photo from more direct angle (less correction needed)

## Testing Checklist

Use this for quick testing:

```
Photo Quality:
[ ] In focus
[ ] Good lighting
[ ] All edges visible
[ ] <5MB file size

Positioning:
[ ] Yellow circles on bubbles (±10%)
[ ] 11 positions visible (0-10)
[ ] Equal spacing
[ ] Consistent across rows

Detection:
[ ] Accuracy: ___% (target: 80%+)
[ ] False positives: ___ (target: <3)
[ ] False negatives: ___ (target: <6)

Performance:
[ ] Processing time: ___s (target: <10s)
[ ] Preview loads correctly
[ ] Scores are editable

User Experience:
[ ] Easy to see what was detected
[ ] Easy to spot errors
[ ] Easy to fix errors
[ ] Total updates correctly
```

## Quick Reference: File Locations

### Main Implementation
- `index.html` - Lines 3545-3800 (detectBubbleScores, detectScantronMark)

### Test Page
- `test-scoresheet.html` - Lines 280-420 (same functions)

### Key Parameters
```javascript
// Bubble positioning (line ~3642)
bubbleAreaLeft = canvas.width * 0.20   // Adjust if circles off-center
bubbleAreaRight = canvas.width * 0.95  // Adjust if spacing wrong

// Detection threshold (line ~3748)
brightness < 100  // Adjust if missing/detecting too many marks

// Fill criteria (line ~3761)
darkRatio > 0.25  // Adjust sensitivity
```

## Next Steps After Quick Test

### If Test Passed ✅
1. Test with 3-5 more scorecards
2. Test with different mark types (pen, pencil)
3. Test with tilted photos
4. Deploy to users

### If Test Needs Tuning ⚠️
1. Apply quick fixes above
2. Test again with same photo
3. Measure new accuracy
4. Iterate until 80%+ accuracy

### If Test Failed ❌
1. Check photo quality first
2. Verify this is a standard NASP scorecard
3. Review [SCANTRON_GUIDE.md](SCANTRON_GUIDE.md) for detailed tuning
4. Check [VISUAL_GUIDE.md](VISUAL_GUIDE.md) for what to expect

## One-Line Summary

**Goal:** Yellow circles on bubbles + 80% accuracy + <10s processing = Ready to deploy!

## Questions to Answer

After your quick test, you should be able to answer:

1. Are yellow circles centered on bubbles? **YES / NO**
2. What accuracy did you get? **___%**
3. What was the processing time? **___s**
4. Were errors easy to spot and fix? **YES / NO**
5. Is it faster than manual entry? **YES / NO**

If you answered YES to questions 1, 4, and 5, and got 80%+ accuracy in under 10 seconds, you're ready to go! 🎉

## Need More Help?

- **Positioning issues:** See [SCANTRON_GUIDE.md](SCANTRON_GUIDE.md) - Parameter Tuning
- **Visual problems:** See [VISUAL_GUIDE.md](VISUAL_GUIDE.md) - Common Visual Issues
- **Detailed testing:** See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - Testing Checklist
- **Full documentation:** See [README.md](README.md) - Complete guide
