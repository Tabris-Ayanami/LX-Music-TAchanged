# Stage 3 lyric drag listener lifecycle

Date: 2026-08-24

## Change

`src/renderer/utils/compositions/useLyric.js` no longer installs four global
drag listeners when the lyric panel mounts. Mouse listeners are attached only
for a mouse drag, touch listeners only for a touch drag, and both paths remove
their listeners on pointer end. The existing unmount cleanup remains as a
defensive release path.

## Verification

- `node --test tests/regression/lyric-drag-listener-lifecycle.test.cjs`: 2
  passed.
- Targeted ESLint: passed.
- `npx tsc --noEmit -p src/renderer/tsconfig.json`: passed.
- `npm run build:renderer`: passed; webpack compiled successfully in 100,276 ms.
- Electron renderer smoke (fresh profile, port 9353): startup, Discover,
  Search, Local, Download, Settings, playback controls, Aura, Folia,
  immersive mode, and route restoration passed; `exceptions: []`.
- Static lifecycle measurement: the mounted idle path now has 0 document drag
  registrations instead of 4; a mouse or touch drag installs exactly 2 and
  pointer end removes all 4 defensively. No whole-app CPU delta is claimed
  because the smoke path does not synthesize sustained pointer traffic.

No lyric selection, scrolling, seeking, touch, or playback semantics were
changed; only listener ownership timing changed.
