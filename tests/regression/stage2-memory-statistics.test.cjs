'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { median, range, summarizeRuns } = require('../../scripts/performance/stage2/statistics.cjs')
const { STAGE2_SAMPLE_VERSION, assertSample } = require('../../scripts/performance/stage2/schema.cjs')

const samples = [100, 110, 110, 120, 130].map((privateBytesMiB, index) => ({
  version: STAGE2_SAMPLE_VERSION,
  scenario: 'startup',
  temperature: 'cold',
  variant: 'control',
  processTotals: { processCount: 2, privateBytesMiB },
  processes: [{ pid: 100 + index, privateBytesMiB }, { pid: 200 + index, privateBytesMiB }],
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
  assert.throws(() => assertSample({ version: 1, processTotals: { processCount: 0 } }), /process tree/i)
})

test('summarizeRuns rejects mismatched sample identity fields', () => {
  const mismatched = samples.map(sample => ({ ...sample, variant: 'test' }))
  assert.throws(() => summarizeRuns([samples[0], ...mismatched.slice(1)], ['processTotals.privateBytesMiB']), /scenario|temperature|variant/i)
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
