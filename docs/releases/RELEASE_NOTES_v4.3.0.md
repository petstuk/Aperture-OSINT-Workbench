# Aperture v4.3.0

Fuller offline packs, and the workbench no longer presents unfinished tools as working switches.

## Features

- **Offline packs** — bundled compact indexes for MITRE ATT&CK enterprise (techniques), LOLBAS, and GTFOBins. Lookup stays in the extension file; **Install** only stores a few-byte flag, not a copy of the dataset in IndexedDB. Refresh with `python3 scripts/generate-offline-packs.py`.
- **Labs is Coming soon** — roadmap only. Experimental flags cannot be turned on. Email parser, local LLM, Sigma assist, and the other Labs slices stay off until they are finished.
- **Workspace tools in Settings** — export workspace JSON and dedupe history moved to **Settings → Workspace** (they already worked; they no longer sit on Labs).
- **Popup Feedback** — opens the same GitHub Discussions thread as Settings and the palette.

## Honesty

Unfinished controls are labelled **Coming soon** and disabled:

- STIX copy/export (pivot, inbox pack, bulk extract, case export) — payload is not TIP-valid yet
- Case **Run playbook** — it only ran the first indicator; per-IoC playbooks from the pivot still work
- DevTools HAR panel — use Bulk extract until ingest ships

Graph copy states that edges are case co-occurrence, not link analysis.

## Notes

No change to permissions or the local-only model. Network use is still the OSINT tabs you open.

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.3.0.zip
```
