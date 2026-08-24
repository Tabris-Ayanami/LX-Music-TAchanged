# Stage 5 native boundary progress

Date: 2026-08-24
Branch: `hybrid-native`

## This increment

- Routed local artwork and lyric reads through Main/backend. The lyric path preserves same-name `.lrc`, `.krc`, embedded lyrics, encoding detection, KRC decoding, and `[awlrc:...]` parsing.
- Routed download post-processing (metadata tags and `.lrc` writing) through Main/backend. The existing proxy, embedded lyric switches, GBK/UTF-8 BOM behavior, and legacy fallback remain available.
- Routed local-library file metadata construction through a Main IPC endpoint. Native metadata mode now avoids artwork materialization during scans; electron/shadow modes retain the legacy metadata reader and per-file failure behavior.
- Routed downloaded-file path resolution through Main/backend. The existing completed-state, `.ape` exclusion, direct-path preference, and save-directory fallback semantics are unchanged.
- Removed the corresponding Node `fs/path/crypto`, `music-metadata`, and post-processing code from the Renderer main/download workers.

## Evidence

| Measurement | Before | After | Result |
| --- | ---: | ---: | --- |
| `renderer.main.worker.js` | 33,680 B | 27,718 B | -5,962 B (-17.7%) |
| `renderer.download.worker.js` | 355,631 B | 23,039 B | -332,592 B (-93.5%) |
| renderer production JavaScript assets | 6.56 MiB | 6.01 MiB | -0.55 MiB; node_modules JS modules 374 → 291 |
| synchronous `main.js` bundle | 2.95 MiB | 2.95 MiB | unchanged; metadata writer is lazy-loaded |
| production smoke exceptions | n/a | `[]` | pass |

Checks passed in this increment:

- `npm run typecheck`
- `npm run build:main`
- `npm run build:renderer`
- `npm run check:backend-boundaries`
- `npm run test:native-core` (all format/shadow/failure/artwork/library/FFmpeg/HTTP/libmpv checks green; test loader now resolves `@common/@main` and the legacy KRC ESM helper)
- targeted ESLint and `git diff --check`
- `node --test tests/regression/renderer-ipc-listener-lifecycle.test.cjs`
- `npm run smoke:renderer -- --port=9375` (startup, discover/search/local/download/settings routes, playback, volume, visuals, route restore)
- production preload IPC probe for `winMain_create_local_music_infos` on a generated WAV fixture (title/artist/album/duration/path all matched)
- `node --test tests/regression/local-music-detail-shell-and-grid.test.cjs tests/regression/local-music-search-refresh.test.cjs` (5/5)
- populated metadata IPC probe: 16 mixed-format fixtures, 15 valid tracks (one intentionally malformed fixture skipped); first call 251.4 ms, warm repeats 54.0–64.6 ms with stable output ordering and fields
- downloaded-file path IPC probe passed direct path, save-directory fallback, and `.ape` rejection branches
- 100k-track worker probe kept output semantics (`filteredList=50,000`, `canPlayList=100,000`); on a 20k/10k duplicate-heavy comparison the old findIndex/splice loop took 90.8 ms versus 1.7 ms for the counted-ID map (53.4x faster)
- 50k-result search probe returned the same 1,400 matches and stable first/last IDs; a 20k numeric ordering comparison retained tie order and reduced insertion work from 21.6 ms to 4.9 ms

The existing native-core integration suite remains green, including FFmpeg, HTTP fresh/resume byte equality, cancellation, library scan, metadata/artwork, and libmpv capability probing.

## Resource interpretation

This slice primarily reduces Renderer worker code, keeps `music-metadata` out of that worker, and moves scan-time file parsing to Main/native metadata. The main startup bundle stayed at about 2.96 MiB. A dedicated memory delta is not claimed yet because the scan probe used one fixture; the next acceptance probe should scan a populated folder and compare renderer private memory and scan wall time.

The populated probe's post-scan capture reported JS heap 14.7 MiB, browser private bytes 82.98 MiB, 3.6% one-core CPU, 39 threads, and 487 handles. The capture path exposed only the browser process for this temporary profile, so these values are a reproducibility record, not a whole-tree comparison.

The follow-up native library metadata endpoint now batches each scan chunk into one RPC and returns only `filePath`, `title`, `artists`, `album`, and `duration`. A fresh production preload probe with 8 mixed-format files returned all 8 rows in 55.7 ms; a previous warm comparison of the same endpoint invoked once per file in parallel took 43.6 ms. The latency is effectively neutral at this small sample size, but the batch path reduces 8 IPC request/response frames to 1 and removes unused lyric/artwork/extended metadata serialization. The malformed-file fallback remains per-file and is covered by the native integration suite.

After switching the legacy artwork fallback from a renderer data URL to a Main-side cache file, a repeated 10-second production capture on the populated smoke profile reported: FCP 268 ms, renderer private 188.12 MiB, whole Electron tree private 756.11 MiB, CPU 8.1% of one core, 264 threads, and 4,090 handles. The preceding capture in the same run was treated as warm-up because its renderer counters were transiently inflated; the repeated sample is the stable comparison point. The historical reference was FCP 420 ms, renderer private 216.82 MiB, whole private 1059.19 MiB, CPU 18.2%, 320 threads, and 4,628 handles. Process count differs (6 here versus 7 in the reference), so the whole-tree reduction is indicative rather than an isolated attribution claim.

The final stable Stage 5 capture on the same populated profile (10-second sample, after the smoke flow restored `#/local?view=tracks`) reported FCP 276 ms, renderer private 124.20 MiB, whole Electron tree private 759.16 MiB, working set 972.23 MiB, CPU 12.5% of one core, 260 threads, and 4,102 handles across 6 processes. This confirms the reduced renderer private footprint remains reproducible, while the whole-tree value is not treated as a new improvement claim because GPU/utility process residency varied between captures.

## Next

Stage 5 acceptance is complete. Continue with Stage 6 IPC/data-churn profiling: measure repeated list/status requests and background idle after route teardown, then target only changes with a reproducible CPU, memory, or request-count reduction. The populated local-library scan and native download lifecycle probes remain the compatibility gates for any further Worker fallback removal.

### Production IPC lifecycle probe

Using a local throttled HTTP Range fixture through the actual Electron preload IPC:

- fresh native start completed an 8 MiB file;
- pause after 150 ms left a 393,216-byte partial file;
- resume completed to 8,388,608 bytes with SHA-256 `cb5076bf0f34ac13...eb2e53c7`, matching the fixture;
- remove cancelled a partial task and removed the exact output path.

This validates Main/native-core task control rather than only the Rust sidecar in isolation.
