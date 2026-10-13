# AMO / Store Submission Checklist — Aperture v4.5.0

## Pre-submit
- [ ] Version `4.5.0` in `extension/manifest.json`
- [ ] `./scripts/package.sh` builds clean zip (`aperture-osint-v4.5.0.zip`)
- [ ] No remote code / no minified obfuscated bundles
- [ ] Fonts bundled locally under `extension/fonts/`
- [ ] Release notes attached (`docs/releases/RELEASE_NOTES_v4.5.0.md`)
- [ ] Open `test/test-ioc-utils.html` — all checks pass
- [ ] `node test/test-i18n.js` — all checks pass (pt-BR / zh-Hant mappings)

## Functional
- [ ] Context menu “Aperture OSINT”
- [ ] Popup detect + tools + playbooks
- [ ] Dashboard overview / extract / cases / playbooks
- [ ] Overlay default OFF; enable from popup Settings
- [ ] Disabled domains: add host → overlays off on that host/subdomains; remove restores
- [ ] Settings → Language switches workbench, popup, and on-page UI (Portugal vs Brasil; Simplified vs Traditional Chinese)
- [ ] Store / about:addons name follows the **browser** language, not the in-app setting
- [ ] Migration from prior 4.0.x / 4.4.0 data

## Listing SEO tips
- Keep “OSINT” and “SOC” in title/summary
- Mention former name “SOC OSINT Search” for continuity
- Screenshots show real empty→populated flows (no fake seed data)
- Ask happy users for reviews after first successful playbook (in-app toast, once)

## Upload
- Firefox: https://addons.mozilla.org/developers/addon/soc-osint-extension/versions/submit/
- Chrome: developer dashboard → new package
