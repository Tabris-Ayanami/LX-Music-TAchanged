# Stage 5 native boundary progress

Date: 2026-08-24
Branch: `hybrid-native`

## This increment

- Routed local artwork and lyric reads through Main/backend. The lyric path preserves same-name `.lrc`, `.krc`, embedded lyrics, encoding detection, KRC decoding, and `[awlrc:...]` parsing.
- Routed download post-processing (metadata tags and `.lrc` writing) through Main/backend. The existing proxy, embedded lyric switches, GBK/UTF-8 BOM behavior, and legacy fallback remain available.
- Removed the corresponding Node `fs/path/crypto` and post-processing code from the Renderer main/download workers.

## Evidence

| Measurement | Before | After | Result |
| --- | ---: | ---: | --- |
| `renderer.main.worker.js` | 33,680 B | 30,662 B | -3,018 B (-9.0%) |
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

The existing native-core integration suite remains green, including FFmpeg, HTTP fresh/resume byte equality, cancellation, library scan, metadata/artwork, and libmpv capability probing.

## Resource interpretation

This slice primarily reduces lazy Renderer worker code and cross-context serialization. A fresh memory/CPU delta is not claimed yet because the smoke harness does not exercise a real download or local lyric/artwork read; those are the next acceptance probes. The main startup bundle did not grow synchronously after changing metadata loading to an async chunk.

## Next

Measure a real native download lifecycle in the production app (start/progress/pause/resume/refresh-url/complete), then compare process private memory, CPU, thread, and handle counts against the recorded baseline before removing more Worker fallbacks.
