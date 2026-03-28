# Visual Guide to Scantron Detection

## What You'll See in the Preview

When you upload a scorecard, the preview shows exactly what the algorithm detected:

```
┌─────────────────────────────────────────────────────────────┐
│  Review Detected Scores                                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [Colored bars]  NASP Official Score Card              │ │
│  ├───────────────────────────────────────────────────────┤ │ ← Blue line (End 1 top)
│  │                                                        │ │
│  │  ○ ○ ○ ○ ○ ○ ○ ●7 ○ ○ ○                            │ │ ← Row 1 (score 7)
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │ │ ← Green line (row divider)
│  │  ○ ○ ○ ○ ○ ○ ○ ○ ●8 ○ ○                            │ │ ← Row 2 (score 8)
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │ │
│  │  ○ ○ ○ ○ ○ ○ ○ ○ ○ ●9 ○                            │ │ ← Row 3 (score 9)
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │ │
│  │  ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ●10                           │ │ ← Row 4 (score 10)
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │ │
│  │  ○ ○ ○ ○ ○ ○ ○ ○ ○ ●9 ○                            │ │ ← Row 5 (score 9)
│  │                                                        │ │
│  ├───────────────────────────────────────────────────────┤ │ ← Blue line (End 2 top)
│  │  ○ ○ ○ ○ ○ ○ ○ ○ ●8 ○ ○                            │ │
│  │  ... (4 more rows)                                     │ │
│  ├───────────────────────────────────────────────────────┤ │ ← Blue line (End 3 top)
│  │  ... (Ends 3-6)                                        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Legend:                                                    │
│  ● Yellow circles = Detected marks with score numbers      │
│  ━ Blue lines = End boundaries (from black horizontal bars)│
│  ─ Green lines = Row divisions within each End             │
│                                                             │
│  Detected Scores:                                           │
│  End 1: [7] [8] [9] [10] [9]  Total: 43                   │
│  End 2: [8] [9] [10] [9] [8]  Total: 44                   │
│  End 3: [9] [10] [9] [8] [9]  Total: 45                   │
│  End 4: [10] [9] [8] [9] [10] Total: 46                   │
│  End 5: [9] [8] [9] [10] [9]  Total: 45                   │
│  End 6: [8] [9] [10] [9] [8]  Total: 44                   │
│                                                             │
│  Total Score: 267 / 300                                    │
│                                                             │
│  [Tap any score to edit]                                   │
│                                                             │
│  [Cancel]  [Confirm & Load Scores]                         │
└─────────────────────────────────────────────────────────────┘
```

## Color Coding Explained

### Yellow Circles ●
- Show where the algorithm detected filled bubbles
- Number inside shows the detected score (0-10)
- Should be centered on your actual marks
- If off-center, positioning may need adjustment

### Blue Lines ━
- Mark the boundaries between Ends
- Should align with the black horizontal bars on the scorecard
- There should be 6 Ends total
- If misaligned, End detection may need adjustment

### Green Lines ─
- Mark the divisions between rows within each End
- Should divide each End into 5 equal rows
- Help visualize how the algorithm split up the scorecard

## What Good Detection Looks Like

### Perfect Detection ✅
```
Your Scorecard:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ○ ● ○ ○ ○         │ (You filled bubble 7)
└─────────────────────────────────┘

Preview Shows:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ○ ●7 ○ ○ ○        │ (Yellow circle on bubble 7)
└─────────────────────────────────┘

Score List Shows: [7]

✅ Perfect! Just confirm.
```

### Slightly Off But Correct ⚠️
```
Your Scorecard:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ○ ● ○ ○ ○         │ (You filled bubble 7)
└─────────────────────────────────┘

Preview Shows:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ●7 ○ ○ ○ ○        │ (Yellow circle slightly left)
└─────────────────────────────────┘

Score List Shows: [7]

⚠️ Circle is off-center but score is correct. OK to proceed.
```

### Missed Light Mark ❌
```
Your Scorecard:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ○ ◐ ○ ○ ○         │ (Light pencil mark on bubble 7)
└─────────────────────────────────┘

Preview Shows:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○         │ (No yellow circle)
└─────────────────────────────────┘

Score List Shows: [0]

❌ Missed the mark. Tap [0] and change to [7].
```

