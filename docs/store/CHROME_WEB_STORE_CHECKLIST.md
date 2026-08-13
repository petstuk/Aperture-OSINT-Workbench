# Chrome Web Store Prep — Aperture v4.1.0

## Account
- [ ] Chrome Web Store developer account
- [ ] Verify publisher email

## Package
```bash
./scripts/package.sh
# Upload aperture-osint-v4.1.0.zip
```
- [ ] Load unpacked in Chrome (`chrome://extensions`) — Manifest V3
- [ ] Popup, dashboard, overlay, disabled domains, context menu smoke test

## Store listing
**Name:** Aperture — OSINT Workbench  

Do **not** keyword-stuff third-party tool names in the Chrome Web Store description (policy: Yellow Argon). Name at most one example in prose, or none.

**Detailed description (safe to paste):**
```
Aperture is a local-first OSINT browser extension for SOC, DFIR, and threat intelligence analysts.

Paste or select an indicator of compromise — such as an IP, domain, URL, email, hash, or CVE — and open public OSINT lookup sites in new tabs. Built as an investigation workbench:

• Popup launcher — classify indicators locally, then run tools or playbooks
• Dashboard — triage inbox, bulk extract, cases, playbooks, relationship graph, offline packs
• Playbooks — multi-tool workflows in one click (shareable APX codes)
• Cases — verdicts, tags, notes, timeline, and JSON / Markdown / CSV export
• On-page detect (opt-in) — highlight IoCs and open a pivot card; disable on specific domains when needed
• Context menu and command palette for fast lookup

Core use requires no API keys, no accounts, and no telemetry. Parsing stays on-device; network use is limited to the public OSINT tabs you choose to open. Optional Labs features (local LLM / API enrichment) are off by default.

Formerly published as SOC OSINT Search.
```

## Screenshots to capture
- [ ] Popup launcher with detected indicator + playbooks
- [ ] Dashboard triage overview
- [ ] Bulk extract results
- [ ] Playbooks grid
- [ ] On-page pivot card on `test/test-history.html`
- [ ] Asset: `docs/store/chrome-store-1280x800.png` (promo / screenshot size)

## Privacy
- [ ] Privacy policy URL ([PRIVACY.md](../../PRIVACY.md) hosted on the repo or site)
- [ ] Single purpose: OSINT lookup / workbench for security professionals
- [ ] Justify host permissions: context menu + optional page highlights

## Submit
- [ ] Upload package + screenshots
- [ ] Complete questionnaire
- [ ] Submit for review
