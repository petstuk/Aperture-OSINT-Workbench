# storage.local Migration Plan (Phase 3B) — post AMO v2.3.0

## Problem
`iocHistory` lives in `browser.storage.sync` (~100KB). Heavy use triggers rotation and data loss of old entries.

## Goal
- Move **archive history only** to `browser.storage.local` (~5MB+ / larger on Firefox)
- Keep in **sync**: `enabledServices`, `customCombinations`, `overlayEnabled`
- One-time migration on `runtime.onInstalled` / startup

## Implementation sketch
1. On startup: if `storage.sync.iocHistory` exists and `storage.local.iocHistory` empty → copy then remove sync history
2. Update all read/write sites:
   - `background.js` (`addToHistory`, rotation helpers, `getArchiveEntry`)
   - `popup.js` (recent history)
   - `archive.js` (full archive CRUD)
   - `check-storage.html` / `debug-storage.html` / tests
3. Prefer local quota for rotation; keep rotation as safety net
4. Bump to v2.4.0; release notes + migration testing (upgrade from 2.3.0 with large archive)

## Test matrix
- [ ] Fresh install: history writes to local
- [ ] Upgrade with sync history: migrated once, not duplicated
- [ ] Settings still sync across devices
- [ ] Overlay / combinations unchanged
- [ ] Export/import still works

## Status
Deferred until after v2.3.0 AMO approval. Do not mix into the v2.3.0 content-script review.
