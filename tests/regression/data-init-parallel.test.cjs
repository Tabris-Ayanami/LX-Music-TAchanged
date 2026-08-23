const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '..', '..')
const source = fs.readFileSync(path.join(root, 'src', 'renderer', 'core', 'useApp', 'useDataInit.ts'), 'utf8')

const loadTs = mocks => {
  const filename = path.join(root, 'src', 'renderer', 'core', 'useApp', 'useDataInit.ts')
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const defaultRequire = loaded.require.bind(loaded)
  loaded.require = request => Object.hasOwn(mocks, request) ? mocks[request] : defaultRequire(request)
  loaded._compile(output, filename)
  return loaded.exports.default
}

test('data initialization starts independent list, dislike, and restore tasks together', () => {
  assert.match(source, /await Promise\.all\(\[[\s\S]*getUserLists\(\)[\s\S]*initDislikeInfo\(\)[\s\S]*initPrevPlayInfo\(\)/m)
  assert.match(source, /getUserLists\(\)\.then\(lists => \{[\s\S]*window\.lxData\.userLists = lists/m)
})

test('parallel data initialization waits for the slowest independent task', async() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const originalWindow = global.window
  global.window = { app_event: { myListUpdate: () => {} }, lx: { restorePlayInfo: null }, lxData: {} }

  try {
    const initData = loadTs({
      '@renderer/utils/ipc': { getPlayInfo: async() => { await sleep(25); return null } },
      '@renderer/utils/musicSdk': { __esModule: true, default: { init: async() => {} } },
      '@common/utils': { log: { error: () => {} } },
      '@renderer/store/list/action': {
        getListMusics: async() => [],
        getUserLists: async() => { await sleep(25); return [] },
        registerAction: () => () => {},
      },
      './useInitUserApi': { __esModule: true, default: () => async() => {} },
      '@renderer/core/player': { play: () => {}, playList: () => {} },
      '@common/utils/vueTools': { onBeforeUnmount: () => {} },
      '@renderer/store/setting': { appSetting: { 'player.startupAutoPlay': false } },
      '@renderer/store/player/state': { playMusicInfo: { musicInfo: null } },
      '@renderer/core/dislikeList': {
        initDislikeInfo: async() => { await sleep(25) },
        registerRemoteDislikeAction: () => () => {},
      },
    })
    const startedAt = performance.now()
    await initData()()
    const elapsed = performance.now() - startedAt
    assert.ok(elapsed < 65, `independent initialization should overlap (elapsed ${elapsed.toFixed(1)} ms)`)
  } finally {
    global.window = originalWindow
  }
})
