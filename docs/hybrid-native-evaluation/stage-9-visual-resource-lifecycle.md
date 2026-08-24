# Stage 9 play-detail visual resource lifecycle

Date: 2026-08-24  
Branch: `hybrid-native`

## Evidence and route adjustment

The packaged Stage 8 build reduced observed memory from about 450 MB to 400 MB on the local page and from about 700 MB to 600 MB in immersive MV mode. The traditional detail page only moved from about 480 MB to a variable 450-470 MB. Because the remaining variance is concentrated around play-detail visuals, this pass prioritizes visual worker, WebGL, bitmap, and video lifetime instead of further IPC work.

## Changes

- The traditional Aura `FluidBackground` now exists only while the traditional detail view is visible. Closing play detail or entering immersive mode unmounts it, terminates its worker, and releases the transferred OffscreenCanvas/WebGL context instead of keeping that renderer below the active surface.
- The Aura worker now cancels its animation frame while stopped or paused. Previously it submitted the same WebGL frame continuously even when animation time was paused.
- Stale Aura cover decoding closes its `ImageBitmap` if the worker was destroyed or replaced before the asynchronous fetch/decode completed. Failed transfers also close the bitmap.
- Immersive MV teardown now pauses the video, clears `srcObject`, removes `src`, and reloads the element when the MV is replaced, fails, is switched off, or the component unmounts. This explicitly releases network buffers, decoder state, and video surfaces.

No audio source, lyric source, MV selection, visual style, or playback behavior was removed. Returning from immersive mode recreates the existing Aura renderer through the normal component mount path.

## Verification

- `git diff --check`: passed.
- `npm run typecheck`: passed for common, main, and renderer projects.
- `npm run build:renderer`: passed in 115.728 seconds; production JavaScript remains 6.01 MiB.
- Targeted lifecycle regressions: 7/7 passed, including the new Aura visibility/rAF, stale bitmap, and MV decoder release guards.
- Full Node regression suite: 176/188 passed. The same 12 pre-existing UI/style and unrelated fixture guards remain failing; none of the targeted lifecycle tests failed.

This stage has deterministic resource-lifetime evidence but does not yet claim a measured whole-app memory delta. The next installed-build acceptance should repeat local playback, traditional detail, immersive MV, and ten detail/immersive open-close cycles, recording memory immediately and after 10/30/60 seconds. The expected structural result is zero retained traditional Aura worker while play detail is closed or immersive mode is active.
