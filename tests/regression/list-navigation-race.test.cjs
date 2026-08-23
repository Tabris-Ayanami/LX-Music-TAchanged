const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

const loadJs = (relativePath, mocks) => {
  const filename = path.join(root, relativePath)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      allowJs: true,
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

const deferred = () => {
  let resolveDeferred
  const promise = new Promise(resolve => { resolveDeferred = resolve })
  return { promise, resolve: resolveDeferred }
}

const flushPromises = async() => {
  await Promise.resolve()
  await Promise.resolve()
}

const createHarness = initialListId => {
  const props = { listId: initialListId, musicList: null }
  const requests = []
  const watchers = []
  const appListeners = new Map()
  const originalWindow = global.window
  global.window = {
    app_event: {
      on: (name, listener) => appListeners.set(name, listener),
      off: () => {},
    },
  }

  const vueTools = {
    ref: value => ({ value }),
    shallowRef: value => ({ value }),
    computed: getter => ({ get value() { return getter() } }),
    onBeforeUnmount: () => {},
    watch: (source, callback, options = {}) => {
      watchers.push({ source, callback })
      if (options.immediate) callback(source())
    },
  }
  const getListMusics = id => {
    const request = { id, ...deferred() }
    requests.push(request)
    return request.promise
  }
  const useListInfo = loadJs('src/renderer/views/List/MusicList/useListInfo.js', {
    '@common/utils/vueTools': vueTools,
    '@renderer/store/player/state': {
      playMusicInfo: { listId: null },
      playInfo: { playIndex: -1 },
    },
    '@renderer/store/list/action': {
      getListMusics,
      retainMusicListCache: () => () => {},
    },
    '@renderer/store/setting': { appSetting: { 'list.isShowSource': false } },
  }).default
  const state = useListInfo({ props, onLoadedList: () => {} })

  return {
    appListeners,
    props,
    requests,
    state,
    restore: () => { global.window = originalWindow },
    switchList: id => {
      props.listId = id
      const listIdWatcher = watchers.find(watcher => watcher.source() == id)
      listIdWatcher.callback(id)
    },
  }
}

test('rapid list switches keep the newest list when requests finish out of order', async() => {
  const harness = createHarness('list-a')
  try {
    harness.switchList('list-b')
    harness.switchList('list-c')

    harness.requests[2].resolve([{ id: 'song-c' }])
    await flushPromises()
    harness.requests[0].resolve([{ id: 'song-a' }])
    await flushPromises()
    harness.requests[1].resolve([{ id: 'song-b' }])
    await flushPromises()

    assert.deepEqual(harness.state.list.value, [{ id: 'song-c' }])
  } finally {
    harness.restore()
  }
})

test('an old list-update response cannot replace a newly selected list', async() => {
  const harness = createHarness('list-a')
  try {
    harness.requests[0].resolve([{ id: 'song-a' }])
    await flushPromises()
    harness.appListeners.get('myListUpdate')(['list-a'])
    harness.switchList('list-b')

    harness.requests[2].resolve([{ id: 'song-b' }])
    await flushPromises()
    harness.requests[1].resolve([{ id: 'updated-song-a' }])
    await flushPromises()

    assert.deepEqual(harness.state.list.value, [{ id: 'song-b' }])
  } finally {
    harness.restore()
  }
})
