# Stage 6 IPC and data-churn progress

Date: 2026-08-24
Branch: `hybrid-native`

## Queue filter structured-clone reduction

`filterMusicList` runs in the Renderer main Worker through Comlink. The normal playback path needs only the filtered queue; the full playable queue is needed only when every entry has already been consumed and the played history must be cleared. The Worker now returns an empty `canPlayList` for the normal path and keeps the full fallback list for the history-reset path.

Evidence from the production Worker through CDP with a synthetic 20,000-track queue:

| Scenario | filteredList | canPlayList | Result JSON bytes |
| --- | ---: | ---: | ---: |
| normal playback (10,000 played entries) | 10,000 | 0 | 1,710,052 |
| previous dual-array response | 10,000 | 20,000 | 5,096,721 |
| all entries already played (fallback) | 0 | 20,000 | 3,386,722 |

The normal response is 3.0x smaller (66.4% fewer serialized bytes). The fallback branch still returns all 20,000 playable entries, so clearing played history retains its prior behavior. Worker execution measurements were 696.1 ms for the normal 20k probe and 1,019.4 ms for the fallback probe; these include Electron/Comlink/CDP overhead and are recorded for reproducibility, not claimed as a CPU-speedup benchmark.

The resulting `dist/renderer.main.worker.js` is 27,741 bytes. No product API or list ordering changed.

## Checks

- `npm run typecheck`
- `npm run build:renderer`
- production Worker normal/fallback probes above
- existing local music and renderer IPC lifecycle regression tests (6/6)

## Next

Measure queue filtering with real populated lists and capture renderer private memory/CPU while repeatedly switching list routes. Only then consider further Comlink payload or cache changes.
