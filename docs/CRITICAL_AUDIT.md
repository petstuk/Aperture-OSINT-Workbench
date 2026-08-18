# Critical feature audit — Aperture 4.2.2

**Audience:** SOC, DFIR, CTI, and security-engineering reviewers  
**Scope:** Product gaps a security professional would notice, grounded in shipped code  
**Not in scope:** Exploit write-ups. This is a capability and trust review, not a pentest.  
**Date:** 18 August 2026

## Verdict

Aperture is a credible **local-first pivot workbench**. Detection, refang, playbooks, cases, and public OSINT tabs are real. What professionals will still mark as missing is the layer that turns a personal OSINT helper into something they can defend in a SOC: **safe handling of live indicators, evidence integrity, TIP/SIEM interchange, and honest Labs**.

Several Labs flags (`vaultEncryption`, `evidenceLocker`, `selfHostedConnectors`, `attackNavigator`, and others) appear in the UI with **no runtime behaviour**. For a security audience that is worse than omitting the feature: it looks like a control that does not exist.

## What is already strong

Keep these; they are why the extension is reviewable.

- Core path needs no accounts, keys, or telemetry (`PRIVACY.md`, Firefox `data_collection_permissions: none`).
- On-page detect is off by default; per-domain disable exists for SIEM/EDR consoles.
- Refang/defang, bulk extract, clipboard packs, session capture, skip-private-IP on playbooks.
- `openLink` rejects non-http(s) URLs.
- Public pivots cover a solid free-tool set (VT, AbuseIPDB, URLScan, Shodan, Censys, OTX, crt.sh, RDAP, Wayback, URLhaus, ThreatFox, NVD, BGP HE, ATT&CK).
- Local enrichment is syntactic only and labelled as such (“no network”).
- Zero-build, readable runtime — store reviewers and forks can audit the files they ship.

## Findings

Severity is how loudly a security professional would raise it in a tool evaluation, not CVSS.

### P0 — would stall enterprise adoption or destroy trust

| ID | Gap | Why it matters | Evidence |
|---|---|---|---|
| P0-1 | **At-rest encryption is a flag, not a feature** | Case IoCs, notes, and timeline sit in `storage.local` / IndexedDB in the clear. A profile copy or disk image is a full case file. The Labs toggle `vaultEncryption` does nothing. Reviewers will treat that as a false control. | `aperture-features.js` default; no encrypt/decrypt path in `aperture-store.js` or `background.js` |
| P0-2 | **Content scripts inject on every URL even when detect is off** | `content_scripts.matches: <all_urls>` plus `host_permissions: <all_urls>`. Overlay off still loads `ioc-utils.js`, `palette.js`, `indicator-card.js`, `content.js` on every page. Many SOCs block this class of extension unless host access is optional. | `extension/manifest.json` |
| P0-3 | **STIX 2.1 export will fail TIP ingest** | Bundle IDs are `indicator--aperture-{i}-{Date.now()}`, not UUIDs. No `marking-definition` (TLP), no `identity`, no `relationship`, no `observed-data`. Labels are free-text tags. MISP/OpenCTI/TheHive will reject or silently degrade this. | `IOCUtils.clipboardPack('stix')` in `ioc-utils.js` |
| P0-4 | **Playbooks sync; cases do not encrypt** | Playbooks, enabled services, overlay, and disabled domains go through `storage.sync` (browser-vendor account). Org playbooks and tool lists can leave the endpoint. Cases stay local but unencrypted. Split model is undocumented for security review. | `background.js` `storageSet('sync', …)` |
| P0-5 | **No TLP / handling caveat on cases or exports** | CTI teams will not paste indicators into a tool that cannot stamp TLP:RED vs TLP:CLEAR on the case and on every export. Markdown/JSON/STIX omit handling. | Case export in `dashboard.js` |

### P1 — expected in daily SOC / DFIR / CTI work

