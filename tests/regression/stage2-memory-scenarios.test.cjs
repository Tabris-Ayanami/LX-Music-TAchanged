const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')

const {
  SCENARIO_NAMES,
  copyResolvedScenarioConfig,
  createScenarioDrivers,
  resolveScenarioConfig,
} = require('../../scripts/performance/stage2/scenarios.cjs')
const { createScenarioActions } = require('../../scripts/performance/stage2/scenario-actions.cjs')

const EXPECTED_SCENARIOS = [
  'discover-idle',
  'discover-scroll',
  'search-results',
  'local-tracks',
  'local-albums-200',
  'playback-normal',
  'playback-folia',
  'playback-aura',
  'playback-diorama',
  'navigation-pressure',
  'library-scan',
]

const createConfig = overrides => ({
  window: { width: 1280, height: 800 },
  theme: 'follow-profile',
  search: { source: 'wy', keyword: '周杰伦', expectedMinimumResults: 10 },
  stabilizeMs: 10_000,
  navigationLoops: 10,
  recoveryCheckpointsMs: [10_000, 30_000, 60_000],
  ...overrides,
})

const createCopiedMedia = () => {
  const workspaceRoot = path.resolve('build', 'stage2-scenario-fixture')
  const destinationRoot = path.join(workspaceRoot, 'media', 'library')
  return {
    workspaceRoot,
    roots: [
      { sourceRoot: path.resolve('fixtures', 'source-library'), destinationRoot },
    ],
    playbackTrack: path.join(destinationRoot, 'fixed-track.flac'),
  }
}

const createFakePage = ({ artworkCount = 200, searchCount = 10 } = {}) => {
  const calls = []
  const sleeps = []
  let route = '#/discover'
  let settings = {
    'playDetail.immersiveBackground': 'blur',
    'playDetail.immersiveEffect': 'classic',
  }

  const evaluate = async(_expression, meta = {}) => {
    calls.push(meta)
    switch (meta.action) {
      case 'navigate':
        route = meta.payload.route
        return route
      case 'read-route':
        return route
      case 'read-list-count':
        return route.startsWith('#/search?') ? searchCount : 20
      case 'collect-artwork-identities':
        return Array.from({ length: artworkCount }, (_, index) => `file:///copied/artwork-${index}.webp`)
      case 'read-settings':
        return { ...settings }
      case 'write-settings':
        settings = { ...settings, ...meta.payload.patch }
        return { ...settings }
      case 'play-copied-track':
      case 'open-player-detail':
      case 'enter-immersive-player':
      case 'read-playback-ready':
      case 'read-visible-player-controls':
      case 'write-library-folders':
      case 'read-visible-setting-page':
      case 'read-visible-scan-control':
      case 'click-library-scan':
        return true
      case 'scroll-page':
        return {
          artworkIdentities: ['file:///copied/discover-before.webp', 'file:///copied/discover-after.webp'],
          newArtworkIdentities: ['file:///copied/discover-after.webp'],
          scroll: { before: 0, after: 640, maximum: 1_280, passes: 8, container: { id: '', className: 'view-container' } },
        }
      case 'read-library-scan-complete':
        return { complete: true, failed: false, text: '扫描完成：1 个文件夹' }
      default:
        throw new Error(`Unexpected fake evaluator action: ${meta.action}`)
    }
  }

  return {
    calls,
    evaluate,
    getSettings: () => ({ ...settings }),
    sleep: async milliseconds => { sleeps.push(milliseconds) },
    sleeps,
  }
}

const createDrivers = (page = createFakePage(), overrides = {}) => {
  const copiedMedia = createCopiedMedia()
  return {
    copiedMedia,
    drivers: createScenarioDrivers({
      evaluate: page.evaluate,
      sleep: page.sleep,
      config: createConfig(),
      copiedMedia,
      pollIntervalMs: 1,
      timeoutMs: 25,
      ...overrides,
    }),
    page,
  }
}

test('catalog stays exact and every stable scenario requests the fixed ten-second stabilization', () => {
  const { drivers } = createDrivers()

  assert.deepEqual(SCENARIO_NAMES, EXPECTED_SCENARIOS)
  assert.deepEqual(Object.keys(drivers), EXPECTED_SCENARIOS)
  for (const name of EXPECTED_SCENARIOS) {
    const scenario = drivers[name]()
    assert.deepEqual(Object.keys(scenario), ['readiness', 'actions', 'checkpoints', 'recovery'])
    assert.equal(scenario.actions.stabilizeMs, 10_000, name)
  }
})

