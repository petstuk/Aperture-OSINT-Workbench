# Testing Guide — Aperture v4.4.0

## Load unpacked
1. Chrome: `chrome://extensions` → Developer mode → Load unpacked → `extension/`
2. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `extension/manifest.json`

## Smoke
1. Open popup — workbench launcher, on-page detect, disable this site, Feedback
2. Paste `8.8.8.8` — type pill + quick tools appear; click VT
3. Paste an email — HIBP appears in quick tools; opens haveibeenpwned.com/account/…
4. Open full workbench — triage stats/inbox (empty OK)
5. Bulk extract sample text with IP + URL + hash
6. Create case, add indicators, export report
7. Playbooks: run IP Triage / Email Breach Check; import `APX|Test|ip|VirusTotal,Shodan`
8. Enable on-page detect → open `test/test-history.html` → click highlight → pivot card
9. ⌘K / Ctrl-K from popup and dashboard
10. Open `test/test-ioc-utils.html` — all checks pass (includes disabled-domain matcher)
11. Open `test/test-i18n.html` (or `node test/test-i18n.js`) — catalog mapping and key-match checks pass

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
Install 4.2.x / 4.3.x data then load 4.4.0 — history/cases/playbooks intact. Language defaults to System (browser language mapped onto the seven catalogs; unknown → English). Labs flags cannot be enabled. Offline packs show hundreds of entries; Install does not grow IndexedDB with pack payloads. A stored ThreatCrowd enable flag is ignored (no context-menu item).

## v4.4.0
1. Settings → Appearance → Language — options are System plus native names (English, Español, Português, Français, Deutsch, Русский, 简体中文)
2. Switch to Spanish — sidebar, Settings, empty states, and toasts localize without reloading the browser
3. Popup and an open page (pivot / palette) pick up the same locale
4. Switch to Russian and Simplified Chinese — glyphs render (system CJK/Cyrillic fallbacks, not tofu boxes)
5. Context menu titles match the chosen language; playbook names and OSINT service names stay as stored
6. `node test/test-i18n.js` — missing key falls back to English; `system` + `pt-BR` → `pt`; unknown browser locale → `en`

## v4.3.1
1. Bare domain on `test/test-history.html` (e.g. `google.com`) and a workbench domain row — pivot shows **Open link**
2. Domain inside `<a href="https://example.com/full/path">example.com</a>` — Open link follows that href
3. CWE IoC (e.g. `CWE-79`) — pivot/tool opens cwe.mitre.org; ThreatCrowd is gone
4. GreyNoise on an IP — `viz.greynoise.io/ips/…`; RDAP on a domain — `client.rdap.org`

## v4.3.0 honesty
1. **Offline packs** — ATT&CK / LOLBAS / GTFOBins entry counts are large; search `T1059.001`, `certutil`, `bash`
2. **Labs** — Coming soon; no checkboxes; export/dedupe live in Settings → Workspace
3. **STIX** — buttons disabled (· soon) on pivot, extract, and case export; JSON/Markdown/CSV still work
4. **Case → Run playbook** — disabled; pivot/extract playbooks still run
5. DevTools **Aperture** panel — Coming soon copy; Bulk extract still parses HAR/text if pasted there
