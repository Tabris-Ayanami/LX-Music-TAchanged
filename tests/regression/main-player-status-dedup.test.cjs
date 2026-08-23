const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const rootDir = path.resolve(__dirname, '..', '..')
const sourcePath = path.join(rootDir, 'src', 'main', 'event', 'playerStatus.ts')

const loadHelper = () => {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, Object }, { filename: sourcePath })
  return module.exports.applyPlayerStatusPatch
}

test('main player status broadcasts only changed fields', () => {
  const applyPlayerStatusPatch = loadHelper()
  const current = { status: 'playing', progress: 12, duration: 180, lyric: 'line' }

  const first = applyPlayerStatusPatch(current, { status: 'playing', progress: 12, lyric: 'next' })
  assert.deepEqual(first, { lyric: 'next' })
  assert.deepEqual(current, { status: 'playing', progress: 12, duration: 180, lyric: 'next' })

  const second = applyPlayerStatusPatch(current, { status: 'playing', progress: 12, lyric: 'next' })
  assert.equal(second, null)
})

test('main player status dedup uses SameValueZero-safe equality for NaN', () => {
  const applyPlayerStatusPatch = loadHelper()
  const current = { progress: Number.NaN }
  assert.equal(applyPlayerStatusPatch(current, { progress: Number.NaN }), null)
})
