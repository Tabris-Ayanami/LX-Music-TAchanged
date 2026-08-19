'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { median, range, summarizeRuns } = require('../../scripts/performance/stage2/statistics.cjs')
const { STAGE2_SAMPLE_VERSION, assertSample } = require('../../scripts/performance/stage2/schema.cjs')
const { completeStage2Sample } = require('../helpers/stage2-sample-fixture.cjs')

const samples = [100, 110, 110, 120, 130].map((privateBytesMiB, index) => completeStage2Sample({
  version: STAGE2_SAMPLE_VERSION,
  runIndex: index + 1,
  processTotals: {
    ...completeStage2Sample().processTotals,
    privateBytesMiB,
  },
}))

test('median sorts odd-sized values and averages even middle values', () => {
  assert.equal(median([9, 1, 5, 3, 7]), 5)
  assert.equal(median([4, 2, 8, 6]), 5)
})

test('range returns finite minimum and maximum', () => {
  assert.deepEqual(range([9, 1, 5]), { min: 1, max: 9 })
})

test('summarizeRuns reports median, range, and count for an explicit metric path', () => {
  assert.deepEqual(
    summarizeRuns(samples, ['processTotals.privateBytesMiB']),
    { 'processTotals.privateBytesMiB': { median: 110, min: 100, max: 130, count: 5 } },
  )
})

test('assertSample rejects an empty process tree', () => {
  assert.throws(() => assertSample(completeStage2Sample({
    processTotals: { ...completeStage2Sample().processTotals, processCount: 0 },
    processes: [],
  })), /process tree|processTotals\.processCount/i)
})

test('summarizeRuns rejects mismatched sample identity fields', () => {
  const mismatched = samples.map(sample => ({ ...sample, variant: 'test' }))
  assert.throws(() => summarizeRuns([samples[0], ...mismatched.slice(1)], ['processTotals.privateBytesMiB']), /scenario|temperature|variant/i)
  const wrongPhase = samples.map(sample => ({ ...sample, phase: 'recovery-10000' }))
  assert.throws(() => summarizeRuns([samples[0], ...wrongPhase.slice(1)], ['processTotals.privateBytesMiB']), /phase/i)
})

test('summarizeRuns rejects missing and non-finite metric values', () => {
  assert.throws(() => summarizeRuns(samples.map(sample => ({ ...sample, processTotals: { ...sample.processTotals } })), ['processTotals.missing']), /missing/i)
  assert.throws(() => summarizeRuns(samples.map(sample => ({ ...sample, processTotals: { ...sample.processTotals, privateBytesMiB: Infinity } })), ['processTotals.privateBytesMiB']), /finite/i)
})

test('summarizeRuns requires five runs for one identity group', () => {
  assert.throws(() => summarizeRuns(samples.slice(0, 4), ['processTotals.privateBytesMiB']), /five|5/i)
  assert.doesNotThrow(() => summarizeRuns(samples, ['processTotals.privateBytesMiB']))
})

test('assertSample requires process rows matching processCount', () => {
  assert.throws(() => assertSample({ ...samples[0], processes: undefined }), /processes/i)
  assert.throws(() => assertSample({ ...samples[0], processes: [] }), /processes/i)
  assert.throws(() => assertSample({ ...samples[0], processTotals: { ...samples[0].processTotals, processCount: 2 }, processes: [samples[0].processes[0]] }), /processes|count/i)
})

test('assertSample rejects every missing or non-finite required numeric metric', () => {
  const requiredNumericPaths = [
    'elapsedMs', 'rootPid', 'cdpPort',
    'processes.0.pid', 'processes.0.parentPid', 'processes.0.workingSetMiB',
    'processes.0.privateBytesMiB', 'processes.0.cpuPercentOneCore', 'processes.0.threads', 'processes.0.handles',
    'processTotals.processCount', 'processTotals.workingSetMiB', 'processTotals.privateBytesMiB',
    'processTotals.cpuPercentOneCore', 'processTotals.threads', 'processTotals.handles',
    'renderer.liveObjectUrls', 'renderer.objectUrls.live', 'renderer.objectUrls.created', 'renderer.objectUrls.revoked',
    'renderer.workers.live', 'renderer.workers.created', 'renderer.workers.terminated',
    'renderer.contexts.2d', 'renderer.contexts.webgl', 'renderer.contexts.webgl2', 'renderer.contexts.bitmaprenderer',
    'renderer.dom.images', 'renderer.dom.loadedImages', 'renderer.dom.loadedImagePixels', 'renderer.dom.videos', 'renderer.dom.canvases',
    'renderer.performance.JSHeapUsedSize', 'renderer.performance.JSHeapTotalSize', 'renderer.performance.Documents',
    'renderer.performance.Frames', 'renderer.performance.Nodes', 'renderer.performance.LayoutCount',
    'renderer.performance.RecalcStyleCount', 'renderer.cdpTargets.workers', 'renderer.cdpTargets.serviceWorkers',
    'nativeCache.files', 'nativeCache.bytes',
  ]
  for (const metricPath of requiredNumericPaths) {
    const sample = structuredClone(completeStage2Sample())
    const parts = metricPath.split('.')
    const key = parts.pop()
    const parent = parts.reduce((value, part) => value[part], sample)
    parent[key] = Number.NaN
    assert.throws(() => assertSample(sample), new RegExp(metricPath.replaceAll('.', '\\.'), 'i'), metricPath)
  }
})

test('assertSample requires complete capture, renderer, cache, GPU, and attribution identities', () => {
  const mutations = [
    ['capturedAt', undefined], ['phase', undefined], ['runIndex', undefined],
    ['renderer.performance', undefined], ['nativeCache.path', undefined], ['gpuMemory.reason', undefined],
    ['attribution', undefined], ['attribution.measurable', false], ['attribution.effectiveControls', undefined],
    ['processes.0.imageName', undefined], ['processes.0.type', undefined],
  ]
  for (const [fieldPath, replacement] of mutations) {
    const sample = structuredClone(completeStage2Sample())
    const parts = fieldPath.split('.')
    const key = parts.pop()
    const parent = parts.reduce((value, part) => value[part], sample)
    parent[key] = replacement
    assert.throws(() => assertSample(sample), undefined, fieldPath)
  }
  assert.throws(() => assertSample(completeStage2Sample({
    attribution: { variant: 'different', measurable: true, effectiveControls: [] },
  })), /attribution.*variant|variant.*attribution/i)
})
