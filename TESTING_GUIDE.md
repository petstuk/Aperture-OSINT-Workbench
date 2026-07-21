# Testing Guide — Aperture v3.0.0

## Load unpacked
1. Chrome: `chrome://extensions` → Developer mode → Load unpacked
2. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`

## Smoke
1. Open popup — brand APERTURE, detect field, playbooks, recent
2. Paste `8.8.8.8` — type pill + quick tools appear; click VT
3. Open full workbench — triage stats/inbox (empty OK)
4. Bulk extract sample text with IP + URL + hash
5. Create case, add indicators, export report
6. Playbooks: run IP Triage; import `APX|Test|ip|VirusTotal,Shodan`
7. Enable on-page detect → open `test-history.html` → click highlight → pivot card
8. ⌘K / Ctrl-K from popup and dashboard

## Regression (Bugbot)
1. Toggle overlays rapidly while page loads — final state wins
2. Text containing `See https://evil.test/a).` — highlight excludes `).`
3. Force overlay config failure (optional) — tools still list defaults
4. Message `searchService` with bogus name — UI shows failure

## Upgrade path
Install 2.3.0 data (history + combinations) then load 3.0.0 — history in local, playbooks present.
