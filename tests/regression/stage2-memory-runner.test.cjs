'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { runMatrix } = require('../../scripts/performance/stage2/run.cjs')
const { buildReport } = require('../../scripts/performance/stage2/report.cjs')

const sampleFor = ({ scenario, temperature, variant, runIndex, phase = 'stable' }) => ({
  version: 1,
  capturedAt: new Date(0).toISOString(),
  scenario,
  phase,
  temperature,
  variant,
  runIndex,
  processes: [{ pid: runIndex + 1, type: 'browser' }],
  processTotals: {
    processCount: 1,
    workingSetMiB: 100 + runIndex,
    privateBytesMiB: 80 + runIndex,
    cpuPercentOneCore: runIndex,
    threads: 10 + runIndex,
    handles: 20 + runIndex,
  },
  renderer: { performance: { JSHeapUsedSize: 1_000 + runIndex, Documents: 2, Nodes: 50, Frames: 1 } },
  nativeCache: { bytes: 100, files: 2 },
  gpuMemory: { available: false, reason: 'No reliable GPU-memory counter is available in this capture path.' },
})

test('runner records five cold and five warm launches without conflating temperatures', async() => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-runner-'))
  const calls = []
  try {
    const result = await runMatrix({
      outputDirectory: root,
      workspaceManifest: { profilePath: path.join(root, 'template'), nativeProfilePath: path.join(root, 'native'), nativeCachePath: path.join(root, 'cache') },
      config: { stabilizeMs: 10_000 },
      scenarios: ['local-tracks'],
      variants: ['control'],
      runs: 5,
    }, {
      prepareProfile: async context => calls.push({ kind: 'profile', ...context }),
      prime: async context => calls.push({ kind: 'prime', ...context }),
      launch: async context => {
        calls.push({ kind: 'launch', ...context })
        return { rootPid: 1_000 + calls.length, async close() { calls.push({ kind: 'close', rootPid: this.rootPid }) } }
      },
      executeScenario: async context => calls.push({ kind: 'scenario', ...context }),
      sample: async context => sampleFor(context),
    })

    assert.equal(calls.filter(call => call.kind == 'launch').length, 10)
    assert.equal(calls.filter(call => call.kind == 'prime').length, 1)
    assert.equal(calls.filter(call => call.kind == 'close').length, 10)
    assert.equal(result.summary.groups.control['local-tracks'].cold.runs.length, 5)
    assert.equal(result.summary.groups.control['local-tracks'].warm.runs.length, 5)
    assert.equal(result.summary.groups.control['local-tracks'].cold.metrics['processTotals.privateBytesMiB'].median, 83)
    assert.match(result.markdown, /Median.*Range/is)
    assert.match(result.markdown, /GPU memory.*not available/is)

    const rawLines = (await fs.readFile(result.paths.rawSamples, 'utf8')).trim().split(/\r?\n/).map(JSON.parse)
    assert.equal(rawLines.length, 10)
    assert.deepEqual(new Set(rawLines.map(sample => sample.temperature)), new Set(['cold', 'warm']))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('failure preserves raw samples and closes only runner-owned launches', async() => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-runner-fail-'))
  const closed = []
  let sampleCount = 0
  try {
    await assert.rejects(runMatrix({
      outputDirectory: root,
      workspaceManifest: { profilePath: path.join(root, 'template'), nativeProfilePath: path.join(root, 'native'), nativeCachePath: path.join(root, 'cache') },
      config: {}, scenarios: ['discover-idle'], variants: ['control'], runs: 5,
    }, {
      prepareProfile: async() => {},
      prime: async() => {},
      launch: async() => ({ rootPid: 700 + sampleCount, async close() { closed.push(this.rootPid) } }),
      executeScenario: async() => {},
      sample: async context => {
        if (++sampleCount == 3) throw new Error('synthetic sample failure')
        return sampleFor(context)
      },
    }), /synthetic sample failure/)

    assert.deepEqual(closed, [700, 701, 702])
    const raw = await fs.readFile(path.join(root, 'raw-samples.jsonl'), 'utf8')
    assert.equal(raw.trim().split(/\r?\n/).length, 2)
    assert.doesNotMatch(raw, /99999/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('report keeps navigation recovery checkpoints and runner refuses under-sized formal runs', async() => {
  const samples = Array.from({ length: 5 }, (_, index) => sampleFor({
    scenario: 'navigation-pressure', temperature: 'warm', variant: 'control', runIndex: index + 1,
  }))
  const report = buildReport(samples, { recoveryCheckpointsMs: [10_000, 30_000, 60_000] })
  assert.deepEqual(report.summary.groups.control['navigation-pressure'].checkpoints, [10_000, 30_000, 60_000])
  assert.match(report.markdown, /10,000.*30,000.*60,000/s)
  await assert.rejects(runMatrix({
    outputDirectory: 'unused', workspaceManifest: {}, config: {}, scenarios: ['discover-idle'], variants: ['control'], runs: 4,
  }), /at least five runs per temperature/i)
})