test('Discover scroll advances its visible page container and collects artwork newly reached by scrolling', async() => {
  let windowScrollCalls = 0
  const container = {
    id: '',
    className: 'view-container Discover-index__page--fixture',
    clientHeight: 100,
    scrollHeight: 360,
    scrollTop: 0,
    getClientRects: () => [{ width: 500, height: 100 }],
    getBoundingClientRect: () => ({ top: 0, bottom: 100, width: 500, height: 100 }),
  }
  const imageAt = (offsetTop, url) => ({
    currentSrc: url,
    src: url,
    getClientRects: () => [{ width: 80, height: 80 }],
    getBoundingClientRect: () => ({
      top: offsetTop - container.scrollTop,
      bottom: offsetTop - container.scrollTop + 80,
      width: 80,
      height: 80,
    }),
  })
  const images = [
    imageAt(10, 'file:///discover/initial.webp'),
    imageAt(130, 'file:///discover/scrolled-1.webp'),
    imageAt(250, 'file:///discover/scrolled-2.webp'),
  ]
  container.querySelectorAll = selector => selector == 'img, [style*="background"]' ? images : []
  const view = {
    children: [container],
    querySelectorAll: selector => selector == '*' ? [container, ...images] : [],
  }
  const document = {
    querySelector: selector => selector == '#view' ? view : null,
  }
  const window = {
    innerHeight: 100,
    scrollBy: () => { windowScrollCalls++ },
    getComputedStyle: element => element === container
      ? { display: 'block', visibility: 'visible', overflowY: 'auto', backgroundImage: 'none' }
      : { display: 'block', visibility: 'visible', overflowY: 'visible', backgroundImage: 'none' },
  }
  const evaluate = async expression => structuredClone(await vm.runInNewContext(expression, {
    document,
    window,
    Promise,
    setTimeout: callback => callback(),
  }))
  const actions = createScenarioActions({ evaluate })

  const result = await actions.scrollPage()

  assert.equal(result.scroll.before, 0)
  assert.equal(result.scroll.after, 260)
  assert.equal(result.scroll.maximum, 260)
  assert.equal(result.scroll.container.className, container.className)
  assert.deepEqual(result.newArtworkIdentities, [
    'file:///discover/scrolled-1.webp',
    'file:///discover/scrolled-2.webp',
  ])
  assert.deepEqual(result.artworkIdentities, [
    'file:///discover/initial.webp',
    'file:///discover/scrolled-1.webp',
    'file:///discover/scrolled-2.webp',
  ])
  assert.equal(windowScrollCalls, 0)
})

test('real search uses the configured source, keyword, and minimum result count instead of Discover', async() => {
  const { drivers, page } = createDrivers()
  const scenario = drivers['search-results']()

  const readiness = await scenario.readiness()

  assert.equal(
    readiness.route,
    '#/search?source=wy&type=music&page=1&text=%E5%91%A8%E6%9D%B0%E4%BC%A6',
  )
  assert.equal(readiness.resultCount, 10)
  const navigation = page.calls.find(call => call.action == 'navigate')
  assert.equal(navigation.payload.route, readiness.route)
  assert.notEqual(navigation.payload.route, '#/discover')
  assert.equal(
    page.calls.find(call => call.action == 'read-list-count').payload.minimum,
    10,
  )
})

test('empty search config fails instead of producing a fake search baseline', () => {
  for (const search of [
    { source: '', keyword: '周杰伦', expectedMinimumResults: 10 },
    { source: 'wy', keyword: '   ', expectedMinimumResults: 10 },
    { source: 'wy', keyword: '周杰伦', expectedMinimumResults: 0 },
  ]) {
    assert.throws(
      () => createScenarioDrivers({
        evaluate: async() => true,
        config: createConfig({ search }),
        copiedMedia: createCopiedMedia(),
      }),
      /search\.(?:source|keyword|expectedMinimumResults)/,
    )
  }
})

test('local album pressure records 200 distinct artwork identities and rejects a smaller fixture', async() => {
  const full = createDrivers(createFakePage({ artworkCount: 200 }))
  const fullScenario = full.drivers['local-albums-200']()
  await fullScenario.readiness()
  const fullActions = await fullScenario.actions.run()
  assert.equal(fullActions.artworkIdentities.length, 200)
  assert.equal(new Set(fullActions.artworkIdentities).size, 200)

  const tooSmall = createDrivers(createFakePage({ artworkCount: 199 }))
  const tooSmallScenario = tooSmall.drivers['local-albums-200']()
  await tooSmallScenario.readiness()
  await assert.rejects(
    tooSmallScenario.actions.run(),
    /at least 200 distinct artwork identities.*199/i,
  )
})

