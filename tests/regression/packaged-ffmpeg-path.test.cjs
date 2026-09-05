const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

test('packaged audio conversion resolves ffmpeg from resources independently of the working directory', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/main/modules/nativeCore/supervisor.ts'), 'utf8')
  const start = source.indexOf('export const resolveFfmpeg')
  const end = source.indexOf('const resolveLibmpv', start)
  const resourcesPath = path.resolve('fixture/resources')
  const expected = path.join(resourcesPath, 'ffmpeg', 'ffmpeg.exe')
  const context = { path, existsSync: file => file == expected, app: { isPackaged: true }, process: { env: {}, resourcesPath, platform: 'win32', arch: 'x64', cwd: () => path.resolve('unrelated') } }
  vm.runInNewContext(source.slice(start, end).replace('export const', 'const') + '\nthis.result = resolveFfmpeg()', context)
  assert.equal(context.result, expected)
})
