'use strict'

const { assertSample } = require('./schema.cjs')

const finiteValues = values => {
  if (!Array.isArray(values) || values.length === 0 || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('statistics require at least one finite number')
  }
  return [...values].sort((a, b) => a - b)
}

const median = values => {
  const sorted = finiteValues(values)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const range = values => {
  const sorted = finiteValues(values)
  return { min: sorted[0], max: sorted[sorted.length - 1] }
}

const readPath = (value, path) => path.split('.').reduce((current, key) => current == null ? undefined : current[key], value)

const summarizeRuns = (samples, metricPaths) => {
  if (!Array.isArray(samples) || samples.length === 0) throw new Error('samples must not be empty')
  if (samples.length < 5) throw new Error('summarizeRuns requires at least five samples')
  if (!Array.isArray(metricPaths) || metricPaths.length === 0) throw new Error('metricPaths must not be empty')
  samples.forEach(assertSample)
  const identity = ['scenario', 'temperature', 'variant']
  const expected = Object.fromEntries(identity.map(key => [key, samples[0][key]]))
  for (const sample of samples.slice(1)) {
    for (const key of identity) if (sample[key] !== expected[key]) throw new Error(`sample ${key} differs across runs`)
  }
  return Object.fromEntries(metricPaths.map(path => {
    const values = samples.map(sample => {
      const value = readPath(sample, path)
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`metric ${path} is missing or not finite`)
      return value
    })
    const bounds = range(values)
    return [path, { median: median(values), ...bounds, count: values.length }]
  }))
}

module.exports = { median, range, summarizeRuns }
