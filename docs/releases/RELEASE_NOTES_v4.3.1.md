# Aperture v4.3.1

Patch for pivot Open link and a few public-tool destinations.

## Fixes

- **Open link on domains** — the pivot navigation band shows for URL and domain IoCs even when the highlight is not inside a page `<a href>` (workbench rows included). A real `http(s)` href still wins; unusable schemes (`javascript:`, `mailto:`) fall back to the indicator instead of hiding the button.
- **GreyNoise** — IP pivots open `viz.greynoise.io/ips/…` instead of the old query page.
- **RDAP** — domain pivots open the RDAP client (`client.rdap.org`) instead of `rdap.org/domain/…`.
- **Context menu** — services with no URL template (including a leftover ThreatCrowd flag in storage) are skipped so the menu does not grow dead items.

## Improvements

- **CWE** — CWE IoCs pivot to `cwe.mitre.org` and canonicalize to uppercase. ThreatCrowd is removed (the service is gone).

## Notes

No change to permissions or the local-only model.

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.3.1.zip
```
