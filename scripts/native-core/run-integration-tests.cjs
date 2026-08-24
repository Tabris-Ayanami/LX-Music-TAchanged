const assert = require('node:assert/strict')
const { spawn, execFileSync } = require('node:child_process')
const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const os = require('node:os')
const net = require('node:net')
const http = require('node:http')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { generate, formats } = require('./media-fixtures.cjs')

const executable = path.resolve(__dirname, '../../native-core/target/debug/lx-native-core.exe')
const sourceRoot = path.resolve(__dirname, '../../src')
const kgShimPath = path.join(os.tmpdir(), 'lx-native-core-kg-shim.cjs')
const kgSource = fsSync.readFileSync(path.join(sourceRoot, 'common/utils/lyricUtils/kg.js'), 'utf8')
  .replace("import { inflate } from 'zlib'", "const { inflate } = require('node:zlib')")
  .replace("import { decodeName } from './util'", "const decodeName = (str = '') => str.replace(/(?:&amp;|&lt;|&gt;|&quot;|&apos;|&#039;|&nbsp;)/gm, value => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '\"', '&apos;': \"'\", '&#039;': \"'\" })[value] ?? '')")
  .replace('export const decodeKrc =', 'exports.decodeKrc =')
fsSync.writeFileSync(kgShimPath, kgSource, 'utf8')
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function(request, parent, ...rest) {
  if (request == '@common/utils/lyricUtils/kg') return kgShimPath
  const alias = request.startsWith('@common/')
    ? path.join(sourceRoot, 'common', request.slice('@common/'.length))
    : request.startsWith('@main/')
      ? path.join(sourceRoot, 'main', request.slice('@main/'.length))
      : null
  if (alias) {
    for (const candidate of [alias, `${alias}.ts`, `${alias}.js`, `${alias}.json`, path.join(alias, 'index.ts'), path.join(alias, 'index.js')]) {
      try { return originalResolveFilename.call(this, candidate, parent, ...rest) } catch {}
    }
  }
  return originalResolveFilename.call(this, request, parent, ...rest)
}
const hashFile = async(file) => createHash('sha256').update(await fs.readFile(file)).digest('hex')
const wait = async(ms) => new Promise(resolve => setTimeout(resolve, ms))
const loadTypeScriptModule = async(file) => {
  const source = await fs.readFile(file, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText
  const loaded = new Module(file, module)
  loaded.filename = file
  loaded.paths = Module._nodeModulePaths(path.dirname(file))
  loaded._compile(output, file)
  return loaded.exports
}
const waitForLine = async(stream, pattern) => new Promise((resolve, reject) => {
  let text = ''
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}`)), 5_000)
  stream.on('data', chunk => {
    text += chunk.toString()
    if (!pattern.test(text)) return
    clearTimeout(timer)
    resolve()
  })
})

const startDownloadServer = async(body) => {
  const server = http.createServer((request, response) => {
    const range = request.headers.range?.match(/^bytes=(\d+)-/)
    const start = range ? Number(range[1]) : 0
    if (start >= body.length) {
      response.writeHead(416, { 'Content-Range': `bytes */${body.length}` })
      response.end()
      return
    }
    const payload = body.subarray(start)
    response.writeHead(range ? 206 : 200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': payload.length,
      ...(range ? { 'Content-Range': `bytes ${start}-${body.length - 1}/${body.length}` } : {}),
    })
    response.end(payload)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  return {
    url: `http://127.0.0.1:${address.port}/fixture.bin`,
    close: async() => new Promise(resolve => server.close(resolve)),
  }
}

const waitForDownloads = async(client, jobIds) => {
  const pending = new Set(jobIds)
  const completed = new Map()
  let rpcCalls = 0
  for (let attempt = 0; attempt < 500; attempt++) {
    const statuses = await client.call('download.http.status_many', { jobIds: [...pending] })
    rpcCalls++
    for (const status of statuses) {
      if (status.state != 'running') {
        completed.set(status.jobId, status)
        pending.delete(status.jobId)
      }
    }
    if (!pending.size) return { statuses: jobIds.map(jobId => completed.get(jobId)), rpcCalls }
    await wait(20)
  }
  throw new Error(`download jobs did not finish: ${jobIds.join(', ')}`)
}

class RpcClient {
  constructor(socket) {
    this.socket = socket
    this.pending = new Map()
    this.buffer = Buffer.alloc(0)
    socket.on('data', chunk => this.onData(chunk))
    socket.on('close', () => this.rejectAll(new Error('pipe closed')))
    socket.on('error', error => this.rejectAll(error))
  }

