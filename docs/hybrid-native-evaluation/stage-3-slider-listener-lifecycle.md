# Stage 3 slider document-listener lifecycle

Date: 2026-08-24

## Change

`VolumeBtn.vue` and `SliderBar.vue` now install their document-level drag
listeners only after a slider drag starts. They remove the listeners on
pointer-up and again during unmount. This keeps the existing drag behavior but
eliminates idle `mousemove`/`mouseup` callbacks from mounted controls.

## Verification

- `node --test tests/regression/slider-global-listener-lifecycle.test.cjs`: 2
  passed.
- Targeted ESLint: passed.
- `npx tsc --noEmit -p src/renderer/tsconfig.json`: passed.
- `npm run build:renderer`: passed; webpack compiled successfully in 103,591 ms.
- Electron renderer smoke (fresh profile, port 9352): startup, Discover,
  Search, Local, Download, Settings, playback controls, Aura, Folia,
  immersive mode, and route restoration passed; `exceptions: []`.
- Static lifecycle measurement: each component changed from two setup-time
  document registrations to zero idle registrations; during a drag exactly two
  registrations and two removals are exercised. No whole-app CPU delta is
  claimed because the smoke path does not synthesize a sustained mouse stream.

The change is limited to listener ownership and does not alter slider values,
keyboard controls, or player IPC semantics.
