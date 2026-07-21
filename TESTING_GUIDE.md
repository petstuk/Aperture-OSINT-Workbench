# Testing Guide - v2.3.0 (IoC Hover Overlays)

## Purpose
Validate opt-in page IoC highlights and hover tooltip before AMO submission, and confirm existing right-click / archive behavior still works.

## Automated checks (completed)
- [x] `node --check` on `ioc-utils.js`, `content.js`, `background.js`, `popup.js`
- [x] `manifest.json` valid JSON, version `2.3.0`, content_scripts present
- [x] `detectIOCType` covers IPv4, IPv6, domain, MD5/SHA1/SHA256, URL
- [x] `findIOCMatches` finds multiple IoCs; URL match does not double-count domain
- [x] Wiring: popup `#overlay-enabled`, content messages, background handlers

---

## Manual Firefox checklist (~15 min)

Load via `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`.

| Test | Expected | Pass |
|------|----------|------|
| Toggle off by default | No dashed underlines on `test-history.html` | [ ] |
| Enable **IoC Hover Overlays** in popup | IoCs underlined (IP red-ish, domain blue-ish, etc.) | [ ] |
| Hover an IoC | Tooltip shows value, type, Copy, enabled services | [ ] |
| Click a service in tooltip | New tab opens OSINT URL; archive gains entry | [ ] |
| Custom combination in tooltip (if configured) | Opens all combo tools; archive saved | [ ] |
| Toggle off | Highlights and tooltip gone | [ ] |
| Right-click → SOC OSINT Search | Still works unchanged | [ ] |
| Skip zones | No highlights inside `<code>`, `<pre>`, inputs | [ ] |
| Upgrade from v2.2.0 temp install | Settings / history preserved; overlay still default off | [ ] |

### How to load test page
1. Open extension page URL for `test-history.html`, or open the file from the repo after temporary load.
2. Prefer: `moz-extension://[ID]/test-history.html` (copy ID from about:debugging).

### Console signals
- Background: `History saved successfully` after tooltip search
- Content: no flood of MutationObserver errors on dynamic pages

---

## Regression (v2.2 features still OK)

- [ ] Archive filters / search / status / notes
- [ ] Export JSON / CSV
- [ ] check-storage.html loads
- [ ] Custom combinations in context menu

---

## If testing fails
1. Export archive JSON from archive page
2. Capture console errors from background + content
3. Note page URL and whether overlay was enabled
4. File GitHub issue before AMO submit

---

**Automated result:** PASS (2026-07-21)  
**Manual result:** ________________ (tester fills after Firefox pass)
