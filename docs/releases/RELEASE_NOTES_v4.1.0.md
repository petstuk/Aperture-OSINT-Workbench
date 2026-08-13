# Aperture v4.1.0

## Features

- **Disabled domains** — exclude hosts from on-page IoC detect and the page palette (popup Settings → Disabled domains). Suffix match: `crowdstrike.com` covers `falcon.crowdstrike.com`; use **Disable on this site** for the active tab. Synced via `storage.sync.disabledDomains`. Separate from case-session capture excludes.

## Improvements

- **Workbench / pivot UI** — shared pivot card layout polish on dashboard and on-page surfaces
- **Branding** — extension icon in popup header; store listing assets/checklist updates

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.1.0.zip
```
