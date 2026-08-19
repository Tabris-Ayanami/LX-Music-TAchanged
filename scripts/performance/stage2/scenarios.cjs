const fs = require('node:fs')
const path = require('node:path')

const { createScenarioActions, isPathInside } = require('./scenario-actions.cjs')

const SCENARIO_NAMES = Object.freeze([
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
])

const REQUIRED_CHECKPOINTS = Object.freeze([10_000, 30_000, 60_000])
const PLAYBACK_SETTING_KEYS = Object.freeze([
  'playDetail.immersiveBackground',
  'playDetail.immersiveEffect',
])

const assertNonEmptyString = (value, label) => {
  if (typeof value != 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`)
}

const cloneAndFreeze = value => {
  if (value == null || typeof value != 'object') return value
  const clone = Array.isArray(value)
    ? value.map(cloneAndFreeze)
    : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneAndFreeze(child)]))
  return Object.freeze(clone)
}

const resolveScenarioConfig = config => {
  if (config == null || typeof config != 'object' || Array.isArray(config)) throw new TypeError('config must be an object')
  assertNonEmptyString(config.search?.source, 'search.source')
  assertNonEmptyString(config.search?.keyword, 'search.keyword')
  if (!Number.isInteger(config.search?.expectedMinimumResults) || config.search.expectedMinimumResults < 1) {
    throw new TypeError('search.expectedMinimumResults must be a positive integer')
  }
  if (config.stabilizeMs != 10_000) throw new RangeError('stabilizeMs must be exactly 10000')
  if (config.navigationLoops != 10) throw new RangeError('navigationLoops must be exactly 10')
  if (!Array.isArray(config.recoveryCheckpointsMs) ||
      config.recoveryCheckpointsMs.length != REQUIRED_CHECKPOINTS.length ||
      config.recoveryCheckpointsMs.some((value, index) => value != REQUIRED_CHECKPOINTS[index])) {
    throw new RangeError('recoveryCheckpointsMs must be exactly [10000, 30000, 60000]')
  }
  return cloneAndFreeze(config)
}

const resolveCopiedMedia = copiedMedia => {
  assertNonEmptyString(copiedMedia?.workspaceRoot, 'copiedMedia.workspaceRoot')
  assertNonEmptyString(copiedMedia?.playbackTrack, 'copiedMedia.playbackTrack')
  if (!Array.isArray(copiedMedia.roots) || !copiedMedia.roots.length) {
    throw new TypeError('copiedMedia.roots must contain at least one manifest root mapping')
  }
  const workspaceRoot = path.resolve(copiedMedia.workspaceRoot)
  const roots = copiedMedia.roots.map((mapping, index) => {
    assertNonEmptyString(mapping?.destinationRoot, `copiedMedia.roots[${index}].destinationRoot`)
    const destinationRoot = path.resolve(mapping.destinationRoot)
    if (!isPathInside(workspaceRoot, destinationRoot)) {
      throw new RangeError(`copiedMedia.roots[${index}].destinationRoot is outside the Stage 2 workspace`)
    }
    return Object.freeze({ destinationRoot })
  })
  const playbackTrack = path.resolve(copiedMedia.playbackTrack)
  if (!isPathInside(workspaceRoot, playbackTrack) || !roots.some(root => isPathInside(root.destinationRoot, playbackTrack))) {
    throw new RangeError('copiedMedia.playbackTrack must be inside a manifest destination root in the Stage 2 workspace')
  }
  return Object.freeze({ workspaceRoot, roots: Object.freeze(roots), playbackTrack })
}

const copyResolvedScenarioConfig = (config, reportDirectory) => {
  const resolved = resolveScenarioConfig(config)
  assertNonEmptyString(reportDirectory, 'reportDirectory')
  const directory = path.resolve(reportDirectory)
  fs.mkdirSync(directory, { recursive: true })
  const outputPath = path.join(directory, 'scenario-config.resolved.json')
  const temporaryPath = `${outputPath}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(resolved, null, 2)}\n`, 'utf8')
  fs.renameSync(temporaryPath, outputPath)
  return outputPath
}

const createActionContract = (stabilizeMs, run, cleanup = async() => {}) => Object.freeze({
  stabilizeMs,
  run,
  cleanup,
})

const createContract = (readiness, actions, checkpoints = []) => ({
  readiness,
  actions,
  checkpoints: Object.freeze([...checkpoints]),
})

const createScenarioDrivers = options => {
  const config = resolveScenarioConfig(options?.config)
  const copiedMedia = resolveCopiedMedia(options?.copiedMedia)
  const page = createScenarioActions(options)
  const searchRoute = `#/search?source=${encodeURIComponent(config.search.source.trim())}&type=music&page=1&text=${encodeURIComponent(config.search.keyword.trim())}`
  const playbackRoute = `#/local?view=tracks&keyword=${encodeURIComponent(copiedMedia.playbackTrack)}`

  const stabilize = async() => page.stabilize(config.stabilizeMs)
  const routeReadiness = (route, ready) => async() => {
    await page.navigate(route)
    const observed = ready ? await ready() : undefined
    return { route, ...observed }
  }

  const stableAction = run => createActionContract(config.stabilizeMs, async() => {
    const result = await run()
    await stabilize()
    return result ?? {}
  })

  const playbackDriver = (mode, settingPatch) => () => {
    let settingsSnapshot
    return createContract(
      routeReadiness(playbackRoute, async() => ({ resultCount: await page.waitForList({ kind: 'tracks', minimum: 1 }) })),
      createActionContract(
        config.stabilizeMs,
        async() => {
          settingsSnapshot = await page.readSettings(PLAYBACK_SETTING_KEYS)
          if (Object.keys(settingPatch).length) await page.writeSettings(settingPatch)
          await page.playCopiedTrack(copiedMedia.playbackTrack)
          await page.waitForPlaybackReady(copiedMedia.playbackTrack)
          if (mode != 'normal') {
            await page.openPlayerDetail()
            await page.enterImmersivePlayer()
          }
          await page.waitForVisiblePlayerControls(mode)
          await stabilize()
          return { mode, trackPath: copiedMedia.playbackTrack }
        },
        async() => {
          if (settingsSnapshot) await page.writeSettings(settingsSnapshot)
        },
      ),
    )
  }

  const drivers = {
    'discover-idle': () => createContract(
      routeReadiness('#/discover', async() => ({ renderedSections: await page.waitForDiscoverContent() })),
      stableAction(async() => ({ route: '#/discover' })),
    ),
    'discover-scroll': () => createContract(
      routeReadiness('#/discover', async() => ({ renderedSections: await page.waitForDiscoverContent() })),
      stableAction(async() => ({ artworkIdentities: await page.scrollPage() })),
    ),
    'search-results': () => createContract(
      routeReadiness(searchRoute, async() => ({
        resultCount: await page.waitForList({ kind: 'search', minimum: config.search.expectedMinimumResults }),
      })),
      stableAction(async() => ({
        source: config.search.source,
        keyword: config.search.keyword,
        expectedMinimumResults: config.search.expectedMinimumResults,
      })),
    ),
    'local-tracks': () => createContract(
      routeReadiness('#/local?view=tracks', async() => ({ resultCount: await page.waitForList({ kind: 'tracks', minimum: 1 }) })),
      stableAction(async() => ({ route: '#/local?view=tracks' })),
    ),
    'local-albums-200': () => createContract(
      routeReadiness('#/local?view=albums', async() => ({ resultCount: await page.waitForList({ kind: 'albums', minimum: 1 }) })),
      stableAction(async() => ({ artworkIdentities: await page.collectArtworkIdentities(200) })),
    ),
    'playback-normal': playbackDriver('normal', {}),
    'playback-folia': playbackDriver('folia', {
      'playDetail.immersiveBackground': 'blur',
      'playDetail.immersiveEffect': 'classic',
    }),
    'playback-aura': playbackDriver('aura', {
      'playDetail.immersiveBackground': 'aura',
      'playDetail.immersiveEffect': 'classic',
    }),
    'playback-diorama': playbackDriver('diorama', {
      'playDetail.immersiveBackground': 'blur',
      'playDetail.immersiveEffect': 'diorama',
    }),
    'navigation-pressure': () => createContract(
      routeReadiness('#/discover', async() => ({ renderedSections: await page.waitForDiscoverContent() })),
      createActionContract(config.stabilizeMs, async() => {
        const routes = [
          ['#/local?view=tracks', () => page.waitForList({ kind: 'tracks', minimum: 1 })],
          ['#/local?view=albums', () => page.waitForList({ kind: 'albums', minimum: 1 })],
          ['#/setting', () => page.waitForVisibleSettingPage()],
          ['#/discover', () => page.waitForDiscoverContent()],
        ]
        for (let loop = 0; loop < config.navigationLoops; loop++) {
          for (const [route, waitUntilRendered] of routes) {
            await page.navigate(route)
            await waitUntilRendered()
          }
        }
        await stabilize()
        return { loops: config.navigationLoops, routes: routes.map(([route]) => route) }
      }),
      config.recoveryCheckpointsMs,
    ),
    'library-scan': () => createContract(
      async() => {
        const folders = copiedMedia.roots.map(root => root.destinationRoot)
        await page.writeLibraryFolders({ workspaceRoot: copiedMedia.workspaceRoot, folders })
        await page.navigate('#/setting')
        await page.waitForVisibleScanControl()
        return { route: '#/setting', folders }
      },
      stableAction(async() => {
        await page.clickLibraryScan()
        const completion = await page.waitForLibraryScanComplete()
        return { completion }
      }),
    ),
  }

  return Object.freeze(Object.fromEntries(SCENARIO_NAMES.map(name => [name, drivers[name]])))
}

module.exports = {
  SCENARIO_NAMES,
  copyResolvedScenarioConfig,
  createScenarioDrivers,
  resolveScenarioConfig,
}
