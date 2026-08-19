const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

const loadTs = relativePath => {
  const filename = path.join(root, relativePath)
  const source = require('node:fs').readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(output, filename)
  return loaded.exports
}

test('user-source DevTools are blocked in production unless -odt was explicitly supplied', () => {
  const { shouldOpenUserApiDevTools } = loadTs('src/main/modules/userApi/devTools.ts')

  assert.equal(shouldOpenUserApiDevTools('production', {}), false)
  assert.equal(shouldOpenUserApiDevTools(undefined, {}), false)
  assert.equal(shouldOpenUserApiDevTools('production', { odt: true }), true)
  assert.equal(shouldOpenUserApiDevTools('development', {}), true)
})
