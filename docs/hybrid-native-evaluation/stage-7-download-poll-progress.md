# Stage 7 native download poll progress

Date: 2026-08-24
Branch: `hybrid-native`

## Main status polling cadence

`src/main/modules/nativeCore/downloadServices.ts` now schedules native HTTP status checks every 500 ms instead of every 250 ms. This keeps download progress updates at 2 Hz while cutting status RPCs and timer wakeups per active task from 4/second to 2/second. The legacy Downloader already emits progress at roughly one-second intervals, so the change stays within the existing UI cadence envelope.

This is recorded as a deterministic request-rate reduction, not a claimed whole-process CPU delta: the current native-core integration harness exercises the HTTP job but does not expose Main-side poll counters. A future production download probe should count `download.http.status` calls and capture idle/active CPU before changing the cadence again.

## Batched status RPC

The Main native download scheduler now uses one shared 500 ms timer and calls `download.http.status_many` for all active jobs. The native core returns only the compact status rows and removes terminal jobs after returning them. This replaces one timer and one IPC request per active task with one timer and one request per poll window, while keeping each task's progress, completion, URL-refresh, pause, resume, and cancellation behavior unchanged.

The native-core integration test started two concurrent HTTP jobs and completed both through the batch endpoint. It needed 2 batch RPCs (1 request per poll window); the equivalent per-task path would have made 4 requests. That is a measured 50% reduction in status IPC frames for this two-task run. Both fresh and resume outputs remained byte-identical at 466,008 bytes.

## Compatibility evidence

- `npm run typecheck` passed.
- `npm run build:main` passed; `main.js` remains 2.96 MiB.
- `npm run test:native-core` passed all metadata, artwork, library, FFmpeg, HTTP fresh/resume, cancellation, failure rollback, and libmpv checks. The HTTP fixture remained 466,008 bytes with exact fresh/resume equality.
- The same integration run verified the new `download.http.status_many` capability with two concurrent jobs: `rpcCalls=2` versus an estimated `4` separate status calls for the same poll windows.
- Existing production native download lifecycle evidence remains green: pause left a partial file, resume restored the exact 8 MiB hash, and remove deleted the requested output. The cadence-only change does not alter task control or completion state handling.

No functionality, source selection, URL refresh, pause/resume, conversion, or output-path semantics changed.

## Next

Next, run the production Electron download lifecycle probe with the shared scheduler and capture active/paused/background CPU. If idle CPU remains material, investigate an event/completion signal; otherwise retain 2 Hz polling as the compatibility-safe boundary.
