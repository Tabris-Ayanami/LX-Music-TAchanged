'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { completeStage2Sample } = require('../helpers/stage2-sample-fixture.cjs')

const { prepareLaunch, runMatrix, shutdownOwnedProcessTree, validateWorkspaceManifestForRun } = require('../../scripts/performance/stage2/run.cjs')
const { buildReport } = require('../../scripts/performance/stage2/report.cjs')

const scenarioConfig = Object.freeze({
  window: { width: 1280, height: 800 },
  theme: 'follow-profile',
  search: { source: 'wy', keyword: '周杰伦', expectedMinimumResults: 10 },
  stabilizeMs: 10_000,
  navigationLoops: 10,
  recoveryCheckpointsMs: [10_000, 30_000, 60_000],
})

const sampleFor = ({ scenario, temperature, variant, runIndex, phase = 'stable' }) => completeStage2Sample({
  scenario,
  phase,
  temperature,
  variant,
  runIndex,
  rootPid: runIndex + 1,
  cdpPort: 9_000 + runIndex,
  processes: [{
    pid: runIndex + 1, parentPid: 0, imageName: 'electron.exe', type: 'browser',
    workingSetMiB: 100 + runIndex, privateBytesMiB: 80 + runIndex,
    cpuPercentOneCore: runIndex, threads: 10 + runIndex, handles: 20 + runIndex,
  }],
  processTotals: {
    processCount: 1,
    workingSetMiB: 100 + runIndex,
    privateBytesMiB: 80 + runIndex,
    cpuPercentOneCore: runIndex,
    threads: 10 + runIndex,
    handles: 20 + runIndex,
  },
  nativeCache: { path: 'C:\\stage2\\native-cache', bytes: 100, files: 2 },
  attribution: { variant, measurable: true, effectiveControls: [] },
})

const createWorkspaceManifest = async root => {
  const outputRoot = path.join(root, 'workspace')
  const profileSource = path.join(root, 'source')
  const manifest = {
    version: 1,
    outputRoot,
    profileSource,
    manifestPath: path.join(outputRoot, 'workspace-manifest.json'),
    profilePath: path.join(outputRoot, 'profile-template'),
    mediaPath: path.join(outputRoot, 'media'),
    nativeProfilePath: path.join(outputRoot, 'native-profile'),
    nativeCachePath: path.join(outputRoot, 'native-cache'),
    sourceProfileWasInactive: true,
    profileActivityEvidence: { completed: true },
  }
  await fs.mkdir(profileSource)
  for (const directory of [manifest.profilePath, manifest.mediaPath, manifest.nativeProfilePath, manifest.nativeCachePath]) await fs.mkdir(directory, { recursive: true })
  const databasePath = path.join(manifest.profilePath, 'LxDatas', 'lx.data.db')
  await fs.mkdir(path.dirname(databasePath))
  await fs.writeFile(databasePath, '')
  manifest.database = { path: databasePath, sha256: crypto.createHash('sha256').update('').digest('hex') }
  manifest.copiedMediaMappings = []
  await fs.writeFile(manifest.manifestPath, JSON.stringify(manifest))
  return manifest
}

