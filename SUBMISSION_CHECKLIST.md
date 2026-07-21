# AMO / Store Submission Checklist — Aperture v3.0.1

## Pre-submit
- [ ] Version `3.0.1` in `manifest.json`
- [ ] `./package-for-firefox.sh` builds clean zip
- [ ] No remote code / no minified obfuscated bundles
- [ ] Fonts bundled locally under `fonts/`
- [ ] Release notes attached (`RELEASE_NOTES_v3.0.1.md`)

## Functional
- [ ] Context menu “Aperture OSINT”
- [ ] Popup detect + tools + playbooks
- [ ] Dashboard overview / extract / cases / playbooks
- [ ] Overlay default OFF; enable from popup Settings
- [ ] Migration from 2.3.0 data

## Listing SEO tips
- Keep “OSINT” and “SOC” in title/summary
- Mention former name “SOC OSINT Search” for continuity
- Screenshots show real empty→populated flows (no fake seed data)
- Ask happy users for reviews after first successful playbook (in-app toast, once)

## Upload
- Firefox: https://addons.mozilla.org/developers/addon/soc-osint-extension/versions/submit/
- Chrome: developer dashboard → new package
