'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { buildReport, buildSummary, METRIC_PATHS } = require('../../scripts/performance/stage2/report.cjs')
const { completeStage2Sample } = require('../helpers/stage2-sample-fixture.cjs')

const phaseSamples = (phase, offset = 0) => Array.from({ length: 5 }, (_, index) => completeStage2Sample({
  scenario: 'navigation-pressure',
  temperature: 'warm',
  phase,
  runIndex: index + 1,
  processTotals: {
    ...completeStage2Sample().processTotals,
    privateBytesMiB: 100 + offset + index,
  },
}))

test('report schema lists every planned total, renderer, cache, worker, and canvas metric', () => {
  assert.deepEqual(METRIC_PATHS, [
    'processTotals.processCount',
    'processTotals.workingSetMiB',
    'processTotals.privateBytesMiB',
    'processTotals.cpuPercentOneCore',
    'processTotals.threads',
    'processTotals.handles',
    'renderer.performance.JSHeapUsedSize',
    'renderer.performance.JSHeapTotalSize',
    'renderer.performance.Documents',
    'renderer.performance.Nodes',
    'renderer.performance.Frames',
    'renderer.performance.LayoutCount',
    'renderer.performance.RecalcStyleCount',
    'renderer.dom.images',
    'renderer.dom.loadedImages',
    'renderer.dom.loadedImagePixels',
    'renderer.dom.videos',
    'renderer.dom.canvases',
    'renderer.liveObjectUrls',
    'renderer.workers.live',
    'renderer.cdpTargets.workers',
    'renderer.cdpTargets.serviceWorkers',
    'renderer.contexts.2d',
    'renderer.contexts.webgl',
    'renderer.contexts.webgl2',
    'renderer.contexts.bitmaprenderer',
    'nativeCache.bytes',
    'nativeCache.files',
  ])
})

test('Markdown reports numeric metrics for stable and every recovery phase', () => {
  const report = buildReport([
    ...phaseSamples('stable'),
    ...phaseSamples('recovery-10000', 10),
    ...phaseSamples('recovery-30000', 20),
    ...phaseSamples('recovery-60000', 30),
  ], { recoveryCheckpointsMs: [10_000, 30_000, 60_000] })

  const phases = report.summary.groups.control['navigation-pressure'].warm.phases
  assert.equal(phases.stable.metrics['processTotals.privateBytesMiB'].median, 102)
  assert.equal(phases['recovery-10000'].metrics['processTotals.privateBytesMiB'].median, 112)
  assert.equal(phases['recovery-30000'].metrics['processTotals.privateBytesMiB'].median, 122)
  assert.equal(phases['recovery-60000'].metrics['processTotals.privateBytesMiB'].median, 132)
  assert.match(report.markdown, /\| control \| navigation-pressure \| warm \| stable \| processTotals\.privateBytesMiB \| 102 \| 100–104 \|/)
  assert.match(report.markdown, /\| control \| navigation-pressure \| warm \| recovery-10000 \| processTotals\.privateBytesMiB \| 112 \| 110–114 \|/)
  assert.match(report.markdown, /\| control \| navigation-pressure \| warm \| recovery-30000 \| processTotals\.privateBytesMiB \| 122 \| 120–124 \|/)
  assert.match(report.markdown, /\| control \| navigation-pressure \| warm \| recovery-60000 \| processTotals\.privateBytesMiB \| 132 \| 130–134 \|/)
})

test('verification-only groups under five runs stay explicitly incomplete and omit formal statistics', () => {
  const report = buildReport(phaseSamples('stable').slice(0, 2), { verificationOnly: true })
  const phase = report.summary.groups.control['navigation-pressure'].warm.phases.stable
  assert.equal(phase.incomplete, true)
  assert.deepEqual(phase.metrics, {})
  assert.deepEqual(phase.processTypes, {})
  assert.equal(report.summary.incomplete, true)
  assert.match(report.markdown, /verification-only.*incomplete/i)
  assert.match(report.markdown, /stable.*2\/5/i)
  assert.doesNotMatch(report.markdown, /\| 102 \|/)
})

test('unavailable variants are retained without fabricated samples or statistics', () => {
  const options = {
    unavailableVariants: [
      { name: 'no-db-worker', reason: 'The scenario cannot complete without the database worker.' },
      { name: 'no-renderer-worker', reason: 'The scenario cannot complete without the renderer worker.' },
    ],
  }
  const report = buildReport([], options)
  assert.equal(report.summary.sampleCount, 0)
  assert.deepEqual(report.summary.unavailableVariants, options.unavailableVariants)
  assert.equal(report.summary.incomplete, true)
  assert.match(report.markdown, /no-db-worker.*database worker/i)
  assert.match(report.markdown, /no-renderer-worker.*renderer worker/i)
  assert.throws(() => buildSummary([]), /samples.*empty|unavailable|verification/i)
})

test('formal report rejects a missing required metric instead of silently dropping it', () => {
  const samples = phaseSamples('stable')
  delete samples[0].renderer.performance.JSHeapTotalSize
  assert.throws(() => buildReport(samples), /JSHeapTotalSize/i)
})