test('runner records five cold and five warm launches without conflating temperatures', async() => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-runner-'))
  const calls = []
  try {
    const workspaceManifest = await createWorkspaceManifest(root)
    const result = await runMatrix({
      outputDirectory: root,
      workspaceManifest, workspaceManifestPath: workspaceManifest.manifestPath,
      config: scenarioConfig,
      scenarios: ['local-tracks'],
      variants: ['control'],
      runs: 5,
    }, {
      prepareProfile: async context => calls.push({ kind: 'profile', ...context }),
      launch: async context => {
        calls.push({ kind: 'launch', ...context })
        return { rootPid: 1_000 + calls.length, async close() { calls.push({ kind: 'close', rootPid: this.rootPid }) } }
      },
      prepareLaunch: async context => ({ attribution: { variant: context.variant, measurable: true, effectiveControls: [] }, async cleanup() {} }),
      executeScenario: async context => calls.push({ kind: 'scenario', ...context }),
      sample: async context => sampleFor(context),
    })

    assert.equal(calls.filter(call => call.kind == 'launch').length, 11)
    assert.equal(calls.filter(call => call.kind == 'close').length, 11)
    assert.equal(calls.filter(call => call.kind == 'scenario').length, 11)
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
    const workspaceManifest = await createWorkspaceManifest(root)
    await assert.rejects(runMatrix({
      outputDirectory: root,
      workspaceManifest, workspaceManifestPath: workspaceManifest.manifestPath,
      config: scenarioConfig, scenarios: ['discover-idle'], variants: ['control'], runs: 5,
    }, {
      prepareProfile: async() => {},
      launch: async() => ({ rootPid: 700 + sampleCount, async close() { closed.push(this.rootPid) } }),
      prepareLaunch: async context => ({ attribution: { variant: context.variant, measurable: true, effectiveControls: [] }, async cleanup() {} }),
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

test('Fetch attribution is active before the probe reload and its controls reach the sample contract', async() => {
  const calls = []
  const listeners = new Map()
  const client = {
    on(method, handler) { listeners.set(method, handler); return () => listeners.delete(method) },
    async call(method, params = {}) {
      calls.push(method)
      if (method == 'Runtime.evaluate' && params.expression?.includes('window.resizeTo')) {
        return { result: { value: { width: 1280, height: 800, effectiveTheme: { documentTheme: '', prefersDark: false } } } }
      }
      if (method == 'Runtime.evaluate') return { result: { value: { readyState: 'complete', probeReady: true } } }
      return {}
    },
  }
  const lifecycle = await prepareLaunch({
    variant: 'no-remote-images',
    config: { window: { width: 1280, height: 800 }, theme: 'follow-profile' },
    launch: { client },
  })
  assert.ok(calls.indexOf('Fetch.enable') < calls.indexOf('Page.reload'))
  assert.deepEqual(lifecycle.attribution.effectiveControls[0].resourceType, 'Image')
  await lifecycle.cleanup()
})

test('variant cleanup failure invalidates the run before its samples enter raw evidence', async() => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-runner-health-'))
  try {
    const workspaceManifest = await createWorkspaceManifest(root)
    await assert.rejects(runMatrix({
      outputDirectory: root, workspaceManifest, workspaceManifestPath: workspaceManifest.manifestPath, config: scenarioConfig, scenarios: ['discover-idle'], variants: ['control'], runs: 5,
    }, {
      prepareProfile: async() => {},
      launch: async() => ({ rootPid: 55, async close() {} }),
      prepareLaunch: async context => ({
        attribution: { variant: context.variant, measurable: true, effectiveControls: [] },
        async cleanup() { throw new Error('variant health failed') },
      }),
      executeScenario: async() => {},
      sample: async context => sampleFor(context),
    }), /variant health failed/)
    assert.equal(await fs.readFile(path.join(root, 'raw-samples.jsonl'), 'utf8'), '')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('not-measurable variants are reported without launching or fabricating samples', async() => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-runner-unavailable-'))
  try {
    const workspaceManifest = await createWorkspaceManifest(root)
    const result = await runMatrix({
      outputDirectory: root, workspaceManifest, workspaceManifestPath: workspaceManifest.manifestPath,
      config: scenarioConfig, scenarios: ['discover-idle'], variants: ['no-keep-alive'], runs: 5,
    }, {
      launch: async() => { throw new Error('unavailable variant must not launch') },
    })
    assert.equal(result.samples.length, 0)
    assert.deepEqual(result.summary.unavailableVariants.map(variant => variant.name), ['no-keep-alive'])
    assert.match(result.markdown, /no-keep-alive.*not measurable/is)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('runner rejects a manifest or report path that can escape or overlap the prepared workspace', async() => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-runner-safety-'))
  try {
    const manifest = await createWorkspaceManifest(root)
    await validateWorkspaceManifestForRun(manifest, path.join(root, 'reports'), manifest.manifestPath)
    await assert.rejects(validateWorkspaceManifestForRun({ ...manifest, nativeCachePath: manifest.profileSource }, path.join(root, 'reports'), manifest.manifestPath), /inside the prepared workspace|differs from its file/i)
    await assert.rejects(validateWorkspaceManifestForRun(manifest, path.join(manifest.profileSource, 'report'), manifest.manifestPath), /overlap.*source profile/i)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('shutdown snapshots owned descendants before graceful browser exit and terminates survivors', async() => {
  const events = []
  const child = { exitCode: 0, kill() { events.push('fallback-kill') } }
  const client = {
    async call(method) { events.push(method) },
    close() { events.push('client-close') },
  }
  const owned = await shutdownOwnedProcessTree({
    rootPid: 100,
    client,
    child,
    listProcessIds: async rootPid => { events.push(`snapshot-${rootPid}`); return [100, 101, 102] },
    terminate: async pids => events.push(`terminate-${pids.join('-')}`),
  })
  assert.deepEqual(owned, [100, 101, 102])
  assert.deepEqual(events, ['snapshot-100', 'Runtime.evaluate', 'terminate-100-101-102', 'client-close'])
})

test('report keeps navigation recovery checkpoints and runner refuses under-sized formal runs', async() => {
  const samples = Array.from({ length: 5 }, (_, index) => sampleFor({
    scenario: 'navigation-pressure', temperature: 'warm', variant: 'control', runIndex: index + 1,
  }))
  const report = buildReport(samples, { recoveryCheckpointsMs: [10_000, 30_000, 60_000] })
  assert.deepEqual(report.summary.groups.control['navigation-pressure'].checkpoints, [10_000, 30_000, 60_000])
  assert.match(report.markdown, /10,000.*30,000.*60,000/s)
  await assert.rejects(runMatrix({
    outputDirectory: 'unused', workspaceManifest: {}, config: scenarioConfig, scenarios: ['discover-idle'], variants: ['control'], runs: 4,
  }), /at least five runs per temperature/i)
})
