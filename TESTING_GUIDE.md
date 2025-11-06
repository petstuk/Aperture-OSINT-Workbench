# Testing Guide - v2.2.0 (Storage Rotation Fix)

## Purpose
Test the new automatic storage rotation feature over 7 days to ensure the archive never stops updating.

## What Was Fixed
**Before:** Archive would silently stop saving new entries when hitting the 100KB Chrome storage quota limit.

**After:** Archive automatically removes oldest entries when quota is reached, allowing continuous operation.

---

## Daily Testing Routine (5 minutes/day)

### Morning Check
```
1. Open Firefox Developer Tools (F12)
2. Go to Console tab
3. Add 2-3 new IOCs via right-click context menu
4. Look for console messages:
   ✅ "History saved successfully with XX entries"
   ⚠️  "Storage quota exceeded, removing oldest entries..."
```

### Storage Health Check (Every Other Day)
```
1. Navigate to: moz-extension://[YOUR-ID]/check-storage.html
   (Right-click extension icon > Manage Extension > copy ID)
2. Record the metrics:
   - Storage percentage: _____%
   - Total entries: _____
   - Average entry size: _____ bytes
3. Verify status:
   [ ] Green (< 75%) - Healthy
   [ ] Yellow (75-90%) - Warning
   [ ] Red (> 90%) - Critical (but should auto-rotate)
```

---

## Weekly Testing Log

### Day 1 (Installation Day)
**Date:** ________________

**Pre-Update Snapshot:**
- [ ] Export current archive (archive.html → Export JSON)
- [ ] Save export as backup: `backup-pre-v2.2.0.json`
- [ ] Note current entry count: _____

**Installation:**
- [ ] Update extension to v2.2.0
- [ ] Open console and verify no errors
- [ ] Test adding 1 IOC - verify it saves
- [ ] Open check-storage.html and record:
  - Storage used: _____ / 102,400 bytes (_____%)
  - Total entries: _____

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### Day 2-3 (Normal Usage)
**Date:** ________________

**Usage Stats:**
- IOCs added today: _____
- Total entries now: _____
- Storage percentage: _____%

**Console Observations:**
- [ ] No errors
- [ ] "History saved successfully" messages seen
- [ ] Any rotation messages? (Yes/No): _____

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
```

---

### Day 4-5 (Heavy Testing)
**Date:** ________________

**Stress Test (Optional but Recommended):**
```bash
Try to add 10-15 IOCs in a single session to test:
1. Rapid addition handling
2. Storage quota detection
3. Rotation behavior (if triggered)
```

**Observations:**
- Total entries now: _____
- Storage percentage: _____%
- Did rotation occur? (Yes/No): _____
- If yes, entries removed: _____

**Console Messages:**
```
Copy any interesting console messages here:
_________________________________________________________________
_________________________________________________________________
```

---

### Day 6-7 (Final Assessment)
**Date:** ________________

**Final Metrics:**
- Total entries: _____
- Storage percentage: _____%
- Oldest entry date: ________________
- Newest entry date: ________________

**Feature Verification:**
- [ ] Archive updates every time
- [ ] No silent failures
- [ ] Rotation works if quota hit
- [ ] check-storage.html loads correctly
- [ ] Export functions still work
- [ ] Filters and search still work
- [ ] Status tags still save
- [ ] Notes still save

**Overall Assessment:**
```
Success Criteria Met:

[ ] Archive NEVER stopped updating
[ ] No data corruption or loss
[ ] Rotation occurred smoothly (if needed)
[ ] No critical errors in console
[ ] Extension performance is good
[ ] User experience is acceptable

Overall Status: PASS / FAIL (circle one)
```

---

## Common Scenarios to Test

### Scenario 1: Normal Daily Use
```
Expected: Archive grows steadily, no rotation needed
Test: Add 3-5 IOCs per day
Result: _________________________________________________
```

### Scenario 2: Approaching Quota Limit
```
Expected: Warning at 75%, no issues yet
Test: Monitor check-storage.html as usage grows
Result: _________________________________________________
```

### Scenario 3: Quota Exceeded (If it happens)
```
Expected: Console shows "Storage quota exceeded, removing oldest entries"
         Oldest entries removed automatically
         New entry saves successfully
