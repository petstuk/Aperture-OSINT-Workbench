# Handoff: Aperture — OSINT Workbench (redesign of SOC OSINT Search)

## Overview
This is a full product/UX redesign of the existing **SOC OSINT Search** browser extension
(petstuk/OSINTExtension). It keeps the original zero-dependency philosophy — **no API keys,
no accounts, no network calls beyond opening OSINT tools in new tabs** — and expands it into a
serious analyst workbench with two coordinated surfaces:

1. **Popup launcher** — the compact, toolbar-anchored panel (evolution of today's `popup.html`).
2. **Full dashboard** — a page-level workbench (evolution of today's `archive.html`) with a
   triage inbox, cases, bulk extraction, and playbooks.

Plus a **content-script on-page detection** layer (highlight + pivot card) and a global
**⌘K command palette**.

Everything is buildable on **Manifest V3** with only `tabs`, `storage`, `contextMenus`, and a
content script. No new permissions beyond what the current extension already uses.

## About the Design Files
The file in this bundle — `OSINT Workbench.dc.html` — is a **design reference created in HTML**.
It is an interactive prototype that demonstrates the intended look, layout, copy, and behavior.
**It is not production code to ship directly.**

The task is to **recreate these designs in the extension's real environment**: Manifest V3 +
vanilla JS/HTML/CSS (matching the current repo's plain-file, CSP-compliant architecture — no
build step, all JS in external files). If the team prefers, the same designs map cleanly onto a
lightweight framework (Preact/Svelte), but the reference repo is framework-free, so plain files
are the path of least resistance.

The prototype uses a small internal component runtime for streaming preview only — **ignore that
runtime**. Read it for structure, styling, copy, and the IoC-parsing logic (which is real and
directly portable — see "Reusable logic" below).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and interaction states are all
specified below and present in the HTML. Recreate pixel-closely, then wire to real storage and
real tab-opening.

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| bg | `#0b0e14` | app background |
| bg-browser | `#08090c` | faux-browser backdrop (popup/on-page surfaces) |
| top-bar | `#0d1017` | top bar / popup card bg |
| sidebar | `#0c0f15` | dashboard sidebar |
| surface | `#0f131a` | panels / cards |
| surface-2 | `#12161f` | secondary buttons, hover fills, chips |
| surface-3 | `#171c26` | active nav item, hover on secondary btn |
| inset | `#0b0e14` | inset fields (textarea, note box) |
| border | `#1e242f` | panel borders |
| border-2 | `#232a36` | control borders |
| border-3 | `#2f3745` | strong borders (modal, popup card), muted dots |
| divider | `#1a2029` | header/section dividers |
| divider-faint | `#14191f` | row separators |
| text-hi | `#e6e9ef` | headings |
| text | `#d4d8e0` | body |
| text-2 | `#c3cad6` | values / primary row text |
| text-muted | `#8b93a3` | secondary text, inactive nav |
| text-dim | `#5a6273` | meta, mono captions |
| text-faint | `#4b5364` | micro-labels, placeholders |
| accent | `#61afef` | primary interactive (buttons, focus, links, active) |
| accent-hover | `#4f96d6` | primary button hover |
| accent-ink | `#07101a` | text on accent buttons |

### Semantic (indicator type) — used as dots and pills
| Type | Hex |
|---|---|
| ip | `#56b6c2` (cyan) |
| domain / url | `#61afef` (blue) |
| hash | `#c678dd` (violet) |
| email | `#d9a15b` (amber) |
| cve | `#e06c75` (red) |
| btc / wallet | `#98c379` (green) |
| asn / other | `#8b93a3` (grey) |

### Semantic (verdict)
| Verdict | Hex |
|---|---|
| benign | `#98c379` |
| suspicious | `#d9a15b` |
| malicious | `#e06c75` |
| review | `#c678dd` |
| new / unknown | `#8b93a3` |

**Pill recipe** (type & verdict badges): `padding:3px 9px; border-radius:4px; font-size:10px;
font-weight:600; letter-spacing:.05em; text-transform:uppercase; color:<C>;
background:rgba(<C>,.12); border:1px solid rgba(<C>,.28)`.
**Status dot recipe:** `7px` circle, `background:<C>; box-shadow:0 0 6px rgba(<C>,.7)`.

### Typography
- **UI:** `'IBM Plex Sans'`, weights 400/500/600/700.
- **Mono (all IoC values, numbers, codes, timestamps):** `'IBM Plex Mono'`, 400/500/600.
- Scale: page H1 21–22px/600; card titles 13–14px/600; body 12.5–14px; row values 12.5px mono;
  meta 10.5–11px; micro-labels 9.5–10px uppercase, letter-spacing `.1–.14em`, color `text-faint`.

### Spacing / shape
- Radii: controls/chips `5–6px`; panels/cards `8px`; modals/popup/pivot `10–12px`.
- Borders are always hairline (1px). No gradients, no glassmorphism, no drop shadows except on
  floating layers (popup card, pivot card, palette, toast: `0 20px 60px rgba(0,0,0,.6)` / palette
  `0 30px 80px rgba(0,0,0,.7)`).
- Standard control heights: 32–36px. Top bar 52px. Sidebar 216px. Popup card 380px wide.
- Transitions: `.12–.15s` on hover/color/background.

### Motion
- `fadeIn` (opacity 0→1, .12–.2s) on screen switches.
- `fadeUp` (opacity 0 + translateY(6–8px)→0, .16–.25s) on floating layers.
- No looping/decorative animation (dropped the original's animated grid + pulse).

---

## Global Chrome

### Top bar (always visible, 52px, bg `#0d1017`, bottom border `#1a2029`)
- **Left:** logo mark — 26px rounded square, `1.5px` accent border, 9px accent dot with glow —
  then wordmark **APERTURE** (IBM Plex Mono, 14px/600, letter-spacing `.18em`) over the sub-label
  `osint workbench` (9.5px, `.16em`, uppercase, `text-dim`).
- **Center:** ⌘K search trigger — full-width (max 520px) pill, 32px, bg `#0f131a`, border
  `#232a36`; magnifier glyph, placeholder "Search tools, IoCs, playbooks, cases…", and a `⌘K`
  keycap chip on the right. Clicking opens the command palette.
- **Right:** surface segmented control (Dashboard / Popup / On-page) — 3px-padded track bg
  `#0f131a`, active segment bg `#1e242f`/`text-hi`, inactive `text-muted`. Then a "Local · no keys"
  status chip (green glowing dot) and a 28px circular avatar (`AN`).

### Sidebar (dashboard surfaces only, 216px, bg `#0c0f15`)
Three grouped sections with uppercase micro-labels:
- **WORKSPACE:** Overview (▤), Bulk extract (⧉), Playbooks (▷). Active item bg `#171c26`,
  `text-hi`; inactive `text-muted`.
- **CASES:** count on the right; list of case rows — verdict dot + name (12.5px) + `ID · N` meta.
  Clicking opens Case detail.
- **SURFACES** (pinned to bottom): Popup launcher (◱), On-page detect (❖).

---

## Screens / Views

### 1. Overview (Triage) — default dashboard screen
**Purpose:** the analyst's home — everything detected across sessions, ready to pivot or file.
- **Header:** H1 "Triage overview" + subtitle; right-aligned actions **⧉ Bulk extract** (secondary)
  and **+ New case** (primary accent).
- **Stat row:** 4 cards (`repeat(4,1fr)`, gap 12px), each bg `#0f131a`/border `#1e242f`, uppercase
  label + big mono number + tiny sub. Values: Open cases **3** (white), Indicators today **28**
  (accent), Malicious **6** (red), Under review **4** (violet).
- **Body grid:** `1fr 340px`, gap 20px.
  - **Left — Detection inbox:** panel with header ("Detection inbox" + "N indicators"), a column
    header row, then rows. **Row grid is `1fr 92px 32px`** (indicator / verdict pill / pivot
    button). Indicator cell = type-color dot (7px) + mono value (ellipsis) + meta line
    `Type · enrichment · time` (ellipsis). Row hover bg `#12161f`. The ⤢ button opens the pivot
    card (routes to the On-page surface with that indicator focused). **Note:** keep fixed tracks
    small so the value never clips at ~283px panel width.
  - **Right column:** "Open cases" panel (case rows: `ID` + verdict pill, name, `N indicators ·
    updated X`) and a "Quick playbooks" card (rows: ▷ name + `N tools`, run on click).

Seed data (indicators): `45.83.24.19` (ip/malicious), `cdn-update-check.ru` (domain/suspicious),
`9f2b4c1e…c9f04e17` (hash/malicious), `billing@microsoft-secure-login.com` (email/suspicious),
`193.149.190.12` (ip/review), `CVE-2024-3400` (cve/malicious).

### 2. Bulk extract
**Purpose:** paste raw text (log line, email header, alert) → auto-extract every indicator locally.
- Two-column grid `1fr 1fr`, gap 20px.
  - **Left — RAW INPUT:** panel with a mono textarea (320px tall, bg `#0b0e14`), prefilled with a
    sample defanged alert. Footer buttons: **Extract indicators** (primary) + **Clear**.
  - **Right — EXTRACTED:** header shows "N found"; body lists result rows — checkbox
    (accent) + mono value + enrichment meta + type pill. Footer: **Select all / Deselect all**
    toggle, **Add N to case**, **Run playbook on N** (primary). Empty state: ⧉ glyph + prompt.
- The extractor is **real and portable** — see "Reusable logic".

### 3. Case detail
**Purpose:** an investigation grouping indicators, a verdict, notes, and an activity timeline.
- Back link → Overview. Header: `CASE-ID` + verdict pill, H1 case name, meta
  `N indicators · opened … · owner …`; actions **▷ Run playbook** (secondary) + **Export report**
  (primary).
- Grid `1fr 380px`:
  - **Left — Indicators:** rows of `type pill + value/enrichment + verdict pill + up-to-3 tool
    code chips`. Below, a **CASE NOTES** block (inset, with inline colored IoC/family mentions).
  - **Right — Timeline:** vertical connector (9px verdict dots + 1px line), each entry = mono time
    + description. Seed: 6 events from indicator-added → playbook-run → notes → family match →
    lookalike flag → wallet link.

### 4. Playbooks (evolves "custom combinations")
**Purpose:** named, ordered tool workflows that fire on a given indicator type; one click opens
every step in sequence. Exportable as a share code.
- Header + actions **↓ Import code** and **+ New playbook**.
- Card grid `repeat(2,1fr)`, gap 16px. Each card: ▷ + name, an `on <Type>` trigger pill;
  a horizontal chain of step chips (`code + tool name`, separated by `→`); a "Prompt:" hint block
  (left-accent-border, prompts the analyst to record a finding); footer **Run · opens N tabs**
  (primary) + **⇄** share (copies a code like `APX-IPTR-7F2A`).
- Seed playbooks: **IP Triage** (AbuseIPDB→GreyNoise→Shodan→VirusTotal), **Domain Recon**
  (URLScan→VirusTotal→AlienVault→Censys), **Hash Verdict** (VirusTotal→MalwareBazaar→AlienVault),
  **Phish URL** (URLScan→VirusTotal→Spur).

### 5. Popup launcher (surface)
**Purpose:** the toolbar popup — quick pivot without leaving the page. Rendered inside a faux
browser bar; 380px card (bg `#0d1017`, border `#2f3745`, radius 10px).
- Header: logo + APERTURE + ⌘K chip.
- **Detect field** ("⌕ Paste or select an indicator…") + a live detected-indicator block:
  mono value + type pill + local enrichment line + a row of 4 quick tool buttons
  (hover → accent border/text).
- **Run a playbook:** compact rows (▷ name + tab count).
- **Recent:** value + verdict pill rows.
- Footer: **Open full workbench ↗** (routes to Overview).

### 6. On-page detection (surface)
**Purpose:** content script highlights IoCs in the live page; clicking one opens the pivot card.
- Faux advisory article; detected tokens are inline mono spans, tinted by type, dashed underline,
  hover brightens; the header shows "N detected". Tokens are shown **defanged as they appear on the
  page** (`hxxps`, `[.]`) but the pivot operates on the refanged value.
- **Pivot card** (300px, floats top-right, bg `#0d1017`/border `#2f3745`):
  - Header: refanged value (mono, wraps) + type pill + close ×.
  - **LOCAL ENRICHMENT · NO NETWORK:** key/value facts computed offline.
  - **SET VERDICT:** 4 square buttons B/S/M/R (tinted per verdict).
  - **OPEN IN:** wrap of tool buttons for that type; then **▷ <Playbook>** (primary) + **+ Case**.

### 7. Command palette (⌘K, global overlay)
**Purpose:** run any tool/playbook or jump anywhere from the keyboard.
- Full-screen scrim (`rgba(5,7,10,.72)` + blur), centered 600px panel at 12vh, `fadeUp`.
- Autofocused input + `esc` keycap. Grouped, live-filtered results: **Run OSINT tool** (all 11
  services), **Playbooks**, **Navigate** (screens), **Recent indicators**. Each row = 24px icon
  tile + label + right-aligned meta. Empty state when no matches. Footer hints (↑↓ / ↵ / esc) +
  "Everything runs locally — opens tools in new tabs".
- Opens/toggles on **⌘K / Ctrl-K**; **Esc** closes palette and any pivot card.

### Toast
Bottom-center, `#12161f`/border `#2f3745`, green dot + message, auto-dismiss ~2.4s. Fired by every
action (opened tool, ran playbook, set verdict, exported report, copied share code, etc.).

---

## Interactions & Behavior
- **Surface routing** via the top-bar segmented control and sidebar; dashboard screens
  (overview/extract/case/playbooks) show the sidebar, popup/on-page surfaces do not.
- **⌘K / Ctrl-K** toggles the palette; **Esc** dismisses palette + pivot. (Prototype attaches a
  `keydown` listener on `window`; in the extension, wire palette to popup and dashboard, and add
  it to the content script for on-page use.)
- **Pivot** from any indicator (inbox ⤢, on-page token, popup detect block) → pivot card /
  On-page surface.
- **Verdict set / add-to-case / run-playbook / export** currently fire toasts — replace with real
  `browser.storage` writes and `tabs.create` calls.
- **Hover states** everywhere: rows brighten to `#12161f`; secondary buttons brighten border to
  `#2f3745`; tool buttons take accent border+text; primary buttons darken to `#4f96d6`.

## State Management (map to real storage)
Prototype state → real persistence:
- `enabledServices`, `playbooks`, `history` (indicators w/ type, verdict, notes, tools-used,
  timestamps), `cases` (id, name, verdict, indicator refs, timeline, notes) → **`browser.storage.sync`**
  (keep the existing quota-rotation logic from `background.js`).
- Ephemeral (not persisted): current screen/surface, palette open + query, extract results +
  selection, active pivot, toast.
- **Tab orchestration:** running a tool/playbook = `tabs.create` per step (playbook opens all
  steps). This is the only "network" the extension performs.

## Reusable logic (portable as-is)
The prototype's IoC engine is production-quality JS — lift it directly:
- **`refang(s)`** — normalizes `[.]`, `(.)`, `[:]`, `hxxp`, `[at]`, `[@]`.
- **`parse()`** — refang → regex-extract in priority order (hashes 32/40/64-hex → URLs → emails →
  CVEs → BTC → IPv4 → ASN → domains on the leftover string, with URLs/emails stripped first to
  avoid double-matching) → dedupe by `type:value`.
- **`enrich(type, value)`** — offline facts: IPv4 public/RFC1918 + reverse-DNS name; hash algo by
  length; URL host; email domain; CVE year; BTC address format; domain TLD/label-count + punycode
  (`xn--`) warning.
- **`typeLabel`, `toolsFor(type)`, verdict/type color maps.**
Detection scope covers **IPv4, domain, URL, MD5/SHA1/SHA256, email, CVE, BTC wallet, ASN**, plus
defanged variants. (Extend with IPv6, ETH, MITRE ATT&CK IDs as follow-ups.)

## Supported services (unchanged from current extension)
VirusTotal, AbuseIPDB, URLScan, Shodan, Censys, AlienVault OTX, ThreatCrowd, IBM X-Force,
MalwareBazaar, GreyNoise, Spur — each is just a URL template opened in a new tab.

## Assets
- Logo is CSS-drawn (rounded square + glowing dot) — no image needed, but the extension can keep
  using `extension/icons/icon512.png` for the toolbar icon.
- Fonts: IBM Plex Sans + IBM Plex Mono (Google Fonts). Bundle locally for a keyless/offline build.
- No other images; all iconography is Unicode glyphs (▤ ⧉ ▷ ◱ ❖ ⤢ ⇄ ⌕ ◇ →).

## Files
- `OSINT Workbench.dc.html` — the full interactive prototype (all 7 screens + palette + toast).
  Open it in a browser to click through every flow. Read the `<script>`/logic section for the
  IoC engine and seed data; read the markup for exact inline styles per component.
