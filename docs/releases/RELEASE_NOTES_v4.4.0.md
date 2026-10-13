# Aperture v4.4.0

In-app language settings for the workbench, popup, and on-page UI.

## Features

- **Language in Settings → Appearance** — choose **System** or English, Spanish, Portuguese, French, German, Russian, or Simplified Chinese. The preference syncs like Theme (`storage.sync`).
- **Live switch** — workbench, popup, command palette, on-page pivot, type labels, and context menus follow the setting without restarting the browser. Missing keys fall back to English.
- **System default** — maps the browser UI language onto those catalogs (`pt-BR` → Portuguese, `zh-CN` → Simplified Chinese; unknown locales stay English). Traditional Chinese is not a separate catalog in this release.

## Notes

Chrome/Firefox `_locales` still follows the **browser** language, not this toggle, so store listing name/description stay English. Brand names, OSINT service names, playbook data, and stored case/history text are not translated.

Cyrillic and CJK use system font fallbacks (Noto / PingFang / YaHei) on top of IBM Plex. No CJK webfont is shipped.

No change to permissions or the local-only model.

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.4.0.zip
```