| ID | Gap | Why it matters | Fit with local-first |
|---|---|---|---|
| P1-1 | **No “never visit the live indicator” mode** | `openLink` opens the actual http(s) URL. Playbooks open OSINT UIs (good), but there is no global passive-only policy, no warning on live URL copy, no container/isolated profile. Accidental detonation is a classic DFIR failure. | Local flag; open OSINT tabs only; block `openLink` unless explicitly armed |
| P1-2 | **No SIEM query packs** | Analysts need copy-as Splunk SPL, Microsoft Sentinel/Defender KQL, Elastic Lucene/EQL, and CrowdStrike. Clipboard packs are raw / defang / markdown / CSV / STIX only. | Pure local string templates |
| P1-3 | **No MISP / OpenCTI / TheHive / Cortex connector** | README tells forks to keep org connectors behind flags, but Labs `selfHostedConnectors` is a no-op. Without even a documented JSON shape for a local connector, the workbench is a dead-end after triage. | Opt-in localhost / self-hosted only; never a vendor cloud |
| P1-4 | **Sigma assist is a stub; YARA is named but absent** | `sigmaAssist` concatenates IPs/domains into one experimental rule. Hashes, URLs, and emails are ignored. No YARA despite `sigmaYaraAssist`. Detection engineers will try it once and stop trusting Labs. | Improve the generator or hide it until it is real |
| P1-5 | **No evidence capture of what the analyst saw** | Session capture logs IoCs into a case. There is no hashed screenshot, HAR, or page snapshot of the OSINT result. `evidenceLocker` is a flag only. Court/IR reports need “I observed X on VirusTotal at T”. | Local hashes of captured blobs; no upload |
| P1-6 | **No analyst audit log** | Case timeline is free-text events (`Ran playbook …`). There is no append-only log of verdict changes, exports, playbook runs, or Labs API calls with timestamps. | Local append-only store |
| P1-7 | **Workspace import overwrites without validation** | `importWorkspace` writes history, cases, and playbooks if arrays are present. No schema version gate, merge, or diff. A hostile or corrupt JSON file clobbers the investigation store. | Validate, preview, merge |
| P1-8 | **Relationship graph is a clique** | Every pair of indicators in a case becomes an edge. That is co-occurrence, not “URL contains host, host resolves to IP”. Analysts will assume link analysis they did not get. | Derive edges from `enrichFacts` (host, registrable domain, hash-of-file) |
| P1-9 | **Optional host permissions not used** | Chrome/Firefox support `optional_host_permissions` so detect can be granted per site. Hard `<all_urls>` is the single biggest store- and enterprise-policy objection. | Request on first Enable detect |
| P1-10 | **False-positive / known-good allowlist is missing** | Disabled domains skip on-page scan only. There is no indicator allowlist (corp CIDRs, sinkholes, VT “harmless” hashes, internal hostnames) that suppresses inbox noise and playbook runs. | Local list; reuse `skipPrivateIp` pattern |
| P1-11 | **Case “Run playbook” uses only the first indicator** | Multi-IoC cases are the normal IR shape. Running the case playbook against `indicators[0]` looks like a bug in a SOC demo. | Fan-out with existing throttle / skip-private |
| P1-12 | **Passive DNS and DNS record pivots are missing** | Domain recon playbook prompt mentions “passive DNS hits” but no PDNS, MX/TXT/SPF/DMARC, or NS tool is wired. crt.sh + RDAP is incomplete DNS hygiene. | Public UIs: SecurityTrails community, MXToolbox, DNSDumpster, CIRCL PDNS, viewdns |
| P1-13 | **No file-drop hashing** | DFIR drops a sample to get MD5/SHA-1/SHA-256 locally. Aperture only parses hashes that are already text. | Web Crypto locally; never upload the file |
| P1-14 | **API enrichment is OTX IPv4 only** | Labs `apiEnrichment` fetches one OTX path. URLhaus POST is refused. No VT, AbuseIPDB, GreyNoise, or URLScan API adapters. Professionals who opt in expect a small, explicit provider list — or a clear “tabs only” product. | Session keys already the stated model |

### P2 — specialists will notice; not blockers for a personal workbench

