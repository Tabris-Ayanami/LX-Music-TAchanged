const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const collectDependencyFiles = require('../../build-config/collect-dependency-files')

const root = path.resolve(__dirname, '../..')

test('NCM packaging includes the API and QR dependencies without including the project root', () => {
  const files = collectDependencyFiles(path.join(root, 'node_modules/@neteasecloudmusicapienhanced/api'))
  assert(files.includes('node_modules/@neteasecloudmusicapienhanced/api/**/*'))
  assert(files.includes('node_modules/qrcode/**/*'))
  assert(files.every(file => file.startsWith('node_modules/') && !file.includes('../')), 'Every dependency glob must stay inside node_modules')
})

test('dependency collection handles builtins, nested packages, export maps and missing optional packages', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lxta-deps-'))
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }))
  const writePackage = (relative, json) => {
    const dir = path.join(fixture, relative)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(json))
    return dir
  }
  const entry = writePackage('node_modules/api', { name: 'api', dependencies: { fs: '*', child: '1', punycode: '2' }, optionalDependencies: { absent: '1' } })
  writePackage('node_modules/api/node_modules/child', { name: 'child', exports: { import: './index.mjs' }, dependencies: { leaf: '1' } })
  writePackage('node_modules/leaf', { name: 'leaf' })
  writePackage('node_modules/punycode', { name: 'punycode' })
  const files = collectDependencyFiles(entry, fixture)
  assert.deepEqual(files.sort(), ['node_modules/api/**/*', 'node_modules/api/node_modules/child/**/*', 'node_modules/leaf/**/*', 'node_modules/punycode/**/*'].sort())
})

test('missing required package stops packaging instead of producing a broken installer', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lxta-deps-'))
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }))
  const entry = path.join(fixture, 'node_modules/api')
  fs.mkdirSync(entry, { recursive: true })
  fs.writeFileSync(path.join(entry, 'package.json'), JSON.stringify({ name: 'api', dependencies: { absent: '1' } }))
  assert.throws(() => collectDependencyFiles(entry, fixture), /Missing required dependency.*absent/)
})
