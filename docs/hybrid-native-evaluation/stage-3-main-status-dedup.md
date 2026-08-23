# Stage 3 main-process player-status deduplication

Date: 2026-08-24

## Change

`src/main/event/AppEvent.ts` now uses `applyPlayerStatusPatch` to update the
shared player-status snapshot and emit only changed fields. An unchanged patch
returns without waking taskbar, tray, or OpenAPI listeners. The comparison uses
`Object.is`, so `NaN` remains stable as well.

## Verification

- `node --test tests/regression/main-player-status-dedup.test.cjs`: 2 passed.
- Targeted ESLint: passed.
- `npx tsc --noEmit -p src/main/tsconfig.json`: passed.
- Synthetic event benchmark (100,000 patches, five listeners doing
  representative object iteration/JSON serialization): for unchanged patches,
  listener calls reduced from 500,000 to 0 and elapsed time changed from
  446.0 ms to 135.1 ms; for changing patches, all 500,000 listener calls were
  preserved and elapsed time was 455.7 ms versus 443.6 ms. These measurements
  isolate duplicate-event overhead and are not whole Electron memory claims.

The renderer-side sender already deduplicates its own status patches; this main
boundary also protects direct main-process callers and future native adapters.
No user-visible status semantics change: the shared snapshot is still updated
for every changed value, and only redundant notifications are suppressed.
