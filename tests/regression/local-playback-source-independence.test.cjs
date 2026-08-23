const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

const loadTs = (relativePath, mocks) => {
  const filename = path.join(root, relativePath)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const defaultRequire = loaded.require.bind(loaded)
  loaded.require = request => Object.hasOwn(mocks, request) ? mocks[request] : defaultRequire(request)
  loaded._compile(output, filename)
  return loaded.exports
}

test('local playback data becomes ready while user-source initialization is still pending', async() => {
  const initialized = []
  const pendingSource = new Promise(() => {})
  const originalWindow = global.window
  global.window = {
    app_event: { myListUpdate: () => {} },
    lx: { restorePlayInfo: null },
    lxData: {},
  }

  try {
    const useDataInit = loadTs('src/renderer/core/useApp/useDataInit.ts', {
      '@renderer/utils/ipc': { getPlayInfo: async() => null },
      '@renderer/utils/musicSdk': { __esModule: true, default: { init: async() => {} } },
      '@common/utils': { log: { error: () => {} } },
      '@renderer/store/list/action': {
        getListMusics: async() => [],
        getUserLists: async() => {
          initialized.push('lists')
          return []
        },
        registerAction: () => () => {},
      },
      './useInitUserApi': { __esModule: true, default: () => async() => pendingSource },
      '@renderer/core/player': { play: () => {}, playList: () => {} },
      '@common/utils/vueTools': { onBeforeUnmount: () => {} },
      '@renderer/store/setting': { appSetting: { 'player.startupAutoPlay': false } },
      '@renderer/store/player/state': { playMusicInfo: { musicInfo: null } },
      '@renderer/core/dislikeList': {
        initDislikeInfo: async() => { initialized.push('dislike') },
        registerRemoteDislikeAction: () => () => {},
      },
    }).default

    const result = await Promise.race([
      useDataInit()().then(() => 'local-ready'),
      new Promise(resolve => setImmediate(() => resolve('source-blocked'))),
    ])

    assert.equal(result, 'local-ready')
    assert.deepEqual(initialized, ['lists', 'dislike'])
  } finally {
    global.window = originalWindow
  }
})
