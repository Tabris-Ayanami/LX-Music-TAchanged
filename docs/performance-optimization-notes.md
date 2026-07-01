# Performance Optimization Notes

## 2026-07-01: Reverted lazy-load focused v1.1.3 attempt

The optimization attempt that became `v1.1.3` was reverted after local runtime testing showed worse memory usage:

- Previous build: about 460 MB runtime memory usage.
- Reverted attempt: about 540 MB average runtime memory usage, with peaks around 600 MB.

The reverted approach focused on broad lazy loading and SDK/module split points. Although build, typecheck, and regression tests passed, runtime memory behavior regressed. Future performance work should treat this direction as disproven unless a narrower change is measured before and after with runtime process metrics.

Requirements for future performance work:

- Measure runtime memory before and after changes.
- Prefer one isolated optimization at a time.
- Do not assume smaller startup chunks or more dynamic imports will reduce resident memory.
- Keep animation behavior and source parsing logic unchanged unless explicitly testing a replacement path.
