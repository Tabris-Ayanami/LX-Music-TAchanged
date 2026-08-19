'use strict'

const { median, range, summarizeRuns } = require('./statistics.cjs')

const METRIC_PATHS = Object.freeze([
  'processTotals.workingSetMiB',
  'processTotals.privateBytesMiB',
  'processTotals.cpuPercentOneCore',
  'processTotals.threads',
  'processTotals.handles',
  'renderer.performance.JSHeapUsedSize',
  'renderer.performance.Documents',
  'renderer.performance.Nodes',
  'renderer.performance.Frames',
  'renderer.dom.images',
  'renderer.dom.loadedImages',
  'renderer.dom.loadedImagePixels',
  'renderer.dom.videos',
  'renderer.dom.canvases',
  'renderer.liveObjectUrls',
  'renderer.workers.live',
  'renderer.contexts.canvas2d',
  'renderer.contexts.webgl',
  'renderer.contexts.webgl2',
  'nativeCache.bytes',
  'nativeCache.files',
])

const readPath = (value, metricPath) => metricPath.split('.').reduce((current, key) => current?.[key], value)
const availableMetricPaths = samples => METRIC_PATHS.filter(metricPath => samples.every(sample => Number.isFinite(readPath(sample, metricPath))))

const summarizeProcessTypes = samples => {
  const types = new Set(samples.flatMap(sample => sample.processes.map(process => process.type)))
  const metrics = ['workingSetMiB', 'privateBytesMiB', 'cpuPercentOneCore', 'threads', 'handles']
  return Object.fromEntries([...types].sort().map(type => {
    const summary = {}
    for (const metric of metrics) {
      const values = samples.map(sample => sample.processes
        .filter(process => process.type == type)
        .reduce((total, process) => total + (Number(process[metric]) || 0), 0))
      summary[metric] = { median: median(values), ...range(values), count: values.length }
    }
    return [type, summary]
  }))
}

const summarizePhase = (samples, verificationOnly) => verificationOnly && samples.length < 5
  ? { runs: samples, metrics: {}, processTypes: {}, incomplete: true }
  : {
      runs: samples,
      metrics: summarizeRuns(samples, availableMetricPaths(samples)),
      processTypes: summarizeProcessTypes(samples),
    }

const buildSummary = (samples, options = {}) => {
  const groups = {}
  for (const sample of samples) {
    const scenarioGroup = (((groups[sample.variant] ??= {})[sample.scenario] ??= {
      checkpoints: sample.scenario == 'navigation-pressure' ? [...(options.recoveryCheckpointsMs ?? [])] : [],
    }))
    const temperatureGroup = (scenarioGroup[sample.temperature] ??= { phases: {} })
    const phase = sample.phase || 'stable'
    ;(temperatureGroup.phases[phase] ??= []).push(sample)
  }
  for (const variantGroup of Object.values(groups)) {
    for (const scenarioGroup of Object.values(variantGroup)) {
      for (const temperature of ['cold', 'warm']) {
        const temperatureGroup = scenarioGroup[temperature]
        if (!temperatureGroup) continue
        const summarizedPhases = Object.fromEntries(Object.entries(temperatureGroup.phases).map(([phase, phaseSamples]) => [phase, summarizePhase(phaseSamples, options.verificationOnly === true)]))
        const primary = summarizedPhases.stable ?? Object.values(summarizedPhases)[0]
        scenarioGroup[temperature] = { runs: primary.runs, metrics: primary.metrics, processTypes: primary.processTypes, phases: summarizedPhases }
      }
    }
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    groups,
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
    '| Variant | Scenario | Temperature | Metric | Median | Range |',
    '|---|---|---|---|---:|---:|',
  ]
  for (const [variant, variantGroup] of Object.entries(summary.groups)) {
    for (const [scenario, scenarioGroup] of Object.entries(variantGroup)) {
      for (const temperature of ['cold', 'warm']) {
        const group = scenarioGroup[temperature]
        if (!group) continue
        for (const [metricPath, metric] of Object.entries(group.metrics)) {
          lines.push(`| ${variant} | ${scenario} | ${temperature} | ${metricPath} | ${metric.median} | ${formatRange(metric)} |`)
        }
        for (const [processType, metrics] of Object.entries(group.processTypes)) {
          for (const [metricName, metric] of Object.entries(metrics)) {
            lines.push(`| ${variant} | ${scenario} | ${temperature} | processType.${processType}.${metricName} | ${metric.median} | ${formatRange(metric)} |`)
          }
        }
      }
      if (scenarioGroup.checkpoints.length) lines.push('', `Recovery checkpoints (ms): ${scenarioGroup.checkpoints.map(value => value.toLocaleString('en-US')).join(', ')}`, '')
    }
  }
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
