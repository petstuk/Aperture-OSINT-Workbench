# Chrome Web Store Prep (Phase 3A) — post AMO v2.3.0

Use after Firefox v2.3.0 is accepted. Extension already loads unpacked in Chrome.

## Account
- [ ] Chrome Web Store developer account (~$5 one-time)
- [ ] Verify publisher email

## Package
Chrome can use the same zip as Firefox for MV2, or:
```bash
./package-for-firefox.sh
# Upload osint-search-v2.3.0.zip (or rebuild excluding Firefox-only notes)
```
- [ ] Confirm `manifest.json` has no Chrome-breaking Firefox-only keys issues
  - `applications.gecko` is ignored by Chrome; OK for dual package
- [ ] Test Load unpacked in Chrome (`chrome://extensions`)
- [ ] Overlay toggle + right-click + archive on Chrome

## Store listing (adapt from AMO)
**Name:** SOC OSINT Search  
**Short description:** Right-click and page-highlight IoC search across popular OSINT tools.  
**Detailed description:** Reuse AMO listing; emphasize privacy (no telemetry, opt-in overlays).

## Screenshots to capture
- [ ] Popup: Recent Analysis + Page Highlights toggle ON
- [ ] Hover tooltip on a webpage with sample IoCs
- [ ] Archive dashboard with filters
- [ ] Manage Services modal

## Privacy
- [ ] Privacy policy URL (GitHub README section is fine if hosted)
- [ ] Single purpose: OSINT lookup for security professionals
- [ ] Justify `<all_urls>`: context menu + optional page highlights

## Submit
- [ ] Upload package
- [ ] Complete questionnaire
- [ ] Submit for review

## Not in this prep
Manifest V3 migration (Phase 3C) — defer until Chrome forces MV2 sunset for this listing.
