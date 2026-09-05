const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const setup = (createQrLogin, checkQrLogin = async() => ({ code: 801 })) => {
  const text = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/views/Setting/components/SettingAccount.vue'), 'utf8')
  const source = text.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '').replace('export default', 'module.exports =')
  const timers = new Map()
  const cleanup = []
  const saved = []
  let sequence = 0
  const context = {
    module: { exports: {} }, console: { log() {}, warn() {} },
    ref: value => ({ value }), computed: getter => ({ get value() { return getter() } }),
    onBeforeUnmount: fn => cleanup.push(fn), onDeactivated: fn => cleanup.push(fn),
    appSetting: {}, mergeSetting: value => saved.push(value), updateSetting() {},
    wyAccountIcon: '', biliAccountIcon: '', window: { i18n: { t: key => key } },
    music: { wy: { account: { createQrLogin, checkQrLogin, getAccountInfo: async() => ({ isLogin: true }) } } },
    setTimeout: fn => { const id = ++sequence; timers.set(id, fn); return id },
    clearTimeout: id => timers.delete(id),
  }
  vm.runInNewContext(source, context)
  return { state: context.module.exports.setup(), timers, cleanup, saved }
}

test('closing QR login ignores a pending QR image and does not restart polling', async() => {
  const request = deferred()
  const { state, timers } = setup(() => request.promise)
  state.openWyQrLogin()
  state.closeWyQrLogin()
  request.resolve({ qrimg: 'old-image', unikey: 'old-key' })
  await flush()
  assert.equal(state.wyQrImg.value, '')
  assert.equal(timers.size, 0)
})

test('refreshing QR login rejects a late response from the previous refresh', async() => {
  const old = deferred()
  const fresh = deferred()
  let count = 0
  const { state, timers } = setup(() => (++count == 1 ? old : fresh).promise)
  state.openWyQrLogin()
  const refresh = state.refreshWyQrLogin()
  fresh.resolve({ qrimg: 'fresh-image', unikey: 'fresh-key' })
  await refresh
  old.resolve({ qrimg: 'old-image', unikey: 'old-key' })
  await flush()
  assert.equal(state.wyQrImg.value, 'fresh-image')
  assert.equal(timers.size, 1)
})

test('closing QR login ignores an in-flight authorization result', async() => {
  const check = deferred()
  const { state, saved } = setup(async() => ({ qrimg: 'image', unikey: 'key' }), () => check.promise)
  state.openWyQrLogin()
  await flush()
  state.closeWyQrLogin()
  check.resolve({ code: 803, cookie: 'test-cookie' })
  await flush()
  assert.equal(saved.length, 0)
})

test('leaving account settings cancels in-flight polling and releases the QR image', async() => {
  const check = deferred()
  const { state, timers, cleanup } = setup(async() => ({ qrimg: 'image', unikey: 'key' }), () => check.promise)
  state.openWyQrLogin()
  await flush()
  cleanup.forEach(fn => fn())
  check.resolve({ code: 801 })
  await flush()
  assert.equal(timers.size, 0)
  assert.equal(state.wyQrImg.value, '')
})
