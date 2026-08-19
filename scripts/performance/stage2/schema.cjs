'use strict'

const STAGE2_SAMPLE_VERSION = 1

const assertSample = sample => {
  if (!sample || typeof sample !== 'object') throw new TypeError('sample must be an object')
  if (sample.version !== STAGE2_SAMPLE_VERSION) throw new Error(`unsupported sample version: ${sample.version}`)
  if (!sample.processTotals || typeof sample.processTotals !== 'object') throw new Error('sample is missing process tree totals')
  if (!Number.isInteger(sample.processTotals.processCount) || sample.processTotals.processCount <= 0) {
    throw new Error('sample has no process tree')
  }
  if (!Array.isArray(sample.processes) || sample.processes.length === 0 || sample.processes.length !== sample.processTotals.processCount) {
    throw new Error('sample processes do not match process tree count')
  }
  for (const identity of ['scenario', 'temperature', 'variant']) {
    if (typeof sample[identity] !== 'string' || sample[identity].length === 0) throw new Error(`sample is missing ${identity}`)
  }
  return sample
}

module.exports = { STAGE2_SAMPLE_VERSION, assertSample }
