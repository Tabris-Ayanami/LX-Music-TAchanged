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
| `renderer.main.worker.js` | 33,680 B | 27,863 B | -5,817 B (-17.3%) |
| `renderer.download.worker.js` | 355,631 B | 23,039 B | -332,592 B (-93.5%) |
| synchronous `main.js` bundle | 2.95 MiB | 2.95 MiB | unchanged; metadata writer is lazy-loaded |
| production smoke exceptions | n/a | `[]` | pass |

Checks passed in this increment:

- `npm run typecheck`
- `npm run build:main`
- `npm run build:renderer`
- `npm run check:backend-boundaries`
- targeted ESLint and `git diff --check`
- `node --test tests/regression/renderer-ipc-listener-lifecycle.test.cjs`
- `npm run smoke:renderer -- --port=9375` (startup, discover/search/local/download/settings routes, playback, volume, visuals, route restore)
- production preload IPC probe for `winMain_create_local_music_infos` on a generated WAV fixture (title/artist/album/duration/path all matched)
- `node --test tests/regression/local-music-detail-shell-and-grid.test.cjs tests/regression/local-music-search-refresh.test.cjs` (5/5)
- populated metadata IPC probe: 16 mixed-format fixtures, 15 valid tracks (one intentionally malformed fixture skipped); first call 251.4 ms, warm repeats 54.0–64.6 ms with stable output ordering and fields
- downloaded-file path IPC probe passed direct path, save-directory fallback, and `.ape` rejection branches

The existing native-core integration suite remains green, including FFmpeg, HTTP fresh/resume byte equality, cancellation, library scan, metadata/artwork, and libmpv capability probing.

## Resource interpretation

This slice primarily reduces Renderer worker code, keeps `music-metadata` out of that worker, and moves scan-time file parsing to Main/native metadata. The main startup bundle stayed at about 2.96 MiB. A dedicated memory delta is not claimed yet because the scan probe used one fixture; the next acceptance probe should scan a populated folder and compare renderer private memory and scan wall time.

The populated probe's post-scan capture reported JS heap 14.7 MiB, browser private bytes 82.98 MiB, 3.6% one-core CPU, 39 threads, and 487 handles. The capture path exposed only the browser process for this temporary profile, so these values are a reproducibility record, not a whole-tree comparison.

After switching the legacy artwork fallback from a renderer data URL to a Main-side cache file, a repeated 10-second production capture on the populated smoke profile reported: FCP 268 ms, renderer private 188.12 MiB, whole Electron tree private 756.11 MiB, CPU 8.1% of one core, 264 threads, and 4,090 handles. The preceding capture in the same run was treated as warm-up because its renderer counters were transiently inflated; the repeated sample is the stable comparison point. The historical reference was FCP 420 ms, renderer private 216.82 MiB, whole private 1059.19 MiB, CPU 18.2%, 320 threads, and 4,628 handles. Process count differs (6 here versus 7 in the reference), so the whole-tree reduction is indicative rather than an isolated attribution claim.

## Next

Measure a populated local-library scan and a real native download lifecycle in the production app (start/progress/pause/resume/refresh-url/complete), then compare process private memory, CPU, thread, and handle counts against the recorded baseline before removing more Worker fallbacks.

### Production IPC lifecycle probe

Using a local throttled HTTP Range fixture through the actual Electron preload IPC:

- fresh native start completed an 8 MiB file;
- pause after 150 ms left a 393,216-byte partial file;
- resume completed to 8,388,608 bytes with SHA-256 `cb5076bf0f34ac13...eb2e53c7`, matching the fixture;
- remove cancelled a partial task and removed the exact output path.

This validates Main/native-core task control rather than only the Rust sidecar in isolation.
