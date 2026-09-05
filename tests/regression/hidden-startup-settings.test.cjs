const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../../src/main/utils/index.ts'), 'utf8')
const start = source.indexOf('const primitiveType')
const end = source.indexOf('/**', source.indexOf('export const updateSetting'))
const output = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

for (const saved of [undefined, { 'tray.enable': false }, { 'tray.enable': true }]) {
  for (const hidden of [false, true]) {
    test(`initial settings support hidden=${hidden}, saved=${JSON.stringify(saved)}`, () => {
      let stored
      const defaults = { version: '2.1.0', 'tray.enable': false }
      const context = {
        exports: {}, global: { envParams: { cmdParams: { hidden } } },
        defaultSetting: defaults, migrateSetting: value => value,
        STORE_NAMES: { APP_SETTINGS: 'config_v2' },
        getStore: () => ({ override: value => { stored = value } }),
      }
      vm.runInNewContext(output, context)
      const result = context.exports.updateSetting(saved, true)
      assert.equal(result.setting['tray.enable'], hidden || saved?.['tray.enable'] || false)
      assert.equal(stored.setting, result.setting)
      assert.equal(defaults['tray.enable'], false)
    })
  }
}
