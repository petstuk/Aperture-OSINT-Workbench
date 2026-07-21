# storage.local Migration — completed in v3.0.0

History and cases live in `browser.storage.local`.  
Settings (`enabledServices`, `overlayEnabled`, `playbooks`) stay in `browser.storage.sync`.

On install/update, `background.js` `migrateStorage()`:
1. Copies `sync.iocHistory` → `local.iocHistory` when local is empty, then removes sync history
2. Migrates `customCombinations` → `playbooks` when playbooks missing
3. Seeds default playbooks on fresh install
4. Initializes `local.cases` to `[]`

See `RELEASE_NOTES_v3.0.0.md`.