| ID | Gap | Notes |
|---|---|---|
| P2-1 | Sandbox pivots | Hybrid Analysis, Any.run, Joe Sandbox, Tria.ge, CAPE — hash/URL playbooks currently stop at VT + MalwareBazaar |
| P2-2 | Crypto explorers | BTC/ETH map to VirusTotal only; Blockchain.com / Etherscan / WalletExplorer are the usual first click |
| P2-3 | Email authentication | Header parser is `Header: value` per line. No folded headers, `.eml` MIME, Received-chain hops, or SPF/DKIM/DMARC pass/fail extraction |
| P2-4 | Hash algorithms | MD5 / SHA-1 / SHA-256 only. No SHA-512, ssdeep, TLSH, imphash, Vhash |
| P2-5 | Local GeoIP / ASN DB | IP “enrichment” is RFC1918/scope only. A shipped MaxMind-lite or ASN CSV pack would match the offline-packs story |
| P2-6 | ATT&CK Navigator | `attackNavigator` flag unused. Pack is 14 techniques. Navigator layer JSON is the expected export |
| P2-7 | Signed playbook share codes | `APX\|…` codes have no signature or publisher. Org SOCs will not import unsigned playbooks |
| P2-8 | Classification workflow | No case state machine (open / contained / closed), assignee, or shift-handoff note beyond tags + verdict |
| P2-9 | Firefox add-on ID | `gecko.id` is still `soc-osint-search@example.com` — looks unfinished on AMO review |
| P2-10 | Manifest CSP | No `content_security_policy` extension_pages tightening. Reviewers ask for it on MV3 listings |
| P2-11 | Tor / `.onion` handling | Onion type exists; pivots go to VT/OTX. No warning that the browser is not Tor |
| P2-12 | DevTools HAR ingest | Panel exists; `devtoolsPanel` flag is unused. HAR → IoC extract would be a high-signal DFIR feature if finished |

## Labs honesty report

Flags in `extension/aperture-features.js` vs actual handlers:

| Flag | Reality |
|---|---|
| `useIndexedDb` | Implemented (`ApertureStore`) |
| `localLlm` | Implemented (Ollama `127.0.0.1:11434`) |
| `apiEnrichment` | Partial — OTX IPv4 GET only |
| `emailParser` | Partial — unfolded headers + `IOCUtils.parse` |
| `pageIocDiff` | Partial — URL-keyed IoC set diff |
| `confidenceHints` | Partial — echoes prior local verdict |
| `sigmaYaraAssist` | Partial — Sigma string only, no YARA |
| `workspaces` | Partial — export/import; no workspace switcher |
| `devtoolsPanel` | UI exists; flag unused |
| `scanWorker` | `ioc-scan-worker.js` exists; flag unused |
| `vaultEncryption` | **No-op** |
| `evidenceLocker` | **No-op** |
| `selfHostedConnectors` | **No-op** |
| `pluginSdk` | **No-op** |
| `attackNavigator` | **No-op** |
| `detectionWave2` | **No-op** (wave-2 types already ship unconditionally) |
| `vimMode` | **No-op** |
| `geoMap` | **No-op** |
| `localApi` | **No-op** |
| `crossTabMesh` | **No-op** |
| `airgapSync` | **No-op** |
| `huntAgent` | **No-op** |
| `multiMonitorLayouts` | **No-op** |

Recommendation: hide no-op flags from Labs, or label them “reserved”. Shipping `vaultEncryption` as a checkbox is a credibility problem.

## Suggested build order (local-first)

1. **Trust** — remove or implement `vaultEncryption`; stop injecting content scripts when overlay is off (or move to optional host permissions); validate workspace import.
2. **Safe pivot** — passive-only mode; known-good allowlist; case playbook fan-out; never-open-live-URL default.
3. **Interchange** — valid STIX 2.1 (UUIDs, TLP markings, SCO objects); copy-as KQL/SPL; MISP event JSON and/or OpenCTI observable bundle as files (no cloud).
4. **Evidence** — append-only audit log; hashed export; optional screenshot/HAR into the case.
5. **Detection engineering** — real Sigma (and YARA) from typed IoCs, or remove the Labs entry; ATT&CK Navigator layer from case techniques.
6. **Enrichment** — PDNS + DNS record pivots; file-drop hashing; sandbox + explorer URLs; optional local ASN/Geo pack.

Do not add a mandatory cloud, telemetry, or synced case store. That would contradict the product that already exists.

## How this was reviewed

Read: `extension/manifest.json`, `aperture-features.js`, `aperture-store.js`, `aperture-packs.js`, `background.js` (pivots, Labs handlers, storage), `ioc-utils.js` (types, tools, STIX, enrich), `dashboard.js` (cases, Labs UI, export), `content.js`, `PRIVACY.md`, `README.md`.
