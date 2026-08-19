'use strict'

const STAGE2_SAMPLE_VERSION = 1

const assertObject = (value, fieldPath) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`sample is missing ${fieldPath}`)
  return value
}

const assertString = (value, fieldPath) => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`sample is missing ${fieldPath}`)
}

const assertFinite = (value, fieldPath, options = {}) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`sample ${fieldPath} must be finite`)
  if (options.integer === true && !Number.isInteger(value)) throw new Error(`sample ${fieldPath} must be an integer`)
  if (options.minimum != null && value < options.minimum) throw new Error(`sample ${fieldPath} must be at least ${options.minimum}`)
  if (options.maximum != null && value > options.maximum) throw new Error(`sample ${fieldPath} must be at most ${options.maximum}`)
}

const assertCounter = (value, fieldPath) => assertFinite(value, fieldPath, { integer: true, minimum: 0 })
const assertMeasurement = (value, fieldPath) => assertFinite(value, fieldPath, { minimum: 0 })

const assertSample = sample => {
  if (!sample || typeof sample !== 'object') throw new TypeError('sample must be an object')
  if (sample.version !== STAGE2_SAMPLE_VERSION) throw new Error(`unsupported sample version: ${sample.version}`)

  assertString(sample.capturedAt, 'capturedAt')
  if (Number.isNaN(Date.parse(sample.capturedAt))) throw new Error('sample capturedAt must be an ISO timestamp')
  for (const identity of ['scenario', 'phase', 'temperature', 'variant']) assertString(sample[identity], identity)
  if (!new Set(['cold', 'warm']).has(sample.temperature)) throw new Error('sample temperature must be cold or warm')
  assertFinite(sample.runIndex, 'runIndex', { integer: true, minimum: 1 })
  assertFinite(sample.elapsedMs, 'elapsedMs', { minimum: 0 })
  assertFinite(sample.rootPid, 'rootPid', { integer: true, minimum: 1 })
  assertFinite(sample.cdpPort, 'cdpPort', { integer: true, minimum: 1, maximum: 65_535 })

  const totals = assertObject(sample.processTotals, 'processTotals')
  assertFinite(totals.processCount, 'processTotals.processCount', { integer: true, minimum: 1 })
  if (!Array.isArray(sample.processes) || sample.processes.length === 0 || sample.processes.length !== sample.processTotals.processCount) {
    throw new Error('sample processes do not match process tree count')
  }
  for (const [index, process] of sample.processes.entries()) {
    assertObject(process, `processes.${index}`)
    assertFinite(process.pid, `processes.${index}.pid`, { integer: true, minimum: 1 })
    assertFinite(process.parentPid, `processes.${index}.parentPid`, { integer: true, minimum: 0 })
    assertString(process.imageName, `processes.${index}.imageName`)
    assertString(process.type, `processes.${index}.type`)
    for (const metric of ['workingSetMiB', 'privateBytesMiB', 'cpuPercentOneCore']) {
      assertMeasurement(process[metric], `processes.${index}.${metric}`)
    }
    for (const metric of ['threads', 'handles']) assertCounter(process[metric], `processes.${index}.${metric}`)
  }
  for (const metric of ['workingSetMiB', 'privateBytesMiB', 'cpuPercentOneCore']) {
    assertMeasurement(totals[metric], `processTotals.${metric}`)
  }
  for (const metric of ['threads', 'handles']) assertCounter(totals[metric], `processTotals.${metric}`)

  const renderer = assertObject(sample.renderer, 'renderer')
  assertCounter(renderer.liveObjectUrls, 'renderer.liveObjectUrls')
  const rendererGroups = {
    objectUrls: ['live', 'created', 'revoked'],
    workers: ['live', 'created', 'terminated'],
    contexts: ['2d', 'webgl', 'webgl2', 'bitmaprenderer'],
    dom: ['images', 'loadedImages', 'loadedImagePixels', 'videos', 'canvases'],
    cdpTargets: ['workers', 'serviceWorkers'],
  }
  for (const [groupName, metrics] of Object.entries(rendererGroups)) {
    const group = assertObject(renderer[groupName], `renderer.${groupName}`)
    for (const metric of metrics) assertCounter(group[metric], `renderer.${groupName}.${metric}`)
  }
  const performance = assertObject(renderer.performance, 'renderer.performance')
  for (const metric of ['JSHeapUsedSize', 'JSHeapTotalSize', 'Documents', 'Frames', 'Nodes', 'LayoutCount', 'RecalcStyleCount']) {
    assertMeasurement(performance[metric], `renderer.performance.${metric}`)
  }

  const nativeCache = assertObject(sample.nativeCache, 'nativeCache')
  assertString(nativeCache.path, 'nativeCache.path')
  assertCounter(nativeCache.files, 'nativeCache.files')
  assertCounter(nativeCache.bytes, 'nativeCache.bytes')

  const gpuMemory = assertObject(sample.gpuMemory, 'gpuMemory')
  if (gpuMemory.available !== false) throw new Error('sample gpuMemory.available must be false when GPU memory is unavailable')
  assertString(gpuMemory.reason, 'gpuMemory.reason')

  const attribution = assertObject(sample.attribution, 'attribution')
  assertString(attribution.variant, 'attribution.variant')
  if (attribution.variant !== sample.variant) throw new Error('sample attribution.variant must match sample variant')
  if (attribution.measurable !== true) throw new Error('sample attribution.measurable must be true for captured evidence')
  if (!Array.isArray(attribution.effectiveControls)) throw new Error('sample attribution.effectiveControls must be an array')
  if ('reason' in attribution) assertString(attribution.reason, 'attribution.reason')

  return sample
}

module.exports = { STAGE2_SAMPLE_VERSION, assertSample }