Test: Keep adding until quota hit OR manually fill storage
Result: _________________________________________________
```

### Scenario 4: After Rotation
```
Expected: Archive continues to work normally
         Storage percentage drops back below 100%
         New entries save without issues
Test: Continue using after rotation occurs
Result: _________________________________________________
```

---

## Warning Signs to Watch For

### 🚨 Critical Issues (Report Immediately)
```
❌ Archive stops updating again
❌ Console shows repeated errors
❌ Data corruption (entries garbled)
❌ Extension crashes or freezes
❌ Cannot open archive page
❌ Export functions fail
```

### ⚠️ Minor Issues (Document but not urgent)
```
⚠️  Rotation removes more entries than expected
⚠️  Performance slowdown with many entries
⚠️  check-storage.html loads slowly
⚠️  Console warnings (not errors)
```

### ✅ Expected Behaviors (Normal)
```
✅ "Storage quota exceeded" message (when quota hit)
✅ "Removed XX oldest entries" message (during rotation)
✅ Entry count decreases after rotation
✅ Storage percentage drops after rotation
✅ Oldest entries no longer visible after rotation
```

---

## Troubleshooting Guide

### Issue: Archive seems to have stopped updating
```
1. Open check-storage.html
2. Check if storage is at 100%
3. Check console for error messages
4. Try clicking "Test Write" button
5. If fails, note the error and report
```

### Issue: Too many entries being removed
```
1. Note how many entries before: _____
2. Note how many after rotation: _____
3. Calculate percentage removed: _____
4. Expected: ~10% removed per rotation
5. If > 20% removed, report the behavior
```

### Issue: Extension feels slow
```
1. Check total entry count: _____
2. If > 200 entries, this is expected with v2.2.0
3. Consider manually pruning old entries
4. Export and clear history, reimport recent ones
```

---

## Data Backup Strategy

### Daily (if critical data)
```
1. Open archive.html
2. Click "Export JSON"
3. Save with date: osint-backup-YYYY-MM-DD.json
```

### Weekly (minimum)
```
1. Export JSON at end of each week
2. Keep last 4 weeks of backups
3. Store in safe location
```

### Before Major Changes
```
1. Export JSON before updating extension
2. Export before manually clearing history
3. Export before testing rotation behavior
```

---

## Reporting Results

### After 7 Days, Report:

**Success Metrics:**
```
✅ Total IOCs processed: _____
✅ Archive updates: NEVER STOPPED / STOPPED (if stopped, when?)
✅ Rotations occurred: _____ times
✅ Average entries maintained: _____
✅ Storage percentage: _____%
✅ Console errors: _____ (should be 0)
```

**User Experience:**
```
Rate 1-10 (10 = excellent):
- Reliability: ___ / 10
- Performance: ___ / 10
- Ease of use: ___ / 10
- Would recommend update: YES / NO
```

**Final Recommendation:**
```
[ ] APPROVE - Update is solid, release to all users
[ ] MINOR ISSUES - Works but needs tweaks
[ ] MAJOR ISSUES - Needs significant fixes before release
[ ] ROLLBACK - Critical problems, revert to v2.1.1
```

---

## Emergency Rollback

If critical issues occur:

1. **Backup your data first:**
   ```
   1. Open archive.html
   2. Export JSON
   3. Save the file
   ```

2. **Revert to v2.1.1:**
   ```
   1. about:addons
   2. Find "SOC OSINT Search"
   3. Click "..." menu
   4. Remove extension
   5. Reinstall v2.1.1 from AMO
   ```

3. **Report the issue:**
   ```
   Create GitHub issue with:
   - Date/time of problem
   - Console logs
   - Steps to reproduce
   - Your testing notes
   ```

---

## Success! What's Next?

If testing passes:
- [ ] Update GitHub with "Tested: v2.2.0 stable"
- [ ] Consider adding more features
- [ ] Monitor Firefox AMO reviews
- [ ] Celebrate! 🎉

If testing fails:
- [ ] Document all issues found
- [ ] Create GitHub issues
- [ ] Discuss fixes needed
- [ ] Plan v2.2.1 hotfix

---

**Testing Start Date:** ________________

**Testing End Date:** ________________

**Tester Name:** ________________

**Overall Result:** ⭐⭐⭐⭐⭐ (circle stars)


