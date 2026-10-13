# Aperture v4.5.0

Store-listing locales, Traditional Chinese, and Brazilian Portuguese. Follow-up to the v4.4.0 Language setting ([issue #3](https://github.com/petstuk/Aperture-OSINT-Workbench/issues/3)).

## Features

- **Store / browser chrome** — Chrome and Firefox `_locales` localize the extension name, description, toolbar tooltip, and command names. These follow the **browser** language, not Settings → Language (that is how `_locales` works).
- **Traditional Chinese** — in-app catalog `zh-Hant` (Settings and System when the browser is `zh-TW` / `zh-HK` / `zh-Hant`). Font stack includes PingFang TC / JhengHei / Noto Sans TC.
- **Portuguese split** — `pt` is European Portuguese; `pt-BR` is Brazilian. System maps `pt-PT` → `pt` and `pt-BR` → `pt-BR`.

## Notes

Brand names, OSINT service names, playbook data, and stored case/history text stay untranslated. Translation-quality PRs against `extension/locales/*.json` and `extension/_locales/` are welcome.

No change to permissions or the local-only model.

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.5.0.zip
```
