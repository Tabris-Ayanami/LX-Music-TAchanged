const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '..', '..')
const filename = path.join(root, 'src', 'common', 'rendererIpc.ts')
const source = fs.readFileSync(filename, 'utf8')

const loadIpc = ipcRenderer => {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const defaultRequire = loaded.require.bind(loaded)
  let nextSubscriptionId = 1
  const subscriptions = new Map()
  const bridge = {
    ipc: {
      on(name, callback) {
        const subscriptionId = nextSubscriptionId++
        const wrapper = (_event, params) => { callback(params) }
        subscriptions.set(subscriptionId, { name, wrapper })
        ipcRenderer.on(name, wrapper)
        return subscriptionId
      },
      off(subscriptionId) {
        const subscription = subscriptions.get(subscriptionId)
        if (!subscription) return
        subscriptions.delete(subscriptionId)
        ipcRenderer.removeListener(subscription.name, subscription.wrapper)
      },
    },
  }
  loaded.require = request => request == './hostBridge' ? { getHostBridge: () => bridge } : defaultRequire(request)
  loaded._compile(output, filename)
  return loaded.exports
}

test('rendererOff removes the wrapper installed by rendererOn', () => {
  const listeners = new Map()
  const ipcRenderer = {
    on(name, listener) {
      const current = listeners.get(name) ?? []
      current.push(listener)
      listeners.set(name, current)
    },
    removeListener(name, listener) {
      const current = listeners.get(name) ?? []
      listeners.set(name, current.filter(item => item !== listener))
    },
  }
  const ipc = loadIpc(ipcRenderer)
  let calls = 0
  const listener = ({ params }) => {
    calls += params
  }

  ipc.rendererOn('event', listener)
  assert.equal(listeners.get('event').length, 1)
  listeners.get('event').forEach(wrapper => wrapper({ sender: 'test' }, 2))
  assert.equal(calls, 2)

  ipc.rendererOff('event', listener)
  assert.equal(listeners.get('event').length, 0)
  assert.equal(ipc.rendererOff('event', listener), undefined)
})
