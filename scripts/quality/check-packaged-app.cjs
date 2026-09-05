const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync, execFileSync } = require('node:child_process')
const asar = require('@electron/asar')

const probe = String.raw`
const assert = require('node:assert/strict')
const { createRequire, isBuiltin } = require('node:module')
const Module = require('node:module')
const path = require('node:path')
const archive = process.argv[1]
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) {
  const file = resolve.call(this, request, ...args)
  assert(isBuiltin(file) || file.startsWith(archive + path.sep), 'Dependency resolved outside the packaged app: ' + request)
  return file
}
console.log = console.warn = console.error = () => {}
;(async() => {
  const appRequire = createRequire(path.join(archive, 'dist/main.js'))
  const Database = appRequire('better-sqlite3')
  const database = new Database(':memory:')
  assert.equal(database.prepare('SELECT 1 AS value').get().value, 1)
  database.close()
  const api = appRequire('@neteasecloudmusicapienhanced/api')
  let key = 'packaged-qr-smoke-test'
  if (process.argv[2] == 'live') {
    const response = await api.login_qr_key({})
    key = response.body?.data?.unikey ?? response.body?.data?.data?.unikey
    assert(key, 'NetEase login key was not returned')
  }
  const response = await api.login_qr_create({ key, qrimg: true })
  assert(response.body?.data?.qrimg?.startsWith('data:image/png;base64,'), 'QR image was not generated')
  process.stdout.write('Packaged NetEase QR generation passed\n')
  process.exit(0)
})().catch(error => {
  process.stderr.write(String(error.message).split('\n')[0] + '\n')
  process.exit(1)
})
`

const checkPackagedApp = (appDir, { live = false } = {}) => {
  const archive = path.join(appDir, 'resources', 'app.asar')
  const files = asar.listPackage(archive).map(file => file.replaceAll('\\', '/'))
  for (const entry of ['node_modules/@neteasecloudmusicapienhanced/api/package.json', 'node_modules/qrcode/package.json', 'dist/main.js']) {
    assert(files.includes(`/${entry}`), `Missing packaged file: ${entry}`)
  }
  assert(!files.some(file => /^\/(?:src|tests|docs|\.git)(?:\/|$)/.test(file)), 'Project sources were included in app.asar')
  const version = JSON.parse(asar.extractFile(archive, 'package.json')).version
  assert.equal(version, require('../../package.json').version, 'Packaged version differs from the source version')
  const buildInfo = JSON.parse(asar.extractFile(archive, 'dist/build-info.json'))
  assert.equal(buildInfo.version, version, 'Compiled code is from a different version; rebuild before packaging')
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }).trim()
  assert.equal(buildInfo.commit, commit, 'Compiled code is from a different commit; rebuild before packaging')
  const ffmpeg = path.join(appDir, 'resources/ffmpeg/ffmpeg.exe')
  assert(fs.existsSync(ffmpeg), 'Packaged ffmpeg is missing')
  const ffmpegResult = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8', timeout: 10000, windowsHide: true })
  assert.equal(ffmpegResult.status, 0, 'Packaged ffmpeg cannot run')

  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'lxta-package-check-'))
  try {
    const result = spawnSync(path.join(appDir, 'LX-TA.exe'), ['-e', probe, archive, live ? 'live' : 'offline'], {
      cwd: runtime,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: '', TEMP: runtime, TMP: runtime },
      encoding: 'utf8', timeout: 30000, windowsHide: true,
    })
    assert.equal(result.status, 0, result.error?.message || result.stderr || 'Packaged QR probe failed')
    console.log(result.stdout.trim())
    console.log(`Packaged v${version}: dependency isolation, archive contents and ffmpeg passed`)
  } finally {
    fs.rmSync(runtime, { recursive: true, force: true })
  }
}

module.exports = { checkPackagedApp }
if (require.main === module) {
  checkPackagedApp(path.resolve(process.argv[2] || 'build/win-unpacked'), { live: process.argv.includes('--live') })
}
