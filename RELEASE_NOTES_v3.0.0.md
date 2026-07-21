# Release Notes — Aperture v3.0.0

Major release: rebrand to **Aperture — OSINT Workbench**, Manifest V3, full UI overhaul from the design handoff, and Bugbot fixes.

## Highlights

- **Aperture UI** — IBM Plex design system, popup launcher, full dashboard workbench
- **Manifest V3** — service worker background, `action` popup, MV3 host permissions
- **Playbooks** — replace custom combinations; import/export share codes (`APX|…`)
- **Cases** — local investigation grouping with timeline and exportable JSON reports
- **Bulk extract** — refang + classify IoCs locally (IP, domain, URL, hash, email, CVE, BTC, ASN)
- **⌘K palette** — tools, playbooks, navigation, recent indicators
- **On-page pivot card** — enrichment, verdicts, tools, playbook run, add-to-case
- **Storage** — history/cases in `storage.local`; settings/playbooks in `storage.sync`; auto-migration from 2.3.0

## Bug fixes

- Overlay toggle race: async `storage.sync.get` no longer overwrites a newer `onChanged` value
- URL IoC matches strip trailing punctuation / unmatched closers
- `getOverlayConfig` error path returns in-memory `enabledServices` defaults (not `{}`)
- `searchService` returns `{ success: false }` for unknown service names

## Store listing copy (draft)

**Name:** Aperture — OSINT Workbench  

**Short description:**  
Local OSINT workbench for SOC analysts — IoC pivot, playbooks, cases. No API keys. Formerly SOC OSINT Search.

**Detailed description (keyword-aware):**  
Aperture is an OSINT browser extension for security operations and threat intelligence workflows. Select an indicator of compromise (IP, domain, hash, URL, email, CVE) and open public tools such as VirusTotal, AbuseIPDB, Shodan, URLScan, Censys, AlienVault OTX, GreyNoise, and more.

Everything runs locally. There are no accounts and no API keys. Optional on-page detection highlights IoCs in the page you’re viewing; clicking opens a pivot card for verdicts and tool launches. Use playbooks to open a sequenced set of OSINT tabs in one click, and cases to keep related indicators together.

Formerly published as SOC OSINT Search.

**Privacy / permissions:**  
- `storage` — settings, playbooks, local history and cases  
- `contextMenus`, `tabs`, `activeTab` — right-click search and opening OSINT sites  
- Host access — optional page highlights and selection workflows; no remote code; no telemetry  

## Test plan

1. Fresh MV3 load (Chrome + Firefox): popup, dashboard, context menu
2. Upgrade from 2.3.0 profile: history migrated to local; combinations → playbooks
3. Overlay toggle spam: enable/disable quickly — highlights match final state
4. URL like `https://evil.example/path).` — match without trailing `).`
5. Unknown `searchService` name → failure response
6. Bulk extract → add to case → run playbook → export report
7. ⌘K / Ctrl-K on popup and dashboard

## Package

```bash
./package-for-firefox.sh
# → aperture-osint-v3.0.0.zip
```