test('playback variants reuse one copied local track and restore every changed setting', async() => {
  const { copiedMedia, drivers, page } = createDrivers()
  const initialSettings = page.getSettings()

  for (const name of ['playback-normal', 'playback-folia', 'playback-aura', 'playback-diorama']) {
    const scenario = drivers[name]()
    await scenario.readiness()
    await scenario.actions.run()
    await scenario.actions.cleanup()
    assert.deepEqual(page.getSettings(), initialSettings, name)
  }

  const tracks = page.calls
    .filter(call => call.action == 'play-copied-track')
    .map(call => call.payload.trackPath)
  assert.deepEqual(tracks, Array(4).fill(copiedMedia.playbackTrack))
  assert.equal(
    page.calls.filter(call => call.action == 'enter-immersive-player').length,
    3,
  )
})

test('navigation pressure performs exactly ten loops and exposes only 10/30/60 second recovery checkpoints', async() => {
  const { drivers, page } = createDrivers(createFakePage(), { now: () => 1_234_567 })
  const scenario = drivers['navigation-pressure']()

  await scenario.readiness()
  const actions = await scenario.actions.run()

  assert.equal(actions.loops, 10)
  assert.equal(actions.recoveryStartedAtMs, 1_234_567)
  assert.deepEqual(page.sleeps, [])
  assert.deepEqual(scenario.checkpoints, [10_000, 30_000, 60_000])
  assert.deepEqual(scenario.recovery, {
    origin: 'actions-complete',
    checkpointsMs: [10_000, 30_000, 60_000],
    stableCheckpointMs: 10_000,
  })
  assert.ok(Object.isFrozen(scenario.recovery))
  assert.ok(Object.isFrozen(scenario.recovery.checkpointsMs))
  assert.deepEqual(
    page.calls.filter(call => call.action == 'navigate').map(call => call.payload.route),
    [
      '#/discover',
      ...Array.from({ length: 10 }, () => [
        '#/local?view=tracks',
        '#/local?view=albums',
        '#/setting',
        '#/discover',
      ]).flat(),
    ],
  )
  assert.equal(page.calls.filter(call => call.action == 'read-list-count' && call.payload.kind == 'tracks').length, 10)
  assert.equal(page.calls.filter(call => call.action == 'read-list-count' && call.payload.kind == 'albums').length, 10)
  assert.equal(page.calls.filter(call => call.action == 'read-visible-setting-page').length, 10)
  assert.equal(page.calls.filter(call => call.action == 'read-list-count' && call.payload.kind == 'discover').length, 11)
})

test('scenario config accepts only an immutable positive-integer window and the supported follow-profile theme', () => {
  const input = createConfig()
  const resolved = resolveScenarioConfig(input)

  assert.notEqual(resolved, input)
  assert.notEqual(resolved.window, input.window)
  assert.ok(Object.isFrozen(resolved))
  assert.ok(Object.isFrozen(resolved.window))
  input.window.width = 640
  input.theme = 'black'
  assert.deepEqual(resolved.window, { width: 1280, height: 800 })
  assert.equal(resolved.theme, 'follow-profile')

  for (const window of [
    undefined,
    null,
    {},
    { width: 0, height: 800 },
    { width: 1280, height: -1 },
    { width: 1280.5, height: 800 },
    { width: '1280', height: 800 },
    { width: 8_193, height: 800 },
  ]) {
    assert.throws(() => resolveScenarioConfig(createConfig({ window })), /window\.(?:width|height)/)
  }
  for (const theme of [undefined, null, '', 'black', 1]) {
    assert.throws(() => resolveScenarioConfig(createConfig({ theme })), /theme.*follow-profile/i)
  }
})

test('library scan writes manifest destinations only and rejects paths outside the workspace', async() => {
  const { copiedMedia, drivers, page } = createDrivers()
  const scenario = drivers['library-scan']()

  await scenario.readiness()
  await scenario.actions.run()

  const write = page.calls.find(call => call.action == 'write-library-folders')
  assert.deepEqual(write.payload.folders, copiedMedia.roots.map(root => root.destinationRoot))
  assert.ok(!write.payload.folders.includes(copiedMedia.roots[0].sourceRoot))

  assert.throws(
    () => createScenarioDrivers({
      evaluate: async() => true,
      config: createConfig(),
      copiedMedia: {
        ...copiedMedia,
        roots: [{ destinationRoot: path.resolve('outside-stage2-workspace') }],
      },
    }),
    /outside.*workspace/i,
  )
})

test('resolved config is copied as explicit JSON into a caller-selected report directory', () => {
  const reportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lx-stage2-scenario-report-'))
  try {
    const config = createConfig()
    const outputPath = copyResolvedScenarioConfig(config, reportDirectory)
    assert.equal(outputPath, path.join(reportDirectory, 'scenario-config.resolved.json'))
    assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), config)
  } finally {
    fs.rmSync(reportDirectory, { recursive: true, force: true })
  }
})
