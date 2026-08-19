'use strict'

const { median, range, summarizeRuns } = require('./statistics.cjs')
const { assertSample } = require('./schema.cjs')

const METRIC_PATHS = Object.freeze([
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

const summarizeProcessTypes = samples => {
  const types = new Set(samples.flatMap(sample => sample.processes.map(process => process.type)))
  const metrics = ['workingSetMiB', 'privateBytesMiB', 'cpuPercentOneCore', 'threads', 'handles']
  return Object.fromEntries([...types].sort().map(type => {
    const summary = {}
    for (const metric of metrics) {
      const values = samples.map(sample => sample.processes
        .filter(process => process.type == type)
        .reduce((total, process) => total + process[metric], 0))
      summary[metric] = { median: median(values), ...range(values), count: values.length }
    }
    return [type, summary]
  }))
}

const summarizePhase = (samples, verificationOnly) => verificationOnly && samples.length < 5
  ? { runs: samples, metrics: {}, processTypes: {}, incomplete: true }
  : {
      runs: samples,
      metrics: summarizeRuns(samples, METRIC_PATHS),
      processTypes: summarizeProcessTypes(samples),
    }

const buildSummary = (samples, options = {}) => {
  if (!Array.isArray(samples)) throw new TypeError('samples must be an array')
  const unavailableVariants = options.unavailableVariants ?? []
  if (!Array.isArray(unavailableVariants)) throw new TypeError('unavailableVariants must be an array')
  for (const [index, variant] of unavailableVariants.entries()) {
    if (!variant || typeof variant !== 'object' || typeof variant.name !== 'string' || variant.name.trim() === '' || typeof variant.reason !== 'string' || variant.reason.trim() === '') {
      throw new Error(`unavailableVariants.${index} requires a name and reason`)
    }
  }
  if (samples.length === 0 && options.verificationOnly !== true && unavailableVariants.length === 0) {
    throw new Error('samples must not be empty unless verification-only evidence or unavailable variants are recorded')
  }
  samples.forEach(assertSample)
  const groups = {}
  for (const sample of samples) {
    const scenarioGroup = (((groups[sample.variant] ??= {})[sample.scenario] ??= {
      checkpoints: sample.scenario == 'navigation-pressure' ? [...(options.recoveryCheckpointsMs ?? [])] : [],
    }))
    const temperatureGroup = (scenarioGroup[sample.temperature] ??= { phases: {} })
    ;(temperatureGroup.phases[sample.phase] ??= []).push(sample)
  }
  let incomplete = samples.length === 0
  for (const variantGroup of Object.values(groups)) {
    for (const scenarioGroup of Object.values(variantGroup)) {
      for (const temperature of ['cold', 'warm']) {
        const temperatureGroup = scenarioGroup[temperature]
        if (!temperatureGroup) continue
        const summarizedPhases = Object.fromEntries(Object.entries(temperatureGroup.phases).map(([phase, phaseSamples]) => [phase, summarizePhase(phaseSamples, options.verificationOnly === true)]))
        if (Object.values(summarizedPhases).some(phase => phase.incomplete === true)) incomplete = true
        const primary = summarizedPhases.stable ?? Object.values(summarizedPhases)[0]
        scenarioGroup[temperature] = { runs: primary.runs, metrics: primary.metrics, processTypes: primary.processTypes, phases: summarizedPhases }
      }
    }
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    verificationOnly: options.verificationOnly === true,
    incomplete,
    groups,
    unavailableVariants: unavailableVariants.map(variant => ({ name: variant.name, reason: variant.reason })),
    gpuMemory: { available: false, reason: 'GPU memory is not available; GPU-process private bytes are not reported as GPU memory.' },
    conditions: options.conditions ?? {},
    paths: options.paths ?? {},
    errors: options.errors ?? [],
  }
}

const formatRange = metric => `${metric.min}–${metric.max}`
const renderMarkdown = summary => {
  const lines = [
    '# Stage 2A memory baseline report',
    '',
    'This report records measurements only. It does not claim Stage 2 completion or optimization benefits.',
    '',
    'GPU memory is not available in this capture path. GPU-process private bytes are kept only in process totals.',
    '',
    '## Test conditions',
    '',
    '```json',
    JSON.stringify(summary.conditions, null, 2),
    '```',
    '',
    '## Median and Range',
    '',
    '| Variant | Scenario | Temperature | Phase | Metric | Median | Range |',
    '|---|---|---|---|---|---:|---:|',
  ]
  for (const [variant, variantGroup] of Object.entries(summary.groups)) {
    for (const [scenario, scenarioGroup] of Object.entries(variantGroup)) {
      for (const temperature of ['cold', 'warm']) {
        const group = scenarioGroup[temperature]
        if (!group) continue
        for (const [phaseName, phase] of Object.entries(group.phases)) {
          for (const [metricPath, metric] of Object.entries(phase.metrics)) {
            lines.push(`| ${variant} | ${scenario} | ${temperature} | ${phaseName} | ${metricPath} | ${metric.median} | ${formatRange(metric)} |`)
          }
          for (const [processType, metrics] of Object.entries(phase.processTypes)) {
            for (const [metricName, metric] of Object.entries(metrics)) {
              lines.push(`| ${variant} | ${scenario} | ${temperature} | ${phaseName} | processType.${processType}.${metricName} | ${metric.median} | ${formatRange(metric)} |`)
            }
          }
        }
      }
      if (scenarioGroup.checkpoints.length) lines.push('', `Recovery checkpoints (ms): ${scenarioGroup.checkpoints.map(value => value.toLocaleString('en-US')).join(', ')}`, '')
    }
  }
  if (summary.verificationOnly) {
    lines.push('', '## Verification status', '')
    if (summary.incomplete) {
      lines.push('Verification-only evidence is incomplete; groups below five samples do not produce formal statistics.', '')
      for (const [variant, variantGroup] of Object.entries(summary.groups)) {
        for (const [scenario, scenarioGroup] of Object.entries(variantGroup)) {
          for (const temperature of ['cold', 'warm']) {
            const group = scenarioGroup[temperature]
            if (!group) continue
            for (const [phaseName, phase] of Object.entries(group.phases)) {
              if (phase.incomplete) lines.push(`- ${variant} / ${scenario} / ${temperature} / ${phaseName}: ${phase.runs.length}/5 samples; no formal statistics.`)
            }
          }
        }
      }
    } else {
      lines.push('Verification-only evidence contains at least five samples for every recorded group.')
    }
  }
  lines.push('', '## Unavailable variants', '')
  if (summary.unavailableVariants.length === 0) lines.push('- None recorded.')
  else for (const variant of summary.unavailableVariants) lines.push(`- ${variant.name}: ${variant.reason}`)
  lines.push('', '## Errors', '')
  if (summary.errors.length == 0) lines.push('- None recorded.')
  else for (const error of summary.errors) lines.push(`- ${error}`)
  lines.push('', '## Raw files', '')
  for (const [name, filePath] of Object.entries(summary.paths)) lines.push(`- ${name}: ${filePath}`)
  lines.push('')
  return lines.join('\n')
}

const buildReport = (samples, options = {}) => {
  const summary = buildSummary(samples, options)
  return { summary, markdown: renderMarkdown(summary) }
}

module.exports = { METRIC_PATHS, buildReport, buildSummary, renderMarkdown }
