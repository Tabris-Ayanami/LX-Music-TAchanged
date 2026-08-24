# Stage 8 player idle resource progress

Date: 2026-08-24  
Branch: `hybrid-native`

## Panner timer gating

The spatial-panner effect previously started its `setInterval` as soon as the sound-effect setup ran whenever panner was enabled. That interval continued while the player was paused or stopped. Its cadence is `speed * 10` ms (the configured range is 2–20 ms), so an enabled but silent player could wake the renderer roughly 50–500 times per second for no audible work.

The player now exposes the active deck state and starts the panner interval only while a deck is actually playing. `play` restarts it; `pause`, `stop`, and `error` stop it and reset the position. This preserves the audible panner trajectory while removing the timer entirely from the paused/stopped idle path. No audio graph, source selection, or libmpv/Web Audio boundary was changed.

## Verification

- `npm run typecheck` passed for common, main, and renderer projects.
- `npm run build:renderer` passed; the production renderer remains 6.01 MiB of JavaScript across 291 node_modules modules.
- `npm run build:main` passed; `main.js` remains 2.96 MiB.
- `npm run check:backend-boundaries` passed (legacy transport 57/57, direct runtime 29/33, no new violations).
- Existing Node regression tests were run; their pre-existing UI fixture failures remain unrelated to this player-only change, and no new assertion was added by the patch.

## Native sidecar idle lifetime

`NativeCoreSupervisor` now arms an unref'd five-minute idle timer after the last completed native RPC. If no request is pending when it expires, the sidecar is stopped; the next native call transparently starts it again and renegotiates the existing protocol/capability handshake. The timer is cancelled on every new call and on app shutdown, so active scans, downloads, artwork work, and conversion are never interrupted. This bounds long-running background native memory without adding a permanent Main-process timer or changing the fallback contract.

The lifetime policy is intentionally measured as a bounded-retention guarantee rather than an immediate CPU claim: a sidecar that is actively used remains warm, while a sidecar left unused for five minutes no longer contributes resident memory.

This is a deterministic timer/wakeup reduction, not a claimed whole-process CPU delta. The next acceptance probe should compare renderer CPU with the panner enabled during paused playback and during active playback, then continue to the next background renderer only if the idle capture confirms a material reduction.