### Wrong Bubble Detected ❌
```
Your Scorecard:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ○ ● ○ ○ ○         │ (You filled bubble 7)
└─────────────────────────────────┘

Preview Shows:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ●6 ○ ○ ○ ○        │ (Yellow circle on wrong bubble)
└─────────────────────────────────┘

Score List Shows: [6]

❌ Wrong bubble detected. Positioning needs adjustment.
```

### Multiple Marks (Smudge) 🔧
```
Your Scorecard:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ● ○ ● ○ ○         │ (Filled 6, smudge on 8)
└─────────────────────────────────┘

Preview Shows:
┌─────────────────────────────────┐
│ ○ ○ ○ ○ ○ ○ ●6 ○ ●8 ○ ○       │ (Both detected)
└─────────────────────────────────┘

Score List Shows: [6]  ← Automatically uses lowest

🔧 If 8 is correct, tap [6] and change to [8].
```

## Bubble Positioning Visualization

The algorithm calculates exact bubble positions:

```
Scorecard Width: 1000 pixels (example)

Bubble Area:
├─ Left edge: 20% = 200px
├─ Right edge: 95% = 950px
└─ Width: 750px

11 Bubbles (0-10):
Spacing: 750px / 11 = 68.18px per bubble

Bubble Positions:
0: 200 + (0.5 × 68.18) = 234px
1: 200 + (1.5 × 68.18) = 302px
2: 200 + (2.5 × 68.18) = 370px
3: 200 + (3.5 × 68.18) = 439px
4: 200 + (4.5 × 68.18) = 507px
5: 200 + (5.5 × 68.18) = 575px
6: 200 + (6.5 × 68.18) = 643px
7: 200 + (7.5 × 68.18) = 712px
8: 200 + (8.5 × 68.18) = 780px
9: 200 + (9.5 × 68.18) = 848px
10: 200 + (10.5 × 68.18) = 916px

Sample Radius: ~17px (25% of spacing × 80%)
```

## What to Check in Preview

### 1. Bubble Positioning
- [ ] Yellow circles are centered on printed bubbles
- [ ] All 11 positions visible (0-10)
- [ ] Equal spacing between circles
- [ ] Consistent across all rows

**If circles are off-center:**
- All shifted left → Increase `bubbleAreaLeft`
- All shifted right → Decrease `bubbleAreaLeft`
- Too close together → Adjust area width

### 2. End Boundaries
- [ ] Blue lines align with black horizontal bars
- [ ] 6 Ends detected
- [ ] Ends are roughly equal height
- [ ] No Ends missing or extra

**If End boundaries are wrong:**
- Check if black horizontal bars are visible in photo
- May need better lighting or clearer photo
- Algorithm will fall back to equal division if bars not found

### 3. Row Divisions
- [ ] Green lines divide each End into 5 rows
- [ ] Rows are roughly equal height
- [ ] Lines don't overlap with marks
- [ ] Consistent across all Ends

**If row divisions are wrong:**
- Usually not a problem (calculated mathematically)
- Check if End boundaries are correct first

### 4. Detected Marks
- [ ] All filled bubbles have yellow circles
- [ ] No yellow circles on empty bubbles
- [ ] Score numbers are correct
- [ ] Multiple marks use lowest score

**If detection is wrong:**
- Missing marks → Increase sensitivity
- False positives → Decrease sensitivity
- Wrong bubbles → Check positioning

## Editing Scores

If any score is incorrect:

