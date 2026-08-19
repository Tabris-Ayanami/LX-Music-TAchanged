'use strict'

const STAGE2_SAMPLE_VERSION = 1

const assertSample = sample => {
  if (!sample || typeof sample !== 'object') throw new TypeError('sample must be an object')
  if (sample.version !== STAGE2_SAMPLE_VERSION) throw new Error(`unsupported sample version: ${sample.version}`)
  if (!sample.processTotals || typeof sample.processTotals !== 'object') throw new Error('sample is missing process tree totals')
  if (!Number.isInteger(sample.processTotals.processCount) || sample.processTotals.processCount <= 0) {
    throw new Error('sample has no process tree')
  }
  for (const identity of ['scenario', 'temperature', 'variant']) {
    if (typeof sample[identity] !== 'string' || sample[identity].length === 0) throw new Error(`sample is missing ${identity}`)
  }
  return sample
}

module.exports = { STAGE2_SAMPLE_VERSION, assertSample }
