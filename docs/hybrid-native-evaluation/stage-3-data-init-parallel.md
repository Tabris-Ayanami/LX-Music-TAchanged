# Stage 3 renderer startup data-init parallelization

Date: 2026-08-24

## Change

`src/renderer/core/useApp/useDataInit.ts` now starts user-list loading,
dislike-list initialization, and previous-play restoration in one
`Promise.all`. These operations have no data dependency on one another. The
user-list assignment remains in the same completion path and previous-play
errors are still logged and ignored as before.

## Verification

- `node --test tests/regression/data-init-parallel.test.cjs tests/regression/local-playback-source-independence.test.cjs`: 2 passed.
- Targeted ESLint: passed.
- `npx tsc --noEmit -p src/renderer/tsconfig.json`: passed.
- `npm run build:renderer`: passed; webpack compiled successfully in 111,187 ms.
- Electron renderer smoke (fresh profile, port 9350): Discover, Search, Local,
  Download, Settings, playback controls, Aura, Folia, immersive mode, and
  route restoration all passed; `exceptions: []`.
- Synthetic scheduling test uses three independent 25 ms mocks. The parallel
  implementation completed under 65 ms (serial lower bound is about 75 ms),
  demonstrating overlap without claiming a whole-app FCP or memory delta.
- One fresh-profile capture after startup (3 s sample, Local tracks route)
  recorded FCP 368 ms, renderer private bytes 213.34 MiB, whole Electron tree
  private bytes 1,048.82 MiB, CPU 15.6% of one core, 307 threads, and 4,589
  handles. This is a post-change reference sample only; profile, cache, and
  machine state differ from earlier baselines, so it is not an A/B delta.

This change is intentionally limited to startup ordering. No whole-process
memory/CPU improvement is claimed from the synthetic timing test; a strict
fresh-profile A/B startup capture is required before assigning an application
level metric.
