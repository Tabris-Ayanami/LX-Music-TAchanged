# Stage 2A statistics, schema, and report fix report

## Scope

- Added `phase` to the exact identity enforced by `summarizeRuns`.
- Changed the Stage 2 sample schema to fail closed on incomplete capture identity, process rows/totals, Renderer probe data, all seven planned CDP Performance metrics, CDP worker targets, native-cache measurements, the explicit GPU-memory-unavailable marker, and measurable attribution metadata.
- Removed report-time metric discovery. Formal reports now use the fixed required metric catalog and reject missing/non-finite evidence instead of silently omitting columns.
- Corrected the 2D context path to `renderer.contexts.2d` and added process count, total JS heap, layout/style counts, CDP worker/service-worker counts, and bitmap-renderer contexts.
- Rendered stable and recovery phases independently in Markdown, including per-process-type values.
- Kept verification-only groups below five samples explicitly incomplete and free of formal statistics.
- Added `unavailableVariants: [{ name, reason }]` to summary and Markdown. Empty sample sets are accepted only for verification-only evidence or explicitly unavailable variants.

No real LX-TA instance, live Stage 2A evidence capture, Stage 2C work, scenario implementation, variant implementation, package metadata, or runner implementation was part of this fix.

## TDD evidence

RED command:

```text
node --test tests/regression/stage2-memory-statistics.test.cjs tests/regression/stage2-memory-report.test.cjs
```

Observed result: 15 tests, 7 passed, 8 failed. The failures identified the intended missing behavior: phase identity, strict numeric/sample fields, the fixed metric catalog, phase-aware Markdown, incomplete verification status, unavailable variants, and fail-closed missing metrics.

Focused GREEN command:

```text
node --test tests/regression/stage2-memory-statistics.test.cjs tests/regression/stage2-memory-sampler.test.cjs tests/regression/stage2-memory-report.test.cjs
```

Observed result at implementation time: 19/19 passed.

## Interface changes

- `assertSample(sample)` now requires:
  - ISO-like `capturedAt`; non-empty scenario/phase/variant; cold/warm temperature; positive run index, root PID, and CDP port; finite elapsed milliseconds;
  - complete process rows and totals with finite Working Set, Private Bytes, CPU, thread, and handle values;
  - complete object URL, Worker, 2D/WebGL/WebGL2/bitmap-renderer, DOM, CDP-target, and seven-field Performance data;
  - native cache path/file/byte data;
  - `gpuMemory.available === false` and a non-empty reason;
  - `attribution.variant === sample.variant`, `measurable === true`, and an `effectiveControls` array.
- `buildSummary(samples, options)` and `buildReport(samples, options)` accept `options.unavailableVariants` and expose it on the summary.
- `summary.verificationOnly` and `summary.incomplete` make evidence status machine-readable.
- Existing temperature-level `runs`, `metrics`, and `processTypes` remain aliases of the stable phase (or first recorded phase) for runner compatibility; `phases` is authoritative for phase-specific reporting.

## Residual risks

- CDP may omit a planned Performance counter on a particular Electron/Windows build. This now aborts capture/report with the exact missing field rather than producing a partial baseline; a future genuinely optional counter would need an explicit `{ available: false, reason }` contract before it can be admitted.
- Strict schema validation makes old partial test fixtures and historical sample JSON invalid. This is intentional for formal Stage 2A evidence, but consumers must upgrade fixtures before re-aggregation.
- Live Renderer metric availability and full runner integration still require the consolidated isolated-profile verification pass owned by the parent task.