```
┌─────────────────────────────────┐
│  Detected Scores:               │
│                                 │
│  End 1: [7] [8] [9] [10] [9]   │
│         ↑                       │
│         Tap to edit             │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Edit Score              │   │
│  │                         │   │
│  │ Current: 7              │   │
│  │                         │   │
│  │ New Score: [  ]         │   │
│  │                         │   │
│  │ [0][1][2][3][4][5]     │   │
│  │ [6][7][8][9][10]       │   │
│  │                         │   │
│  │ [Cancel] [Save]         │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

## Testing Checklist

When you upload a test scorecard:

### Visual Inspection
- [ ] Can you see the entire scorecard in preview?
- [ ] Are yellow circles visible?
- [ ] Are blue lines at End boundaries?
- [ ] Are green lines dividing rows?

### Positioning Check
- [ ] Yellow circles centered on bubbles (±10% OK)
- [ ] All 11 bubble positions present (0-10)
- [ ] Equal spacing between positions
- [ ] Consistent across all 30 rows

### Detection Check
- [ ] Count filled bubbles on your scorecard: ___
- [ ] Count yellow circles in preview: ___
- [ ] Count correct detections: ___
- [ ] Count missed marks: ___
- [ ] Count false positives: ___
- [ ] Calculate accuracy: (correct / total) × 100 = ___%

### Accuracy Targets
- Black pen/marker: 90%+ (27+ out of 30)
- Dark pencil: 75%+ (23+ out of 30)
- Light pencil: 60%+ (18+ out of 30)

### User Experience
- [ ] Processing time < 10 seconds
- [ ] Preview is clear and understandable
- [ ] Easy to identify incorrect scores
- [ ] Easy to edit incorrect scores
- [ ] Total score updates automatically
- [ ] Can confirm and load into session

## Common Visual Issues

### Issue: No yellow circles visible
**Possible causes:**
- Marks too light (use darker pen/pencil)
- Detection sensitivity too low
- Photo quality too poor

**What to check:**
- Can you see the marks clearly in the preview image?
- Are the marks very light or faint?
- Is the photo blurry or out of focus?

### Issue: Yellow circles not on bubbles
**Possible causes:**
- Bubble positioning parameters incorrect
- Perspective correction distorted image
- Non-standard scorecard format

**What to check:**
- Are circles consistently off (all left or all right)?
- Are circles off by the same amount in all rows?
- Is the scorecard a standard NASP format?

### Issue: Blue lines not at End boundaries
**Possible causes:**
- Black horizontal bars not visible
- Poor lighting or contrast
- Algorithm falling back to equal division

**What to check:**
- Can you see black horizontal bars in the preview?
- Are the bars clear and dark?
- Is there enough contrast between bars and background?

### Issue: Too many yellow circles (false positives)
**Possible causes:**
- Smudges or erasure marks
- Detection sensitivity too high
- Stray pencil marks

**What to check:**
- Are there smudges or marks near bubbles?
- Is the scorecard clean?
- Are there erasure marks visible?

### Issue: Too few yellow circles (missed marks)
**Possible causes:**
- Marks too light
- Detection sensitivity too low
- Poor photo quality

**What to check:**
- Are the marks dark enough?
- Is the lighting even?
- Is the photo in focus?

## What Success Looks Like

A successful detection will show:

1. ✅ Yellow circles centered on all filled bubbles
2. ✅ No yellow circles on empty bubbles
3. ✅ Blue lines at all 6 End boundaries
4. ✅ Green lines dividing each End into 5 rows
5. ✅ Score numbers matching your marks
6. ✅ Total score matching your expected total
7. ✅ 80%+ of scores detected correctly
8. ✅ Easy to spot and fix any errors

If you see this, the algorithm is working correctly!

## Next Steps After Visual Check

1. **If positioning looks good (circles on bubbles):**
   - Test with multiple scorecards
   - Measure accuracy
   - Fine-tune sensitivity if needed

2. **If positioning is off (circles not on bubbles):**
   - Adjust `bubbleAreaLeft` and `bubbleAreaRight`
   - Test again with same photo
   - Iterate until circles are centered

3. **If detection is poor (many missed marks):**
   - Check mark darkness (use darker pen/pencil)
   - Increase detection sensitivity
   - Test with better lighting

4. **If too many false positives:**
   - Clean scorecard before photographing
   - Decrease detection sensitivity
   - Use manual review to correct

Remember: The goal is 80%+ automatic accuracy with 100% accuracy after manual review. Users will always have a chance to correct errors, so focus on getting most scores right!