  call(method, params = {}, requestId = randomUUID()) {
    const body = Buffer.from(JSON.stringify({ protocolVersion: '1.0', requestId, method, params }))
    const frame = Buffer.alloc(4 + body.length)
    frame.writeUInt32LE(body.length, 0)
    body.copy(frame, 4)
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.socket.write(frame)
    })
  }

  close() { this.socket.destroy() }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length >= 4) {
      const size = this.buffer.readUInt32LE(0)
      if (this.buffer.length < size + 4) return
      const response = JSON.parse(this.buffer.subarray(4, size + 4).toString())
      this.buffer = this.buffer.subarray(size + 4)
      const pending = this.pending.get(response.requestId)
      if (!pending) continue
      this.pending.delete(response.requestId)
      if (response.error) pending.reject(Object.assign(new Error(response.error.message), response.error))
      else pending.resolve(response.result)
    }
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}

const connect = async(pipeName, child) => {
  let lastError
  for (let index = 0; index < 100; index++) {
    if (child.exitCode != null) throw new Error(`sidecar exited before connect: ${child.exitCode}`)
    try {
      const socket = await new Promise((resolve, reject) => {
        const candidate = net.createConnection(pipeName)
        candidate.once('connect', () => resolve(candidate))
        candidate.once('error', reject)
      })
      return new RpcClient(socket)
    } catch (error) {
      lastError = error
      await wait(40)
    }
  }
  throw lastError
}

const startCore = async(fixture, options = {}) => {
  const pipeName = `\\\\.\\pipe\\lx-ta-native-test-${process.pid}-${randomUUID()}`
  const args = [
    '--pipe', pipeName,
    '--profile', fixture.profile,
    '--cache', fixture.cache,
    '--ffmpeg', fixture.ffmpegPath,
    '--artwork-cache-budget', String(options.budget ?? 2 * 1024 * 1024),
  ]
  const child = spawn(executable, args, { windowsHide: true, env: { ...process.env, ...(options.env ?? {}) }, stdio: ['ignore', 'ignore', 'pipe'] })
  let logs = ''
  child.stderr.on('data', value => { logs += value.toString() })
  const client = await connect(pipeName, child)
  return { child, client, logs: () => logs, stop: () => { client.close(); if (!child.killed) child.kill() } }
}

const fullMetadata = (value) => ({
  ...value,
  embeddedLyrics: value.embeddedLyrics ?? '',
  artworkPresent: value.artworkPresent ?? false,
})

