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

The dynamic test proves the listener is released at the adapter boundary; no
whole-app memory delta is claimed without a long navigation pressure test.
