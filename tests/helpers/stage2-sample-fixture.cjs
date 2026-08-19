'use strict'

const completeStage2Sample = (overrides = {}) => {
  const variant = overrides.variant ?? 'control'
  const runIndex = overrides.runIndex ?? 1
  return {
    version: 1,
    capturedAt: '2026-08-19T00:00:00.000Z',
    scenario: 'startup',
    phase: 'stable',
    temperature: 'cold',
    variant,
    runIndex,
    elapsedMs: 12_000,
    rootPid: 100,
    cdpPort: 9_229,
    renderer: {
      liveObjectUrls: 1,
      objectUrls: { live: 1, created: 2, revoked: 1 },
      workers: { live: 2, created: 3, terminated: 1 },
      contexts: { '2d': 1, webgl: 2, webgl2: 3, bitmaprenderer: 4 },
      dom: { images: 5, loadedImages: 4, loadedImagePixels: 12_000, videos: 1, canvases: 4 },
      performance: {
        JSHeapUsedSize: 1_000 + runIndex,
        JSHeapTotalSize: 2_000 + runIndex,
        Documents: 2,
        Frames: 1,
        Nodes: 50,
        LayoutCount: 6,
        RecalcStyleCount: 7,
      },
      cdpTargets: { workers: 2, serviceWorkers: 1 },
    },
    processes: [{
      pid: 100,
      parentPid: 1,
      imageName: 'LX-TA.exe',
      type: 'browser',
      workingSetMiB: 100 + runIndex,
      privateBytesMiB: 80 + runIndex,
      cpuPercentOneCore: runIndex,
      threads: 10 + runIndex,
      handles: 20 + runIndex,
    }],
    processTotals: {
      processCount: 1,
      workingSetMiB: 100 + runIndex,
      privateBytesMiB: 80 + runIndex,
      cpuPercentOneCore: runIndex,
      threads: 10 + runIndex,
      handles: 20 + runIndex,
    },
    nativeCache: { path: 'C:\\stage2\\native-cache', files: 2, bytes: 100 },
    gpuMemory: { available: false, reason: 'No reliable GPU-memory counter is available in this capture path.' },
    attribution: { variant, measurable: true, effectiveControls: [] },
    ...overrides,
  }
}

module.exports = { completeStage2Sample }
