# Release Notes - v2.3.0

## Page IoC Highlights (opt-in hover overlays)

### What's new
Security analysts can enable **IoC Hover Overlays** in the popup. When on, the extension highlights IPs, domains, hashes, and URLs in page text. Hovering an indicator shows a tooltip with:

- IoC value and type
- Archive status (if previously analyzed)
- **Copy** button
- Quick-launch buttons for enabled OSINT services
- Custom combinations (same as the context menu)

No API keys. Tooltip actions open the same public OSINT URLs as right-click search and write to the local archive via the background script.

### Privacy and permissions
- **No new permissions.** Content scripts use the existing `<all_urls>` permission already declared for context-menu workflows.
- **Default off.** `overlayEnabled` is false until the user toggles it in the popup.
- Content script only scans DOM text **locally**. It does not fetch OSINT APIs or send telemetry.
- Search actions are handled by the background script opening user-chosen OSINT tabs.

### Files
**Added:**
- `ioc-utils.js` — shared IoC detection (`detectIOCType`, `findIOCMatches`)
- `content.js` — page scanner, highlights, tooltip, MutationObserver (capped at 500 highlights)
- `content.css` — highlight and tooltip styles

**Modified:**
- `manifest.json` — version `2.3.0`, content_scripts, background loads `ioc-utils.js`
- `background.js` — message handlers: `getOverlayConfig`, `getArchiveEntry`, `searchService`, `runCombinationFromOverlay`
- `popup.html` / `popup.js` — Page Highlights toggle
- `README.md` — usage and changelog
- `package-for-firefox.sh` — include new files

### Performance guards
- Skips `script`, `style`, `input`, `textarea`, `code`, `pre`, and contenteditable regions
- Debounced MutationObserver rescans
- Max 500 highlights per page

### Backwards compatibility
- Fully compatible with v2.2.0 data and settings
- Right-click context menu unchanged
- Archive / storage rotation unchanged

### AMO reviewer notes
```
This release adds an optional content script that highlights IoCs on web pages
when the user enables "IoC Hover Overlays" in the popup (default: OFF).

- No new permissions beyond existing <all_urls>
- No remote code, no minification, no telemetry
- Content script does not call external APIs; it only annotates local DOM text
- User actions open the same OSINT URLs already used by the context menu
- Test page included: test-history.html (sample IoCs)
```

### Testing recommendations
1. Fresh install: confirm overlay toggle is off and pages are unmodified
2. Enable overlay → open `test-history.html` → verify underlines and tooltip
3. Click VirusTotal (or any service) → tab opens + archive entry
4. Disable overlay → highlights removed
5. Confirm right-click search still works

---

## Version History

**v2.3.0** (Current)
- Opt-in IoC hover overlays with quick-search tooltip

**v2.2.0**
- Automatic storage rotation
- Storage diagnostics tool
- Improved error handling

**v2.1.1**
- Archive dashboard enhancements
- Status tagging, notes, filters
