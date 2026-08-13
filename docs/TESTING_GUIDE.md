# Testing Guide — Aperture v4.1.0

## Load unpacked
1. Chrome: `chrome://extensions` → Developer mode → Load unpacked → `extension/`
2. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `extension/manifest.json`

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
10. Open `test/test-ioc-utils.html` — all checks pass (includes disabled-domain matcher)

## Disabled domains
1. Popup → Settings → add `example.com` (or **Disable on this site** on a matching tab)
2. On `https://www.example.com` (or any subdomain): with on-page detect **on**, no highlights; page palette toast “Disabled on this site”
3. Popup / context-menu pivots still work on that tab
4. Remove the rule (or **Enable** when status shows disabled) — highlights return without reload
5. Confirm `evilexample.com` is **not** matched by rule `example.com`

## Regression
1. Toggle overlays rapidly while page loads — final state wins
2. Text containing `See https://evil.test/a).` — highlight excludes `).`
3. Force overlay config failure (optional) — tools still list defaults
4. Message `searchService` with bogus name — UI shows failure
5. Global on-page detect **off** still wins everywhere, even with an empty disabled list

## Upgrade path
Install 4.0.x data then load 4.1.0 — history/cases/playbooks intact; `disabledDomains` empty until configured.