const run = async() => {
  execFileSync('cargo', ['build', '--manifest-path', path.resolve(__dirname, '../../native-core/Cargo.toml')], { stdio: 'inherit' })
  const fixture = await generate()
  const legacyMedia = await loadTypeScriptModule(path.resolve(__dirname, '../../src/main/modules/localMusicTools/metadata.ts'))
  const report = { formats: {}, shadowDifferences: {}, failureTests: {}, artwork: {}, library: {}, download: {}, player: {}, root: fixture.root }
  let core = await startCore(fixture)
  try {
    const handshake = await core.client.call('core.handshake')
    assert.equal(handshake.protocolVersion, '1.0')
    assert.ok(handshake.capabilities.includes('metadata.read'))
    assert.ok(handshake.capabilities.includes('metadata.read_library_batch'))
    assert.ok(handshake.capabilities.includes('artwork.variant'))
    assert.ok(handshake.capabilities.includes('library.scan'))
    assert.ok(handshake.capabilities.includes('download.ffmpeg.convert'))
    assert.ok(handshake.capabilities.includes('download.http.job'))
    assert.ok(handshake.capabilities.includes('download.http.status_many'))
    assert.ok(handshake.capabilities.includes('player.libmpv.probe'))
    const playerProbe = await core.client.call('player.probe')
    assert.equal(playerProbe.available, false)
    assert.match(playerProbe.reason, /not configured/)
    report.player.libmpv = playerProbe

    const libraryRoot = path.join(fixture.work, 'library-scan')
    const libraryNested = path.join(libraryRoot, 'nested')
    await fs.mkdir(libraryNested, { recursive: true })
    await fs.copyFile(fixture.files.mp3, path.join(libraryRoot, 'one.MP3'))
    await fs.copyFile(fixture.files.flac, path.join(libraryNested, 'two.flac'))
    await fs.writeFile(path.join(libraryNested, 'ignore.txt'), 'not music')
    const libraryFiles = await core.client.call('library.scan', { folders: [libraryRoot, libraryRoot] })
    assert.equal(libraryFiles.length, 2)
    assert.ok(libraryFiles.some(file => file.endsWith('one.MP3')))
    assert.ok(libraryFiles.some(file => file.endsWith('two.flac')))
    const batchStartedAt = performance.now()
    const libraryMetadata = await core.client.call('metadata.read_library_batch', { filePaths: libraryFiles })
    const batchElapsedMs = performance.now() - batchStartedAt
    assert.equal(libraryMetadata.length, libraryFiles.length)
    assert.ok(libraryMetadata.every(value => value && value.title != null && value.artists != null && value.album != null && value.duration > 0 && value.embeddedLyrics == null && value.coverDataUrl == null))
    report.library = {
      scan: { folders: 1, files: libraryFiles.length, duplicateRootsRemoved: true },
      metadataBatch: { files: libraryMetadata.length, rpcCalls: 1, elapsedMs: Number(batchElapsedMs.toFixed(1)), fields: ['filePath', 'title', 'artists', 'album', 'duration'] },
    }

    const convertedAudio = path.join(fixture.work, 'native-converted.mp3')
    const conversion = await core.client.call('download.ffmpeg.convert', {
      inputPath: fixture.files.m4a,
      outputPath: convertedAudio,
      extension: 'mp3',
      quality: '192k',
    })
    assert.equal(conversion.outputPath, convertedAudio)
    const convertedMetadata = await core.client.call('metadata.read', { filePath: convertedAudio })
    assert.ok(convertedMetadata.duration > 0)
    report.download.ffmpeg = { extension: 'mp3', duration: convertedMetadata.duration, outputExists: true }

    const downloadBody = await fs.readFile(fixture.files.mp3)
    const downloadServer = await startDownloadServer(downloadBody)
    try {
      const downloadedPath = path.join(fixture.work, 'native-http-download.mp3')
      const started = await core.client.call('download.http.start', { url: downloadServer.url, outputPath: downloadedPath })
      const resumedPath = path.join(fixture.work, 'native-http-resume.mp3')
      await fs.writeFile(resumedPath, downloadBody.subarray(0, Math.floor(downloadBody.length / 2)))
      const resumed = await core.client.call('download.http.start', { url: downloadServer.url, outputPath: resumedPath })
      const completedBatch = await waitForDownloads(core.client, [started.jobId, resumed.jobId])
      const [completed, resumeCompleted] = completedBatch.statuses
      assert.equal(completed.state, 'completed')
      assert.equal(completed.downloaded, downloadBody.length)
      assert.deepEqual(await fs.readFile(downloadedPath), downloadBody)
      assert.equal(resumeCompleted.state, 'completed')
      assert.deepEqual(await fs.readFile(resumedPath), downloadBody)
      report.download.http = { bytes: downloadBody.length, fresh: 'passed', resume: 'passed', statusMany: { jobCount: 2, rpcCalls: completedBatch.rpcCalls, rpcCallsPerPoll: 1, estimatedSeparateCalls: completedBatch.rpcCalls * 2 } }
    } finally {
      await downloadServer.close()
    }

    const cancellationTarget = path.join(fixture.work, 'cancellation-target.wav')
    await fs.copyFile(fixture.files.wav, cancellationTarget)
    const cancellationId = randomUUID()
    const cancellation = core.client.call('artwork.variant', {
      filePath: cancellationTarget,
      externalArtworkPath: fixture.largeArtwork,
      size: 512,
    }, cancellationId)
    const cancellationAssertion = assert.rejects(cancellation, error => error.code == 'aborted')
    await core.client.call('rpc.cancel', { requestId: cancellationId })
    await cancellationAssertion
    report.failureTests.cancellation = 'passed'

    for (const extension of formats) {
      let metadata
      try { metadata = await core.client.call('metadata.read', { filePath: fixture.files[extension] }) } catch (error) {
        throw new Error(`metadata corpus failed for ${extension}: ${error.message}`, { cause: error })
      }
      assert.equal(metadata.filePath, fixture.files[extension])
      assert.ok(metadata.duration > 0, `${extension} duration should be readable`)
      report.formats[extension] = { format: metadata.format, duration: metadata.duration, title: metadata.title, artworkPresent: metadata.artworkPresent }
      const legacy = await legacyMedia.readLocalMetadata(fixture.files[extension])
      const legacyLyrics = await legacyMedia.readLocalEmbeddedLyrics(fixture.files[extension]).catch(() => '')
      const comparisons = {
        title: [legacy.title, metadata.title], artists: [legacy.artists, metadata.artists], album: [legacy.album, metadata.album],
        albumArtists: [legacy.albumArtists, metadata.albumArtists], genre: [legacy.genre, metadata.genre], year: [legacy.year, metadata.year],
        trackNumber: [legacy.trackNumber, metadata.trackNumber], totalTracks: [legacy.totalTracks, metadata.totalTracks],
        discNumber: [legacy.discNumber, metadata.discNumber], totalDiscs: [legacy.totalDiscs, metadata.totalDiscs],
        comment: [legacy.comment, metadata.comment], composer: [legacy.composer, metadata.composer], embeddedLyrics: [legacyLyrics, metadata.embeddedLyrics],
        duration: [legacy.duration, metadata.duration], bitrate: [legacy.bitrate, metadata.bitrate], sampleRate: [legacy.sampleRate, metadata.sampleRate],
        artworkPresent: [Boolean(legacy.coverDataUrl), metadata.artworkPresent],
      }
      report.shadowDifferences[extension] = Object.fromEntries(Object.entries(comparisons).filter(([field, values]) => {
        if (field == 'duration') return Math.abs(Number(values[0]) - Number(values[1])) > 0.05
        if (field == 'bitrate') return Math.abs(Number(values[0]) - Number(values[1])) > 2
        return JSON.stringify(values[0]) != JSON.stringify(values[1])
      }))
    }
    assert.equal(report.formats.wav.title, '')
    assert.equal(report.formats.flac.title, 'Unicode 标题・テスト')
    assert.match((await core.client.call('metadata.lyrics.read', { filePath: fixture.files.flac })) || '', /Stage 1/)
    await assert.rejects(core.client.call('metadata.read', { filePath: fixture.malformed }))
    report.failureTests.malformed = 'passed'

    for (const size of [64, 128, 256, 512]) {
      const artwork = await core.client.call('artwork.variant', { filePath: fixture.files.mp3, size })
      assert.ok(artwork)
      assert.ok(artwork.width <= size && artwork.height <= size)
      assert.equal(path.extname(artwork.cachePath), '.webp')
      await fs.access(artwork.cachePath)
      report.artwork[size] = { width: artwork.width, height: artwork.height, byteLength: artwork.byteLength }
    }
    const external = await core.client.call('artwork.variant', { filePath: fixture.files.wav, externalArtworkPath: fixture.largeArtwork, size: 128 })
    assert.ok(external && external.width == 128 && external.height == 128)
    const oriented = await core.client.call('artwork.variant', { filePath: fixture.files.flac, externalArtworkPath: fixture.orientationArtwork, size: 128 })
    assert.ok(oriented && oriented.width < oriented.height, `EXIF orientation was not applied: ${JSON.stringify(oriented)}`)
    report.artwork.orientation = { width: oriented.width, height: oriented.height }
    const changedMedia = path.join(fixture.work, 'artwork-change.mp3')
    await fs.copyFile(fixture.files.mp3, changedMedia)
    const changedBefore = await core.client.call('artwork.variant', { filePath: changedMedia, size: 64 })
    const changedTime = new Date(Date.now() + 5_000)
    await fs.utimes(changedMedia, changedTime, changedTime)
    const changedAfter = await core.client.call('artwork.variant', { filePath: changedMedia, size: 64 })
    assert.notEqual(changedBefore.id, changedAfter.id)
    report.artwork.fileChangeInvalidation = 'passed'
    const beforeInvalidate = await core.client.call('artwork.cache.stats')
    const removed = await core.client.call('artwork.invalidate', { filePath: fixture.files.mp3 })
    assert.ok(removed >= 4)
    const afterInvalidate = await core.client.call('artwork.cache.stats')
    assert.ok(afterInvalidate.entryCount < beforeInvalidate.entryCount)
    report.artwork.cache = { beforeInvalidate, afterInvalidate }

    const writable = path.join(fixture.work, 'write-copy.mp3')
    await fs.copyFile(fixture.files.mp3, writable)
    const original = await core.client.call('metadata.read', { filePath: writable })
    const updated = await core.client.call('metadata.write', {
      filePath: writable,
      metadata: fullMetadata({ ...original, title: 'Native 写入验证', comment: 'round trip' }),
      coverChanged: false,
    })
    assert.equal(updated.title, 'Native 写入验证')
    assert.equal((await core.client.call('metadata.read', { filePath: writable })).title, 'Native 写入验证')
    report.failureTests.normalWriteRoundTrip = 'passed'
    const withExternalArtwork = await core.client.call('metadata.write', {
      filePath: writable,
      metadata: fullMetadata({ ...updated, coverDataUrl: '' }),
      coverChanged: true,
      coverSourcePath: fixture.largeArtwork,
    })
    assert.equal(withExternalArtwork.artworkPresent, true)
    const withoutArtwork = await core.client.call('metadata.write', {
      filePath: writable,
      metadata: fullMetadata({ ...withExternalArtwork, coverDataUrl: '', artworkPresent: false }),
      coverChanged: true,
    })
    assert.equal(withoutArtwork.artworkPresent, false)
    report.failureTests.artworkWriteAndRemove = 'passed'

    const readOnly = path.join(fixture.work, 'readonly.mp3')
    await fs.copyFile(fixture.files.mp3, readOnly)
    const readOnlyHash = await hashFile(readOnly)
    await fs.chmod(readOnly, 0o444)
    try {
      await assert.rejects(core.client.call('metadata.write', { filePath: readOnly, metadata: fullMetadata({ ...original, filePath: readOnly, title: 'must-not-commit' }), coverChanged: false }))
      assert.equal(await hashFile(readOnly), readOnlyHash)
      report.failureTests.readOnly = 'passed'
    } finally { await fs.chmod(readOnly, 0o666) }

    const locked = path.join(fixture.work, 'locked.mp3')
    await fs.copyFile(fixture.files.mp3, locked)
    const lockedHash = await hashFile(locked)
    const locker = spawn('powershell.exe', ['-NoProfile', '-Command', "$stream=[IO.File]::Open($env:LX_LOCK_PATH,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None); Write-Output 'locked'; Start-Sleep -Seconds 30"], {
      env: { ...process.env, LX_LOCK_PATH: locked }, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    })
    try {
      await waitForLine(locker.stdout, /locked/)
      await assert.rejects(core.client.call('metadata.write', { filePath: locked, metadata: fullMetadata({ ...original, filePath: locked, title: 'must-not-commit' }), coverChanged: false }))
    } finally {
      locker.kill()
      await new Promise(resolve => locker.once('exit', resolve))
    }
    assert.equal(await hashFile(locked), lockedHash)
    report.failureTests.locked = 'passed'
  } finally {
    core.stop()
  }

  for (const failpoint of ['after-copy', 'after-write', 'after-verify', 'after-commit']) {
    const target = path.join(fixture.work, `failure-${failpoint}.mp3`)
    await fs.copyFile(fixture.files.mp3, target)
    const before = await hashFile(target)
    core = await startCore(fixture, { env: { LX_NATIVE_TEST_FAILPOINT: failpoint } })
    try {
      const metadata = await core.client.call('metadata.read', { filePath: target })
      await assert.rejects(core.client.call('metadata.write', { filePath: target, metadata: fullMetadata({ ...metadata, title: `failure-${failpoint}` }), coverChanged: false }))
      assert.equal(await hashFile(target), before, `${failpoint} changed the original`)
      report.failureTests[failpoint] = 'passed'
    } finally { core.stop() }
  }

  const crashTarget = path.join(fixture.work, 'crash-after-copy.mp3')
  await fs.copyFile(fixture.files.mp3, crashTarget)
  const crashHash = await hashFile(crashTarget)
  core = await startCore(fixture, { env: { LX_NATIVE_TEST_FAILPOINT: 'crash-after-copy' } })
  const crashMetadata = await core.client.call('metadata.read', { filePath: crashTarget })
  await assert.rejects(core.client.call('metadata.write', { filePath: crashTarget, metadata: fullMetadata({ ...crashMetadata, title: 'crash' }), coverChanged: false }))
  assert.equal(await hashFile(crashTarget), crashHash)
  report.failureTests.sidecarExit = 'passed'
  core.stop()

  core = await startCore(fixture, { budget: 80 * 1024 })
  try {
    for (const size of [64, 128, 256, 512]) await core.client.call('artwork.variant', { filePath: fixture.files.mp3, size })
    const stats = await core.client.call('artwork.cache.stats')
    assert.ok(stats.byteSize <= stats.byteBudget, `LRU cache exceeded budget: ${JSON.stringify(stats)}`)
    assert.ok(stats.entryCount < 4)
    report.artwork.budgetEviction = stats
  } finally { core.stop() }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

run().catch(error => { console.error(error); process.exitCode = 1 })
