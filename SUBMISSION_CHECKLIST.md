# Firefox Add-ons Submission Checklist - v2.3.0

## Pre-Submission Checklist

### Code Quality
- [x] JS syntax checks pass (`ioc-utils.js`, `content.js`, `background.js`, `popup.js`)
- [x] Manifest JSON valid; version 2.3.0
- [x] IoC unit checks pass (IPv4/IPv6/domain/hash/URL + findIOCMatches)
- [x] Browser API compatibility layer working
- [x] Overlay default off; no new permissions
- [ ] Manual Firefox pass (see TESTING_GUIDE.md)

### Files to Include in ZIP
```
Required Files:
├── manifest.json (v2.3.0)
├── ioc-utils.js (NEW)
├── background.js
├── content.js (NEW)
├── content.css (NEW)
├── popup.html
├── popup.js
├── archive.html
├── archive.js
├── check-storage.html
├── debug-storage.html
├── icon512.png
├── README.md
└── test-*.html (optional, for reviewer testing)
```

### Manifest Review
- [x] Version updated to 2.3.0
- [x] content_scripts registered (`ioc-utils.js`, `content.js`, `content.css`)
- [x] background scripts include `ioc-utils.js`
- [x] No new permissions vs v2.2.0
- [x] Firefox-specific `applications.gecko.id` present

### Testing Performed
- [x] Automated IoC / wiring checks
- [ ] Fresh install on Firefox (clean profile)
- [ ] Upgrade from v2.2.0 (settings preserved; overlay default off)
- [ ] Overlay off → no page highlights
- [ ] Overlay on → highlights on test-history.html
- [ ] Hover tooltip: type, Copy, services, combinations
- [ ] Tooltip search opens tab + saves archive
- [ ] Overlay off removes highlights
- [ ] Right-click context menu still works
- [ ] Archive filters / export still work

### Documentation
- [x] README.md updated with Page Highlights
- [x] RELEASE_NOTES_v2.3.0.md created
- [x] TESTING_GUIDE.md updated for v2.3.0
- [x] CHANGELOG in README.md updated

## Submission Form Details

### Basic Information
**Add-on Name:** SOC OSINT Search  
**Version:** 2.3.0  
**Summary of Changes:**
```
Opt-in page IoC highlights: when enabled, indicators on web pages are
underlined and a hover tooltip offers Copy plus one-click OSINT search
(same services as the context menu). Default off. No new permissions.
No API keys or telemetry.
```

### Detailed Description for Reviewers
```
This update adds optional content-script IoC highlighting.

Key points for review:
1. Feature is OFF by default (storage key overlayEnabled).
2. User enables it via "IoC Hover Overlays" in the popup.
3. Content script only scans local DOM text (IPs, domains, hashes, URLs).
4. It does NOT call external APIs or collect telemetry.
5. Tooltip actions message the background script, which opens the same
   OSINT URLs already used by the right-click context menu and writes
   to the existing local archive (browser.storage.sync).
6. No new permissions. Existing <all_urls> is reused for page access.
7. Performance: skips form/code regions; max 500 highlights; debounced
   MutationObserver.

Testing:
- Load temporary add-on, open moz-extension://[ID]/test-history.html
- Enable overlay in popup, hover sample IoCs, click a service
- Disable overlay and confirm highlights are removed
```

### Source Code Notes (if required)
```
All source code is included. No build process, minification, or obfuscation.

Key files:
- ioc-utils.js: shared detection helpers
- content.js / content.css: page highlights + tooltip
- background.js: overlay message handlers
- popup.html / popup.js: enable/disable toggle
- manifest.json: version 2.3.0 + content_scripts
```

## Packaging Instructions

```bash
cd /home/peterstollery/Documents/cursor/osint-extension
./package-for-firefox.sh
```

Upload `osint-search-v2.3.0.zip` to:
https://addons.mozilla.org/developers/addon/soc-osint-extension/versions/submit/

Use release notes from `RELEASE_NOTES_v2.3.0.md`.

## Post-Submission Monitoring

**Week 1:**
- [ ] Watch AMO review queue / reviewer questions (content scripts often get extra scrutiny)
- [ ] Confirm opt-in language is clear if asked
- [ ] Smoke-test after public release: toggle on/off, right-click, archive

**Rollback:** Keep `osint-search-v2.2.0.zip` / previous AMO version available for revert if needed.

## Success Criteria
- [ ] AMO accepts v2.3.0
- [ ] No critical reports about unwanted page modification (default off)
- [ ] Right-click + archive remain stable
- [ ] Overlay works when explicitly enabled

---

**Ready for Submission:** YES (after manual Firefox checklist)  

**Confidence Level:** HIGH  
**Risk Level:** LOW–MEDIUM (content scripts increase review attention; mitigated by default-off + no new permissions)

**Next Steps:**
1. Complete manual Firefox checklist in TESTING_GUIDE.md
2. Create ZIP via `./package-for-firefox.sh`
3. Submit to Firefox Add-ons
4. Monitor review; then choose Phase 3 (Chrome Web Store vs storage.local)
