const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8')

test('player status IPC drops unchanged fields before crossing the renderer boundary', () => {
  const source = read('src', 'renderer', 'utils', 'ipc.ts').replaceAll('\r\n', '\n')

  assert.match(
    source,
    /export const createPlayerStatusSender = \(send: \(status: Partial<LX\.Player\.Status>\) => void\)[\s\S]*Object\.is\(lastStatus\[key\], value\)[\s\S]*send\(changed as Partial<LX\.Player\.Status>\)/m,
    'Player status sender should compare each field and send only a changed patch',
  )
  assert.match(
    source,
    /export const sendPlayerStatus = createPlayerStatusSender[\s\S]*WIN_MAIN_RENDERER_EVENT_NAME\.player_status/m,
    'The Electron IPC wrapper should use the deduplicating sender',
  )

  const start = source.indexOf('export const createPlayerStatusSender')
  const end = source.indexOf('\n\nexport const sendPlayerStatus', start)
  const snippet = source.slice(start, end).replace('export const', 'const') + '\nmodule.exports = { createPlayerStatusSender }'
  const compiled = ts.transpileModule(snippet, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports, Object })

  const sent = []
  const send = module.exports.createPlayerStatusSender(value => { sent.push(value) })
  send({ status: 'playing', progress: 0.5 })
  send({ status: 'playing', progress: 0.5 })
  send({ progress: 0.6 })
  assert.equal(JSON.stringify(sent), JSON.stringify([
    { status: 'playing', progress: 0.5 },
    { progress: 0.6 },
  ]), 'Repeated status patches should not cross the IPC boundary')
})
