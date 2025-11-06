# Release Notes - v2.2.0

## 🔧 Critical Bug Fix: Archive Storage Management

### Problem Solved
Fixed a critical issue where the archive would stop updating after reaching Chrome's storage quota limit (100KB). Previously, new IOC entries would silently fail to save when storage was full.

### Changes

#### 1. **Automatic Storage Rotation**
- Removed arbitrary 100-entry hard limit
- Implemented intelligent storage quota detection
- Automatically removes oldest entries when storage limit is reached
- Removes 10% of oldest entries at a time until save succeeds
- Archive now dynamically adapts to available storage space

#### 2. **Enhanced Error Handling**
- Added proper error detection for `QUOTA_BYTES` errors
- Improved logging for storage operations
- Recursive retry logic with safety limits (max 20 attempts)
- Works for both Chrome callback API and Firefox promise API

#### 3. **New Diagnostic Tool**
- Added `check-storage.html` - comprehensive storage diagnostics page
- Real-time storage quota monitoring (bytes used / total)
- Displays percentage of storage used
- Visual warnings at 75% (warning) and 90% (critical)
- Test write functionality to verify storage is working
- Export full data for backup purposes
- Shows entry counts, average sizes, and type breakdowns

#### 4. **Code Improvements**
- Refactored `addToHistory()` function with rotation support
- Added `attemptSaveWithRotation()` for Chrome callback API
- Added `attemptSaveWithRotationPromise()` for Firefox promise API
- Consolidated duplicate code in `runCombination()` to use shared history function
- Better console logging throughout

### Technical Details

**Files Modified:**
- `background.js` - Core storage rotation logic
- `manifest.json` - Version bump to 2.2.0, added check-storage.html
- `README.md` - Updated documentation

**Files Added:**
- `check-storage.html` - Storage diagnostics tool

### Testing Recommendations

1. **Monitor Console Logs**
   - Look for messages like: "Trying to save X entries"
   - Watch for: "Storage quota exceeded, removing oldest entries..."
   - Verify: "History saved successfully with X entries"

2. **Use Diagnostic Tool**
   - Navigate to `moz-extension://[YOUR-ID]/check-storage.html`
   - Check storage percentage regularly
   - Export data before it reaches 90% if you want to preserve all entries

3. **Test Rotation**
   - Add new IOCs continuously
   - Verify that new entries always appear in archive
   - Confirm oldest entries are removed when needed

### User Impact

**Positive:**
- ✅ Archive will never stop updating
- ✅ Users can now store as many IOCs as storage allows
- ✅ Automatic cleanup means no manual intervention needed
- ✅ Better visibility into storage health

**Minimal:**
- Very old entries may be automatically removed if storage is full
- This only affects users with extensive IOC collections
- Export functionality allows backup before rotation occurs

### Backwards Compatibility

- ✅ Fully compatible with existing data
- ✅ No migration required
- ✅ Works with all existing features (notes, status, filters, etc.)
- ✅ No changes to user interface or workflows

### Firefox Add-ons Submission Notes

**Review Notes:**
This update fixes a critical bug where storage quota errors caused silent failures. The fix is conservative and includes proper error handling with safety limits. No new permissions required.

**Privacy/Security:**
- No changes to data collection (still none)
- No new external connections
- No new permissions requested
- All data remains local in browser.storage.sync

**Testing Performed:**
- Tested on Firefox Developer Edition
- Tested quota error scenarios
- Verified both promise and callback API paths
- Tested with large datasets approaching 100KB limit
- Verified automatic rotation works correctly

---

## Version History

**v2.2.0** (Current)
- Automatic storage rotation
- Storage diagnostics tool
- Improved error handling

**v2.1.1** (Previous)
- Archive dashboard enhancements
- Status tagging system
- Notes and annotations
- Multi-dimensional filtering


