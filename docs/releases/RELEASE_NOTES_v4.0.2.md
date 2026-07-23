# Aperture v4.0.2

## Fixes

- **Pivot / tool opens** — storage migration called `normalize` outside its scope when local history already existed, which threw `normalize is not defined` and blocked actions such as opening VirusTotal from the on-page pivot card
