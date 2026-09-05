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
  // Match the webpack-ignored imports used by the local metadata editor.
  const loaderPath = path.join(archive, 'dist/taglib-package-probe.cjs')
  const loader = new Module(loaderPath)
  loader.filename = loaderPath
  loader._compile("module.exports = async() => ({ simple: await import('taglib-wasm/simple'), full: await import('taglib-wasm') })", loaderPath)
  const { simple, full } = await loader.exports()
  const taglib = await full.TagLib.initialize()
  for (const extension of ['mp3', 'flac']) {
    const filePath = path.join(process.cwd(), 'metadata-fixture.' + extension)
    const [metadata, cover, pictures] = await Promise.all([
      simple.readMetadata(filePath), simple.readCoverArt(filePath), simple.readPictureMetadata(filePath),
    ])
    assert.equal(metadata.tags.title[0], 'Packaged metadata fixture')
    assert(metadata.properties.duration > 0)
    assert(!cover?.length)
    assert.equal(pictures.length, 0)
    await simple.applyTagsToFile(filePath, { title: '编辑后的标题', artist: ['测试歌手'], album: '测试专辑' })
    const edited = await simple.readMetadata(filePath)
    assert.equal(edited.tags.title[0], '编辑后的标题')
    assert.equal(edited.tags.artist[0], '测试歌手')
    assert.equal(edited.tags.album[0], '测试专辑')
    const lyric = '[00:00.00]打包后歌词读写测试'
    await taglib.edit(filePath, file => file.setLyrics([{ text: lyric, description: 'LX-TA synchronized lyrics' }]))
    const verified = await simple.readMetadata(filePath)
    assert.equal(verified.tags.lyrics[0].text, lyric)
    assert.equal(verified.tags.title[0], '编辑后的标题')
  }
  process.stdout.write('Packaged MP3/FLAC metadata and embedded lyrics read/write passed\n')
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
  for (const entry of [
    'node_modules/@neteasecloudmusicapienhanced/api/package.json', 'node_modules/qrcode/package.json', 'dist/main.js',
    'node_modules/taglib-wasm/package.json', 'node_modules/taglib-wasm/dist/simple.js',
    'node_modules/taglib-wasm/dist/index.js', 'node_modules/taglib-wasm/dist/taglib-web.wasm',
    'node_modules/@msgpack/msgpack/package.json',
  ]) {
    assert(files.includes(`/${entry}`), `Missing packaged file: ${entry}`)
  }
  assert(!files.some(file => /^\/(?:src|tests|docs|\.git)(?:\/|$)/.test(file)), 'Project sources were included in app.asar')
  assert(!files.some(file => /\/(?:agents?\.md|\.codex)(?:\/|$)/i.test(file)), 'Agent instructions were included in app.asar')
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
    // ESM imports bypass Module._resolveFilename. Copy the archive outside the
    // checkout so a missing package cannot silently resolve from dev node_modules.
    const isolatedArchive = path.join(runtime, 'app.asar')
    fs.copyFileSync(archive, isolatedArchive)
    if (fs.existsSync(archive + '.unpacked')) fs.cpSync(archive + '.unpacked', isolatedArchive + '.unpacked', { recursive: true })
    for (const extension of ['mp3', 'flac']) {
      const fixture = spawnSync(ffmpeg, [
        '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
        '-metadata', 'title=Packaged metadata fixture', path.join(runtime, 'metadata-fixture.' + extension),
      ], { encoding: 'utf8', timeout: 10000, windowsHide: true })
      assert.equal(fixture.status, 0, fixture.error?.message || fixture.stderr || 'Cannot create metadata fixture')
    }
    const result = spawnSync(path.join(appDir, 'LX-TA.exe'), ['-e', probe, isolatedArchive, live ? 'live' : 'offline'], {
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
