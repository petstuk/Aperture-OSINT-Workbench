# Release Notes — Aperture v3.1.0

Detection accuracy release (Sprint 1).

## Fixes
- **refang:** removed dead `(\.)` backslash pattern; added `[dot]`/`{dot}`/`(dot)`, `[//]`, `[/]`, `hxxps://`, `[at]`+`[dot]` email combos, and `dot` word-form
- **Domains:** curated TLD allowlist + compound TLDs (`co.uk`, …); **file extensions blocked** (`.html`, `.js`, `.dll`, `.bin`, …); version-like tokens (`v2.3.0`, `1.2.3`) rejected
- **Hashes:** only exact 32/40/64 hex runs (no suffixes of longer blobs; colon fingerprints ignored)
- **On-page overlays:** scan via mapped refang so **defanged** IoCs (`1.1.1[.]1`, `hxxp://…`) highlight correctly; page keeps defanged display while actions use refanged values

## Tests
- `test-ioc-utils.html` + `test-ioc-utils.js` corpus (open in a browser or run under Node)

## Package
```bash
./package-for-firefox.sh
# → aperture-osint-v3.1.0.zip
```
