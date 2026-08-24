# Stage 7 native download poll progress

Date: 2026-08-24
Branch: `hybrid-native`

## Main status polling cadence

`src/main/modules/nativeCore/downloadServices.ts` now schedules native HTTP status checks every 500 ms instead of every 250 ms. This keeps download progress updates at 2 Hz while cutting status RPCs and timer wakeups per active task from 4/second to 2/second. The legacy Downloader already emits progress at roughly one-second intervals, so the change stays within the existing UI cadence envelope.

This is recorded as a deterministic request-rate reduction, not a claimed whole-process CPU delta: the current native-core integration harness exercises the HTTP job but does not expose Main-side poll counters. A future production download probe should count `download.http.status` calls and capture idle/active CPU before changing the cadence again.

## Compatibility evidence

- `npm run typecheck` passed.
- `npm run build:main` passed; `main.js` remains 2.96 MiB.
- `npm run test:native-core` passed all metadata, artwork, library, FFmpeg, HTTP fresh/resume, cancellation, failure rollback, and libmpv checks. The HTTP fixture remained 466,008 bytes with exact fresh/resume equality.
- Existing production native download lifecycle evidence remains green: pause left a partial file, resume restored the exact 8 MiB hash, and remove deleted the requested output. The cadence-only change does not alter task control or completion state handling.

No functionality, source selection, URL refresh, pause/resume, conversion, or output-path semantics changed.

## Next

Instrument one real Electron native download to count status RPCs and capture active/paused/background CPU, then decide whether 500 ms is sufficient or whether a completion/event-driven native status path is justified.
