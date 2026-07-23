# Testing Guide — Aperture v3.0.1

## Load unpacked
1. Chrome: `chrome://extensions` → Developer mode → Load unpacked
2. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`

## Smoke
1. Open popup — brand APERTURE, detect field, playbooks, recent
2. Paste `8.8.8.8` — type pill + quick tools appear; click VT
3. Paste an email — HIBP appears in quick tools; opens haveibeenpwned.com/account/…
4. Open full workbench — triage stats/inbox (empty OK)
5. Bulk extract sample text with IP + URL + hash
6. Create case, add indicators, export report
7. Playbooks: run IP Triage / Email Breach Check; import `APX|Test|ip|VirusTotal,Shodan`
8. Enable on-page detect → open `test/test-history.html` → click highlight → pivot card
9. ⌘K / Ctrl-K from popup and dashboard

## Regression (Bugbot)
1. Toggle overlays rapidly while page loads — final state wins
2. Text containing `See https://evil.test/a).` — highlight excludes `).`
3. Force overlay config failure (optional) — tools still list defaults
4. Message `searchService` with bogus name — UI shows failure

## Upgrade path
Install 2.3.0 or 3.0.0 data then load 3.0.1 — history in local, playbooks present, HIBP merged into enabled services.
