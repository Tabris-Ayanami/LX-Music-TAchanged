# Stage 3 renderer IPC listener lifecycle

Date: 2026-08-24

## Change

`src/common/rendererIpc.ts` now keeps the wrapper identity created by
`rendererOn`. `rendererOff` removes the corresponding wrapper rather than the
caller callback, and `rendererOffAll` clears the identity map as well. Multiple
registrations of the same callback are tracked independently.

This closes a real listener-lifecycle hole affecting settings, list, theme,
update, and other renderer IPC subscriptions. It does not alter IPC channel
names, payloads, or event ordering.

## Verification

- `node --test tests/regression/renderer-ipc-listener-lifecycle.test.cjs`: 1
  passed; the dynamic fake `ipcRenderer` observed one registration, one
  callback, and zero listeners after `rendererOff`.
- Targeted ESLint: passed.
- `npm run typecheck`: all common, main, and renderer projects passed.
- `npm run build:renderer`: passed; webpack compiled successfully in 96,774 ms.
- Electron renderer smoke (fresh profile, port 9354): startup, Discover,
  Search, Local, Download, Settings, playback controls, Aura, Folia,
  immersive mode, and route restoration passed; `exceptions: []`.
- Final fresh-profile reference capture (3 s sample, Local tracks route,
  port 9356) recorded FCP 420 ms, renderer private bytes 216.82 MiB, whole
  Electron tree private bytes 1,059.19 MiB, CPU 18.2% of one core, 320
  threads, and 4,628 handles. This is a reference sample only, not a
  cross-profile A/B delta.

The dynamic test proves the listener is released at the adapter boundary; no
whole-app memory delta is claimed without a long navigation pressure test.
