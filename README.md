# Aperture — OSINT Workbench (browser extension)

Local-first **OSINT browser extension** for SOC analysts. Pivot on IPs, domains, hashes, URLs, emails, CVEs, and more across VirusTotal, AbuseIPDB, Shodan, URLScan, and other public tools — **no API keys, no accounts, no telemetry**.

Formerly **SOC OSINT Search**.

## Features

- **Popup launcher** — paste an indicator, run quick tools or playbooks, open the full workbench
- **Dashboard workbench** — triage overview, bulk extract, cases, and playbooks
- **Playbooks** — ordered multi-tool workflows (migrated from custom combinations); import/export share codes
- **Cases** — group indicators, verdicts, notes, timeline, and JSON export
- **On-page detect** (opt-in) — highlight IoCs on any page; click for a pivot card
- **Right-click search** — context menu on selected text
- **⌘K / Ctrl-K** command palette on popup and dashboard
- **Chrome + Firefox** via Manifest V3

## Install

### Firefox (140+)
1. `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`
2. Or install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/soc-osint-extension/) when the v3 listing is live

### Chrome / Chromium
1. `chrome://extensions` → Developer mode → Load unpacked → select this folder
2. Package for store upload: `./package-for-firefox.sh` → `aperture-osint-v3.0.1.zip`

## Privacy

- Parsing and enrichment run **entirely on-device**
- The only network activity is **tabs you open** to public OSINT sites
- On-page highlights are **off by default**
- Host access (`<all_urls>`) is used for context-menu selection and optional page highlights
- Firefox data collection declaration: **none** (`data_collection_permissions`)

## Supported services

VirusTotal, AbuseIPDB, URLScan, Shodan, Censys, AlienVault OTX, ThreatCrowd, IBM X-Force Exchange, MalwareBazaar, GreyNoise, Spur, Have I Been Pwned

## Development

Plain HTML/CSS/JS — **no build step**, no bundler, no minifier. Reviewers can read every shipped file as-is.

```bash
./package-for-firefox.sh
```

| Surface | Files |
|---|---|
| Popup | `popup.html`, `popup.js` |
| Dashboard | `dashboard.html`, `dashboard.js` |
| On-page | `content.js`, `content.css` |
| Background | `background.js` (+ `ioc-utils.js`) |
| Shared UI | `aperture.css`, `palette.js`, `fonts/` |

Design reference (not shipped in the zip): [`design/README.md`](design/README.md)  
Release notes: [`RELEASE_NOTES_v3.0.1.md`](RELEASE_NOTES_v3.0.1.md) · [`v3.0.0`](RELEASE_NOTES_v3.0.0.md)

## Upgrade from 2.x

- History moves to `storage.local` (larger quota)
- Custom combinations become **playbooks** (trigger inferred from tools)
- Settings (`enabledServices`, `overlayEnabled`) stay in `storage.sync`
- Requires Firefox **140+** (Android **142+**) for the built-in data-collection consent key

## License

See [LICENSE](LICENSE).
