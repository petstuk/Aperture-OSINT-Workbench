# Aperture — OSINT Workbench (browser extension)

Local-first **OSINT browser extension** for SOC analysts. Pivot on IPs, domains, hashes, URLs, emails, CVEs, and more across VirusTotal, AbuseIPDB, Shodan, URLScan, and other public tools — **no API keys, no accounts, no telemetry**.

Formerly **SOC OSINT Search**. Version **4.0.0**.

## Features

- **Popup launcher** — paste an indicator, run quick tools or playbooks, open the full workbench
- **Dashboard workbench** — triage overview, bulk extract, cases, playbooks, relationship graph, offline packs, Labs
- **Playbooks** — ordered multi-tool workflows with delay/concurrency options; import/export share codes
- **Cases** — group indicators, verdicts, notes, tags, timeline, session capture, JSON/MD/CSV export
- **On-page detect** (opt-in) — highlight IoCs; click for pivot card (notes, tags, packs, related)
- **Side panel page** — compact investigation surface (tab fallback; uses Chrome sidePanel API when present)
- **Right-click search** — context menu on selected text
- **⌘K / Ctrl-K** command palette (also Ctrl+Shift+K / Ctrl+Shift+O commands)
- **Chrome + Firefox** via Manifest V3

## Install

### Firefox (140+)
1. `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`
2. Or install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/soc-osint-extension/) when the v4 listing is live

### Chrome / Chromium
1. `chrome://extensions` → Developer mode → Load unpacked → select this folder
2. Package for store upload: `./package-for-firefox.sh` → `aperture-osint-v4.0.0.zip`

## Privacy

- Parsing and enrichment run **entirely on-device**
- The only network activity is **tabs you open** to public OSINT sites (unless you enable Labs API/LLM flags)
- On-page highlights are **off by default**
- Host access (`<all_urls>`) is used for context-menu selection and optional page highlights
- Firefox data collection declaration: **none** (`data_collection_permissions`)

## Supported services

VirusTotal, AbuseIPDB, URLScan, Shodan, Censys, AlienVault OTX, ThreatCrowd, IBM X-Force Exchange, MalwareBazaar, GreyNoise, Spur, Have I Been Pwned, crt.sh, RDAP, Wayback Machine, URLhaus, ThreatFox, NVD, BGP HE, MITRE ATT&CK

## Development

Plain HTML/CSS/JS — **no build step**, no bundler, no minifier. Reviewers can read every shipped file as-is.

```bash
./package-for-firefox.sh
```

IoC detection tests (open in a browser):

```text
test-ioc-utils.html
```

| Surface | Files |
|---|---|
| Popup | `popup.html`, `popup.js` |
| Dashboard | `dashboard.html`, `dashboard.js` |
| Side panel | `sidepanel.html`, `sidepanel.js` |
| On-page | `content.js`, `content.css` |
| Background | `background.js` (+ `ioc-utils.js`, packs/store/features) |
| Shared UI | `aperture.css`, `palette.js`, `fonts/` |
| Labs / DevTools | Labs screen in dashboard; `devtools.html` |

Design reference (not shipped in the zip): [`design/README.md`](design/README.md)  
Release notes: [`RELEASE_NOTES_v4.0.0.md`](RELEASE_NOTES_v4.0.0.md)

## Upgrade from 3.x

- New dashboard screens: Graph, Offline packs, Labs
- History/cases gain optional tags, sources, templates
- Feature flags in Labs default **off**

## License

See [LICENSE](LICENSE).
