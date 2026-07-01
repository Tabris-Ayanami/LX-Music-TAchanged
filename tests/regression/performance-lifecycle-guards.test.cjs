const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8')

test('RG-044: sidebar queue cover loading does not retry missing artwork forever', () => {
  const source = read('src', 'renderer', 'components', 'layout', 'Aside', 'NowPlayingList.vue')

  assert.match(
    source,
    /const failedPicIds = new Set\(\)[\s\S]*failedPicIds\.has\(itemKey\)/m,
    'Failed artwork ids should be excluded from lazy-loading candidates',
  )
  assert.match(
    source,
    /if \(!pic\) \{[\s\S]*failedPicIds\.add\(itemKey\)[\s\S]*return[\s\S]*\}[\s\S]*\.catch\(\(\) => \{[\s\S]*failedPicIds\.add\(itemKey\)/m,
    'Empty and rejected cover lookups should be marked failed to avoid an endless request loop',
  )
  assert.match(
    source,
    /picRequestId\+\+[\s\S]*loadingPicIds\.clear\(\)[\s\S]*failedPicIds\.clear\(\)[\s\S]*queueList\.value = getList\(listId\)\.map/m,
    'A fresh queue sync should clear failed ids so new list contents can resolve covers normally',
  )
})

test('RG-045: animated background and visualizer clean up deferred work on unmount', () => {
  const fluidBackground = read('src', 'renderer', 'components', 'layout', 'PlayDetail', 'FluidBackground.vue')
  const visualizer = read('src', 'renderer', 'components', 'common', 'AudioVisualizer.vue')

  assert.match(
    fluidBackground,
    /let initTimer = null[\s\S]*let disposed = false[\s\S]*window\.clearTimeout\(initTimer\)[\s\S]*disposed = true[\s\S]*cleanup\(\)/m,
    'FluidBackground should cancel deferred init and mark itself disposed before stopping the worker',
  )
  assert.match(
    fluidBackground,
    /if \(disposed\) return[\s\S]*initTimer = window\.setTimeout\(\(\) => \{[\s\S]*initTimer = null[\s\S]*init\(\)/m,
    'Deferred canvas re-init should no-op after unmount instead of recreating a worker',
  )
  assert.match(
    visualizer,
    /onMounted\(\(\) => \{[\s\S]*ctx = canvas\.getContext\('2d'\)[\s\S]*window\.app_event\.on\('play', handlePlay\)[\s\S]*if \(isPlay\.value\) handlePlay\(\)/m,
    'AudioVisualizer should register play events only after the canvas context has been initialized',
  )
  assert.match(
    visualizer,
    /const handlePlay = \(\) => \{[\s\S]*if \(!ctx \|\| !dom_canvas\.value \|\| !WIDTH \|\| !HEIGHT\) return/m,
    'AudioVisualizer should ignore early play events until the canvas is ready',
  )
})

test('RG-049: lyric view clears deferred scroll work on unmount', () => {
  const useLyric = read('src', 'renderer', 'utils', 'compositions', 'useLyric.js')

  assert.match(
    useLyric,
    /onBeforeUnmount\(\(\) => \{[\s\S]*clearLyricScrollTimeout\(\)[\s\S]*clearTimeout\(delayScrollTimeout\)[\s\S]*cancelScrollFn\(\)[\s\S]*document\.removeEventListener\('mousemove', handleMouseMsMove\)/m,
    'Lyric view should cancel delayed and animated scroll callbacks before removing global listeners',
  )
})

test('RG-050: webpack transpiles TypeScript without build-time type-check blocking', () => {
  const renderer = read('build-config', 'renderer', 'webpack.config.base.js')
  const rendererScripts = read('build-config', 'renderer-scripts', 'webpack.config.base.js')
  const main = read('build-config', 'main', 'webpack.config.base.js')

  for (const source of [renderer, rendererScripts, main]) {
    assert.match(
      source,
      /loader: 'ts-loader'[\s\S]*transpileOnly: true/m,
      'ts-loader should stay in fast transpile mode; npm run typecheck remains the explicit semantic check',
    )
  }
})

test('RG-051: play detail chunk is deferred until the first open', () => {
  const app = read('src', 'renderer', 'App.vue')

  assert.match(
    app,
    /<layout-play-detail v-if="isPlayDetailMounted" \/>/m,
    'Play detail should not mount on cold start when it is hidden',
  )
  assert.match(
    app,
    /const isPlayDetailMounted = ref\(isShowPlayerDetail\.value\)[\s\S]*watch\(isShowPlayerDetail, show => \{[\s\S]*if \(show\) isPlayDetailMounted\.value = true[\s\S]*\}\)/m,
    'After the first open, PlayDetail should stay mounted so its internal leave transition remains unchanged',
  )
})

test('RG-052: global component registration avoids lodash on the startup path', () => {
  const components = read('src', 'renderer', 'components', 'index.js')

  assert.doesNotMatch(
    components,
    /lodash\/(?:upperFirst|camelCase)|from 'lodash|from "lodash/m,
    'Cold-start component registration should not pull lodash helpers into the startup chunk',
  )
  assert.match(
    components,
    /\.split\(pathPartRxp\)[\s\S]*\.map\(part => part\.charAt\(0\)\.toUpperCase\(\) \+ part\.slice\(1\)\)[\s\S]*componentName\.endsWith\('Index'\)/m,
    'The local component-name formatter should preserve the existing path-to-component convention',
  )
})

test('RG-053: dialog component is loaded only when a dialog is shown', () => {
  const dialog = read('src', 'renderer', 'plugins', 'Dialog', 'index.js')

  assert.doesNotMatch(
    dialog,
    /import Dialog from '\.\/Dialog\.vue'/m,
    'Installing the dialog plugin should not eagerly load Dialog.vue on startup',
  )
  assert.match(
    dialog,
    /return import\('\.\/Dialog\.vue'\)\.then\(\(\{ default: Dialog \}\) => new Promise/m,
    'Dialog.vue should be dynamically imported when dialog() is called',
  )
})

test('RG-054: update metadata request code is loaded on demand', () => {
  const useUpdate = read('src', 'renderer', 'core', 'useApp', 'useUpdate.ts')

  assert.doesNotMatch(
    useUpdate,
    /import \{ getVersionInfo \} from '@renderer\/utils\/update'/m,
    'Update request helpers should not be part of the renderer startup path',
  )
  assert.match(
    useUpdate,
    /import\('@renderer\/utils\/update'\)\.then\(\(\{ getVersionInfo \}\) => getVersionInfo\(\)\)/m,
    'Version metadata should be loaded when update handling actually needs it',
  )
})

test('RG-055: music metadata writers are loaded by file type', () => {
  const musicMeta = read('src', 'common', 'utils', 'musicMeta', 'index.js')

  assert.doesNotMatch(
    musicMeta,
    /const (?:mp3Meta|flacMeta) = require\('\.\/(?:mp3Meta|flacMeta)'\)/m,
    'Loading the music metadata facade should not eagerly load every tag writer',
  )
  assert.match(
    musicMeta,
    /case '\.mp3':[\s\S]*require\('\.\/mp3Meta'\)\(filePath, meta, proxy\)[\s\S]*case '\.flac':[\s\S]*require\('\.\/flacMeta'\)\(filePath, meta, proxy\)/m,
    'Metadata writers should be required only for the file type being written',
  )
})

test('RG-056: tooltip component is loaded only when a tooltip is shown', () => {
  const tips = read('src', 'renderer', 'plugins', 'Tips', 'Tips.js')
  const tipsIndex = read('src', 'renderer', 'plugins', 'Tips', 'index.js')

  assert.doesNotMatch(
    tips,
    /import Tips from '\.\/Tips\.vue'/m,
    'Installing tooltip listeners should not eagerly load Tips.vue on startup',
  )
  assert.match(
    tips,
    /tipsComponentPromise \|\|= import\('\.\/Tips\.vue'\)\.then\(\(\{ default: Tips \}\) => Tips\)/m,
    'Tips.vue should be dynamically imported only when a tooltip instance is created',
  )
  assert.match(
    tipsIndex,
    /const requestId = \+\+tipRequestId[\s\S]*if \(requestId != tipRequestId \|\| isDraging\) \{[\s\S]*nextInstance\?\.cancel\(\)/m,
    'Stale async tooltip creation should be cancelled after pointer movement or dragging',
  )
  assert.match(
    tipsIndex,
    /const passiveListenerOptions = \{ passive: true \}[\s\S]*addEventListener\('mousemove'[\s\S]*passiveListenerOptions\)/m,
    'Tooltip pointer tracking should use passive listeners',
  )
})

test('RG-057: app data initialization overlaps independent startup IPC work', () => {
  const useDataInit = read('src', 'renderer', 'core', 'useApp', 'useDataInit.ts')

  assert.match(
    useDataInit,
    /const initUserApiTask = initUserApi\(\)\.catch[\s\S]*const userListsTask = getUserLists\(\)\.then[\s\S]*const dislikeInfoTask = initDislikeInfo\(\)/m,
    'User API setup, list loading, and dislike loading should be started without serial IPC waits',
  )
  assert.match(
    useDataInit,
    /await initUserApiTask[\s\S]*if \(appSetting\['common\.apiSource'\] != 'temp'\) initMusicSdk\(\)[\s\S]*await userListsTask[\s\S]*await dislikeInfoTask[\s\S]*await initPrevPlayInfo\(\)/m,
    'Playback restore should still wait for API setup while independent data loads finish in parallel',
  )
})

test('RG-058: media session silent audio is created lazily', () => {
  const useMediaSessionInfo = read('src', 'renderer', 'core', 'useApp', 'usePlayer', 'useMediaSessionInfo.ts')

  assert.doesNotMatch(
    useMediaSessionInfo,
    /const emptyAudio = new Audio\(\)[\s\S]*void emptyAudio\.play\(\)/m,
    'Media session setup should not create and play a silent audio element during player initialization',
  )
  assert.match(
    useMediaSessionInfo,
    /let emptyAudio: HTMLAudioElement \| null = null[\s\S]*const getEmptyAudio = \(\) => \{[\s\S]*emptyAudio = new Audio\(\)[\s\S]*return emptyAudio[\s\S]*const handleSetPlayInfo = \(\) => \{[\s\S]*const audio = getEmptyAudio\(\)[\s\S]*void audio\.play\(\)/m,
    'The silent audio element should be created only when media session metadata is first refreshed',
  )
  assert.match(
    useMediaSessionInfo,
    /emptyAudio\?\.pause\(\)[\s\S]*emptyAudio\?\.removeAttribute\('src'\)[\s\S]*emptyAudio = null/m,
    'The lazy media session audio element should be released on teardown',
  )
})

test('RG-059: global modal components are not loaded until they are visible', () => {
  const app = read('src', 'renderer', 'App.vue')

  assert.match(
    app,
    /<layout-change-log-modal v-if="isShowChangeLog" \/>/m,
    'ChangeLogModal should stay out of the startup render tree until it is shown',
  )
  assert.match(
    app,
    /<layout-update-modal v-if="versionInfo\.showModal" \/>/m,
    'UpdateModal should stay out of the startup render tree until update state requests it',
  )
  assert.match(
    app,
    /<layout-pact-modal v-if="!appSetting\['common\.isAgreePact'\] \|\| isShowPact" \/>/m,
    'PactModal should load on first-run or explicit pact display, not on every accepted startup',
  )
  assert.match(
    app,
    /<layout-sync-mode-modal v-if="sync\.isShowSyncMode" \/>[\s\S]*<layout-sync-auth-code-modal v-if="sync\.isShowAuthCodeModal" \/>/m,
    'Sync modals should be loaded only while their sync prompts are visible',
  )
})

test('RG-060: optional startup network work waits until after the app is initialized', () => {
  const useApp = read('src', 'renderer', 'core', 'useApp', 'index.ts')

  assert.match(
    useApp,
    /const runAfterStartupIdle = \(callback: \(\) => void\) => \{[\s\S]*requestIdleCallback[\s\S]*timeout: 3000[\s\S]*callback\(\)[\s\S]*\}/m,
    'Startup should provide an idle scheduler for optional post-init work',
  )
  assert.match(
    useApp,
    /sendInited\(\)[\s\S]*runAfterStartupIdle\(\(\) => \{[\s\S]*handleListAutoUpdate\(\)[\s\S]*checkUpdate\(\)[\s\S]*\}\)/m,
    'List auto-update and software update checks should run after the renderer has reported initialization',
  )
  assert.doesNotMatch(
    useApp,
    /sendInited\(\)\s*\n\s*handleListAutoUpdate\(\)/m,
    'Optional network update work should not run synchronously at the end of startup initialization',
  )
})

test('RG-061: player startup does not statically load every online music SDK', () => {
  const musicUtils = read('src', 'renderer', 'core', 'music', 'utils.ts')

  assert.doesNotMatch(
    musicUtils,
    /import musicSdk from '@renderer\/utils\/musicSdk'/m,
    'Core playback utilities should not pull the full online music SDK graph into the startup path',
  )
  assert.match(
    musicUtils,
    /musicSdkPromise \|\|= import\('@renderer\/utils\/musicSdk'\)\.then\(\(\{ default: musicSdk \}\) => musicSdk\)/m,
    'The full online music SDK should be loaded only when an online source operation needs it',
  )
  assert.match(
    musicUtils,
    /const musicSdk = await getMusicSdk\(\)[\s\S]*musicSdk\[musicInfo\.source\]\.getMusicUrl/m,
    'Online URL resolution should load the SDK on demand before using a source implementation',
  )
})

test('RG-062: startup listeners load Electron shell helpers only when opening links', () => {
  const useEventListener = read('src', 'renderer', 'core', 'useApp', 'useEventListener.ts')
  const useInitUserApi = read('src', 'renderer', 'core', 'useApp', 'useInitUserApi.ts')

  for (const source of [useEventListener, useInitUserApi]) {
    assert.doesNotMatch(
      source,
      /import \{ openUrl \} from '@common\/utils\/electron'/m,
      'Startup modules should not statically import Electron shell helpers for rarely-used link opening',
    )
    assert.match(
      source,
      /import\('@common\/utils\/electron'\)[\s\S]*openUrl\(url\)/m,
      'Electron shell helpers should be imported on demand when an external URL is opened',
    )
  }
})

test('RG-063: startup playback path uses narrow renderer utility imports', () => {
  const useEventListener = read('src', 'renderer', 'core', 'useApp', 'useEventListener.ts')
  const usePlayer = read('src', 'renderer', 'core', 'useApp', 'usePlayer', 'usePlayer.ts')
  const playerAction = read('src', 'renderer', 'core', 'player', 'action.ts')
  const musicUtils = read('src', 'renderer', 'core', 'music', 'utils.ts')

  for (const source of [useEventListener, usePlayer, playerAction, musicUtils]) {
    assert.doesNotMatch(
      source,
      /from '@renderer\/utils(?:\/index)?'/m,
      'Startup playback modules should avoid the broad @renderer/utils barrel import',
    )
  }
  assert.match(
    useEventListener,
    /from '@renderer\/utils\/screen'/m,
    'Window sizing should import only the screen helper needed during startup',
  )
  assert.match(
    usePlayer,
    /from '@renderer\/utils\/document'/m,
    'Title updates should import only the document helper needed by the player',
  )
  assert.match(
    playerAction,
    /from '@common\/utils\/common'/m,
    'Playback retry jitter should use the common random helper directly instead of the renderer utility barrel',
  )
  assert.match(
    musicUtils,
    /from '@renderer\/utils\/langS2T'[\s\S]*from '@common\/utils\/tools'/m,
    'Online music helpers should import text conversion and music-shape helpers from narrow modules',
  )
})

test('RG-064: Electron process memory metrics are available on demand', () => {
  const ipcNames = read('src', 'common', 'ipcNames.ts')
  const winMain = read('src', 'main', 'modules', 'winMain', 'main.ts')
  const appRendererEvent = read('src', 'main', 'modules', 'winMain', 'rendererEvent', 'app.ts')
  const rendererIpc = read('src', 'renderer', 'utils', 'ipc.ts')

  assert.match(
    ipcNames,
    /get_memory_metrics: 'get_memory_metrics'/m,
    'The main window IPC names should include an explicit on-demand memory metrics channel',
  )
  assert.match(
    winMain,
    /app\.getAppMetrics\(\)/m,
    'Memory diagnostics should use Electron process metrics instead of relying on OS process-name guessing',
  )
  assert.match(
    appRendererEvent,
    /mainHandle\(WIN_MAIN_RENDERER_EVENT_NAME\.get_memory_metrics,[\s\S]*getMemoryMetrics\(\)/m,
    'The memory metrics channel should be exposed through the existing winMain renderer event module',
  )
  assert.match(
    rendererIpc,
    /export const getMemoryMetrics = async\(\) => \{[\s\S]*WIN_MAIN_RENDERER_EVENT_NAME\.get_memory_metrics/m,
    'Renderer code should be able to request memory metrics only when diagnostics need them',
  )
})

test('RG-065: hidden user API runtime avoids hidden-window painting work', () => {
  const userApiWindow = read('src', 'main', 'modules', 'userApi', 'main.ts')

  assert.match(
    userApiWindow,
    /show: false,[\s\S]*paintWhenInitiallyHidden: false,[\s\S]*webPreferences:/m,
    'The hidden User API BrowserWindow should not keep initial hidden painting enabled',
  )
  assert.match(
    userApiWindow,
    /webContents\.once\('did-finish-load', async\(\) => \{[\s\S]*USER_API_RENDERER_EVENT_NAME\.initEnv[\s\S]*getScript\(userApi\.id\)[\s\S]*\}\)/m,
    'User API initialization should wait for the hidden page to load instead of relying on ready-to-show',
  )
  assert.doesNotMatch(
    userApiWindow,
    /ready-to-show[\s\S]*USER_API_RENDERER_EVENT_NAME\.initEnv/m,
    'Disabling hidden painting prevents ready-to-show from being a reliable initialization signal',
  )
})

test('RG-066: memory diagnostics are opt-in and process scoped', () => {
  const winMain = read('src', 'main', 'modules', 'winMain', 'main.ts')
  const winMainIndex = read('src', 'main', 'modules', 'winMain', 'index.ts')

  assert.match(
    winMain,
    /export const logMemoryMetrics = \(label = 'snapshot'\) => \{[\s\S]*getMemoryMetrics\(\)[\s\S]*log\.info\(`\[memory\]\[\$\{label\}\]/m,
    'Memory snapshots should be logged through an explicit diagnostic helper',
  )
  assert.match(
    winMainIndex,
    /main_window_inited[\s\S]*cmdParams\['memory-metrics'\][\s\S]*logMemoryMetrics\('main-window-inited'\)[\s\S]*logMemoryMetrics\('main-window-inited\+10s'\)/m,
    'Memory diagnostics should run only when the memory-metrics command-line flag is provided',
  )
})

test('RG-067: user API runtime clears pending requests on reload and close', () => {
  const rendererEvent = read('src', 'main', 'modules', 'userApi', 'rendererEvent', 'rendererEvent.ts')
  const userApiIndex = read('src', 'main', 'modules', 'userApi', 'index.ts')

  assert.match(
    rendererEvent,
    /export const cancelAllRequests = \(message = 'Cancel request'\) => \{[\s\S]*for \(const \[requestKey, request\] of requestQueue\)[\s\S]*request\[1\]\(new Error\(message\)\)[\s\S]*clearRequestTimeout\(requestKey\)[\s\S]*requestQueue\.clear\(\)/m,
    'Pending User API requests and timeouts should be released when the hidden runtime is discarded',
  )
  assert.match(
    rendererEvent,
    /export const loadApi = async\(apiId: string\) => \{[\s\S]*cancelAllRequests\('API runtime reloaded'\)/m,
    'Reloading a User API should reject stale requests before replacing the hidden runtime',
  )
  assert.match(
    userApiIndex,
    /main_window_close[\s\S]*cancelAllRequests\('Main window closed'\)[\s\S]*closeWindow\(\)/m,
    'Closing the main window should clear User API queues before destroying the hidden runtime',
  )
})

test('RG-068: next-track preload audio is destroyed when the preload task is cancelled', () => {
  const preload = read('src', 'renderer', 'core', 'useApp', 'usePlayer', 'usePreloadNextMusic.ts')

  assert.match(
    preload,
    /let audio: HTMLAudioElement \| null = null[\s\S]*const releasePreloadAudio = \(destroy = false\) => \{[\s\S]*audio\.removeAttribute\('src'\)[\s\S]*if \(!destroy\) return[\s\S]*audio\.removeEventListener\('playing', handlePreloadPlaying\)[\s\S]*audio = null/m,
    'The temporary preload audio element should be fully releasable after cancellation or teardown',
  )
  assert.match(
    preload,
    /const preloadAudio = initAudio\(\)[\s\S]*preloadAudio\.addEventListener\('error', handleErr\)[\s\S]*preloadAudio\.src = url[\s\S]*preloadAudio\.load\(\)/m,
    'URL probing should keep listener cleanup scoped to the current temporary audio element',
  )
  assert.match(
    preload,
    /const resetPreloadInfo = \(\) => \{[\s\S]*releasePreloadAudio\(true\)[\s\S]*onBeforeUnmount\(\(\) => \{[\s\S]*releasePreloadAudio\(true\)/m,
    'Changing tracks and unmounting should destroy the temporary preload audio element',
  )
})

test('RG-069: main startup overlaps DB, settings, and hotkey initialization', () => {
  const app = read('src', 'main', 'app.ts')

  assert.match(
    app,
    /const hotKeyTask = global\.lx\.inited \? null : initHotKey\(\)[\s\S]*const settingTask = !isInitialized \? initSetting\(\) : null[\s\S]*const dbInitTask = !isInitialized \? global\.lx\.worker\.dbService\.init\(global\.lxDataPath\) : null/m,
    'Independent main-process startup tasks should be started before awaiting any single one',
  )
  assert.match(
    app,
    /const config = await hotKeyTask![\s\S]*let dbFileExists = await dbInitTask![\s\S]*global\.lx\.appSetting = \(await settingTask!\)\.setting/m,
    'Hotkey, DB, and setting results should be awaited from their already-started tasks instead of serially invoked',
  )
  assert.doesNotMatch(
    app,
    /let dbFileExists = await global\.lx\.worker\.dbService\.init\(global\.lxDataPath\)[\s\S]*global\.lx\.appSetting = \(await initSetting\(\)\)\.setting/m,
    'DB initialization should not fully block settings loading in a serial startup chain',
  )
})

test('RG-070: auto updater is loaded only when update actions are requested', () => {
  const winMainIndex = read('src', 'main', 'modules', 'winMain', 'index.ts')
  const autoUpdate = read('src', 'main', 'modules', 'winMain', 'autoUpdate.ts')

  assert.doesNotMatch(
    winMainIndex,
    /import initUpdate from '\.\/autoUpdate'/m,
    'The main window module should not statically load electron-updater during startup',
  )
  assert.match(
    winMainIndex,
    /updateModulePromise \?\?= import\('\.\/autoUpdate'\)[\s\S]*mod\.default\(\)/m,
    'Auto updater dependencies should be dynamically imported and initialized on first update action',
  )
  assert.match(
    winMainIndex,
    /WIN_MAIN_RENDERER_EVENT_NAME\.update_check[\s\S]*getUpdateModule\(\)\.then\(\(\{ checkUpdate \}\) => \{[\s\S]*checkUpdate\(\)/m,
    'Update checks should still be wired through the lightweight startup IPC listener',
  )
  assert.match(
    autoUpdate,
    /let isInitialized = false[\s\S]*export default \(\) => \{[\s\S]*if \(isInitialized\) return[\s\S]*autoUpdater\.logger = log[\s\S]*autoUpdater\.autoDownload = false/m,
    'The heavy updater module should initialize its listeners exactly once after it is dynamically loaded',
  )
  assert.doesNotMatch(
    autoUpdate,
    /mainOn\(WIN_MAIN_RENDERER_EVENT_NAME\.update_check/m,
    'The dynamically loaded updater module should not register duplicate IPC listeners',
  )
})

test('RG-071: optional network service modules are loaded on first use', () => {
  const syncEvent = read('src', 'main', 'modules', 'winMain', 'rendererEvent', 'sync.ts')
  const openApiEvent = read('src', 'main', 'modules', 'winMain', 'rendererEvent', 'openAPI.ts')

  assert.doesNotMatch(
    syncEvent,
    /from '@main\/modules\/sync'/m,
    'The sync service implementation should not be statically loaded with winMain renderer events',
  )
  assert.match(
    syncEvent,
    /syncModulePromise \?\?= import\('@main\/modules\/sync'\)[\s\S]*mod\.default\(\)/m,
    'Sync service dependencies and cleanup hooks should be initialized when a sync IPC action is first used',
  )
  assert.match(
    syncEvent,
    /WIN_MAIN_RENDERER_EVENT_NAME\.sync_action[\s\S]*await getSyncModule\(\)[\s\S]*startServer[\s\S]*connectServer/m,
    'Sync IPC actions should retain the existing action protocol after lazy loading the service',
  )
  assert.doesNotMatch(
    openApiEvent,
    /from '@main\/modules\/openApi'/m,
    'The OpenAPI HTTP server implementation should not be statically loaded with winMain renderer events',
  )
  assert.match(
    openApiEvent,
    /openApiModulePromise \?\?= import\('@main\/modules\/openApi'\)[\s\S]*await getOpenApiModule\(\)[\s\S]*startServer[\s\S]*stopServer[\s\S]*getStatus/m,
    'OpenAPI actions should dynamically load the HTTP server implementation on demand',
  )
})

test('RG-072: Bili service implementation and cookie injection are loaded on first use', () => {
  const bili = read('src', 'main', 'modules', 'bili', 'index.ts')

  assert.doesNotMatch(
    bili,
    /from '\.\/(?:api|request|cookie)'/m,
    'Bili API, request, and cookie implementation modules should not be loaded during main-module registration',
  )
  assert.match(
    bili,
    /apiModulePromise \?\?= import\('\.\/api'\)[\s\S]*requestModulePromise \?\?= import\('\.\/request'\)[\s\S]*import\('\.\/cookie'\)\.then\(\(\{ injectAuthCookie \}\) => injectAuthCookie\(\)\)/m,
    'Bili implementation modules and auth-cookie injection should be loaded lazily',
  )
  assert.match(
    bili,
    /BILI_RENDERER_EVENT_NAME\.search[\s\S]*await ensureAuthCookie\(\)[\s\S]*const \{ search \} = await getApiModule\(\)[\s\S]*return search\(params\)/m,
    'Bili source actions should still use the existing IPC action contract after lazy loading',
  )
  assert.match(
    bili,
    /BILI_RENDERER_EVENT_NAME\.account_set_cookie[\s\S]*const \{ setBiliCookie \} = await getRequestModule\(\)[\s\S]*const \{ getAccountInfo \} = await getApiModule\(\)[\s\S]*await setBiliCookie\(params\)[\s\S]*return getAccountInfo\(\)/m,
    'Bili account cookie updates should keep the existing set-cookie then account-info behavior',
  )
})

test('RG-073: song-list and leaderboard route state uses lightweight SDK metadata', () => {
  const songListState = read('src', 'renderer', 'store', 'songList', 'state.ts')
  const leaderboardState = read('src', 'renderer', 'store', 'leaderboard', 'state.ts')
  const songListAction = read('src', 'renderer', 'store', 'songList', 'action.ts')
  const leaderboardAction = read('src', 'renderer', 'store', 'leaderboard', 'action.ts')
  const staticMeta = read('src', 'renderer', 'utils', 'musicSdk', 'staticMeta.ts')

  assert.doesNotMatch(
    songListState,
    /@renderer\/utils\/musicSdk['"]/m,
    'Song-list state should not load the full music SDK just to build sort metadata',
  )
  assert.doesNotMatch(
    leaderboardState,
    /@renderer\/utils\/musicSdk['"]/m,
    'Leaderboard state should not load the full music SDK just to build source metadata',
  )
  assert.match(
    songListState,
    /from '@renderer\/utils\/musicSdk\/staticMeta'[\s\S]*markRaw\(\[\.\.\.songListSources\]\)[\s\S]*songListSorts\[source\]/m,
    'Song-list route state should read stable source and sort metadata from the lightweight metadata module',
  )
  assert.match(
    leaderboardState,
    /from '@renderer\/utils\/musicSdk\/staticMeta'[\s\S]*markRaw\(\[\.\.\.leaderboardSources\]\)/m,
    'Leaderboard route state should read stable source metadata from the lightweight metadata module',
  )
  assert.match(
    songListAction,
    /musicSdkPromise \?\?= import\('@renderer\/utils\/musicSdk'\)[\s\S]*await getMusicSdk\(\)[\s\S]*songList\.getTags/m,
    'Song-list request actions should dynamically import the full music SDK only when a request is made',
  )
  assert.match(
    leaderboardAction,
    /musicSdkPromise \?\?= import\('@renderer\/utils\/musicSdk'\)[\s\S]*await getMusicSdk\(\)[\s\S]*leaderboard\.getBoards/m,
    'Leaderboard request actions should dynamically import the full music SDK only when a request is made',
  )
  assert.match(
    staticMeta,
    /songListSources = \['kw', 'kg', 'tx', 'wy', 'mg', 'bili'\][\s\S]*leaderboardSources = \['kw', 'kg', 'tx', 'wy', 'mg'\][\s\S]*tx: \[[\s\S]*\{ name: '最热', id: 5 \}/m,
    'The lightweight metadata should preserve the existing route source order and non-string QQ sort ids',
  )
})

test('RG-074: default search route and online-list menus avoid eager full SDK loads', () => {
  const searchMusicAction = read('src', 'renderer', 'store', 'search', 'music', 'action.ts')
  const searchSongListAction = read('src', 'renderer', 'store', 'search', 'songlist', 'action.ts')
  const onlineListMenu = read('src', 'renderer', 'components', 'material', 'OnlineList', 'useMenu.js')
  const onlineListActions = read('src', 'renderer', 'components', 'material', 'OnlineList', 'useMusicActions.js')
  const staticMeta = read('src', 'renderer', 'utils', 'musicSdk', 'staticMeta.ts')

  for (const source of [searchMusicAction, searchSongListAction, onlineListActions]) {
    assert.doesNotMatch(
      source,
      /import .* from '@renderer\/utils\/musicSdk'/m,
      'Default search and online-list action modules should not statically import the full music SDK',
    )
    assert.match(
      source,
      /import\('@renderer\/utils\/musicSdk'\)/m,
      'Default search and online-list action modules should dynamically import the full SDK when an online operation runs',
    )
  }

  assert.doesNotMatch(
    onlineListMenu,
    /@renderer\/utils\/musicSdk['"]/m,
    'Online-list menu visibility should not load the full SDK only to detect source-detail support',
  )
  assert.match(
    onlineListMenu,
    /from '@renderer\/utils\/musicSdk\/staticMeta'[\s\S]*hasMusicDetailPage\(musicInfo\.source\)/m,
    'Online-list menu visibility should use lightweight source-detail metadata',
  )
  assert.match(
    staticMeta,
    /musicDetailPageSources = \['kw', 'kg', 'tx', 'wy', 'mg', 'bili'\][\s\S]*hasMusicDetailPage/m,
    'The lightweight metadata should preserve the existing online source-detail support list',
  )
})

test('RG-075: comment, download, and list menus avoid eager full SDK loads', () => {
  const musicComment = read('src', 'renderer', 'components', 'layout', 'PlayDetail', 'components', 'MusicComment', 'index.vue')
  const downloadMenu = read('src', 'renderer', 'views', 'Download', 'useMenu.js')
  const downloadActions = read('src', 'renderer', 'views', 'Download', 'useTaskActions.js')
  const myListMenu = read('src', 'renderer', 'views', 'List', 'MyList', 'useMenu.js')
  const myListIndex = read('src', 'renderer', 'views', 'List', 'MyList', 'index.vue')
  const listUpdateModal = read('src', 'renderer', 'views', 'List', 'MyList', 'components', 'ListUpdateModal.vue')
  const staticMeta = read('src', 'renderer', 'utils', 'musicSdk', 'staticMeta.ts')

  for (const source of [musicComment, downloadActions, myListIndex]) {
    assert.doesNotMatch(
      source,
      /import .* from '@renderer\/utils\/musicSdk'/m,
      'Comment/detail action modules should not statically import the full music SDK',
    )
    assert.match(
      source,
      /import\('@renderer\/utils\/musicSdk'\)/m,
      'Comment/detail action modules should dynamically import the full SDK when the action runs',
    )
  }

  for (const source of [downloadMenu, myListMenu, listUpdateModal]) {
    assert.doesNotMatch(
      source,
      /@renderer\/utils\/musicSdk['"]/m,
      'Menu and modal capability checks should not load the full music SDK',
    )
  }

  assert.match(
    musicComment,
    /from '@renderer\/utils\/musicSdk\/staticMeta'[\s\S]*await getMusicSdk\(\)[\s\S]*comment\.getComment[\s\S]*hasComment\(this\.currentMusicInfo\.source\)/m,
    'Music comments should use lightweight capability metadata before loading SDK comment implementations on demand',
  )
  assert.match(
    downloadMenu,
    /from '@renderer\/utils\/musicSdk\/staticMeta'[\s\S]*hasMusicDetailPage\(taskInfo\.metadata\.musicInfo\.source\)/m,
    'Download item menus should use lightweight metadata for source detail visibility',
  )
  assert.match(
    myListMenu,
    /from '@renderer\/utils\/musicSdk\/staticMeta'[\s\S]*hasLeaderboardDetailPage\(source\)[\s\S]*hasSongListDetailPage\(source\)[\s\S]*hasSongList\(source\)/m,
    'My-list menus should use lightweight metadata for sync and source-detail capabilities',
  )
  assert.match(
    listUpdateModal,
    /from '@renderer\/utils\/musicSdk\/staticMeta'[\s\S]*userLists\.filter\(l => hasSongList\(l\.source\)\)/m,
    'List update modal should filter online source lists without loading the full SDK',
  )
  assert.match(
    staticMeta,
    /songListDetailPageSources = \['kw', 'kg', 'tx', 'wy', 'mg', 'bili'\][\s\S]*leaderboardDetailPageSources = \['kg', 'tx', 'wy', 'mg'\][\s\S]*commentSources = \['kw', 'kg', 'tx', 'wy', 'mg', 'bili', 'local'\]/m,
    'Lightweight metadata should preserve comment and source-detail support lists',
  )
})
