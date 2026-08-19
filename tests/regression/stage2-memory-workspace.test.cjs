'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const test = require('node:test')

const { prepareWorkspace } = require('../../scripts/performance/stage2/workspace.cjs')

const electronPath = require('electron')
const sqliteFixturePath = path.resolve(__dirname, '..', 'helpers', 'stage2-sqlite-fixture.cjs')
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex')

const electronNodeEnvironment = () => ({ ...process.env, ELECTRON_RUN_AS_NODE: '1' })

const startWalFixture = async (databasePath, configPath) => {
  const child = spawn(electronPath, [sqliteFixturePath, 'hold-wal', databasePath, configPath], {
    env: electronNodeEnvironment(),
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => { stderr += chunk })
  await new Promise((resolve, reject) => {
    let stdout = ''
    const onData = chunk => {
      stdout += chunk
      if (!stdout.includes('READY\n')) return
      child.stdout.off('data', onData)
      child.off('exit', onExit)
      resolve()
    }
    const onExit = code => reject(new Error(`SQLite fixture exited before READY (${code}): ${stderr}`))
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', onData)
    child.once('exit', onExit)
    child.once('error', reject)
  })
  return child
}

const stopFixture = child => new Promise((resolve, reject) => {
  if (!child || child.exitCode != null) return resolve()
  child.once('error', reject)
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`SQLite fixture exited with ${code}`)))
  child.stdin.end()
})

const makeFixture = async (t, { outsideLocalPath } = {}) => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-workspace-'))
  let databaseProcess
  t.after(async() => {
    await stopFixture(databaseProcess)
    await fs.rm(fixtureRoot, { recursive: true, force: true })
  })

  const profileSource = path.join(fixtureRoot, 'profile-source')
  const mediaRoot = path.join(fixtureRoot, 'media-source')
  const outputRoot = path.join(fixtureRoot, 'isolated-workspace')
  const databasePath = path.join(profileSource, 'LxDatas', 'lx.data.db')
  const sourceTrackA = path.join(mediaRoot, 'album-a', 'track-a.flac')
  const sourceTrackB = path.join(mediaRoot, 'album-b', 'track-b.mp3')
  const sourceCover = path.join(mediaRoot, 'album-a', 'cover.jpg')
  const sourceLyric = path.join(mediaRoot, 'album-a', 'track-a.lrc')

  await fs.mkdir(path.dirname(databasePath), { recursive: true })
  await fs.mkdir(path.dirname(sourceTrackA), { recursive: true })
  await fs.mkdir(path.dirname(sourceTrackB), { recursive: true })
  await fs.writeFile(sourceTrackA, Buffer.from([0, 1, 2, 3, 254, 255]))
  await fs.writeFile(sourceTrackB, Buffer.from('synthetic-track-b'))
  await fs.writeFile(sourceCover, Buffer.from('synthetic-cover'))
  await fs.writeFile(sourceLyric, Buffer.from('[00:00.00]synthetic lyric'))
  await fs.writeFile(path.join(profileSource, 'lockfile'), 'source-lock-must-survive')
  await fs.writeFile(path.join(profileSource, 'DevToolsActivePort'), 'source-port-must-survive')
  await fs.mkdir(path.join(profileSource, 'Cache'), { recursive: true })
  await fs.writeFile(path.join(profileSource, 'Cache', 'browser.cache'), 'omit-by-default')

  const localMetaA = {
    filePath: outsideLocalPath ?? sourceTrackA,
    picUrl: sourceCover,
    lyricInfo: { path: sourceLyric },
    custom: 'preserved',
  }
  const localMetaB = { filePath: sourceTrackB }
  const unrelatedMeta = JSON.stringify({ filePath: 'https://example.invalid/remote.mp3', untouched: true })

  const walOnlyMeta = JSON.stringify({ marker: 'committed-in-source-wal' })
  const databaseConfigPath = path.join(fixtureRoot, 'database-config.json')
  await fs.writeFile(databaseConfigPath, JSON.stringify({
    walOnlyRowId: 'wal-only',
    rows: [
      { id: 'local-a', name: 'Local A', source: 'local', meta: JSON.stringify(localMetaA) },
      { id: 'local-b', name: 'Local B', source: 'local', meta: JSON.stringify(localMetaB) },
      { id: 'remote-a', name: 'Remote A', source: 'kw', meta: unrelatedMeta },
      { id: 'wal-only', name: 'WAL Only', source: 'kw', meta: walOnlyMeta },
    ],
  }))
  databaseProcess = await startWalFixture(databasePath, databaseConfigPath)
  assert.ok((await fs.stat(`${databasePath}-wal`)).size > 0)

  return {
    fixtureRoot,
    profileSource,
    mediaRoot,
    outputRoot,
    databasePath,
    sourceTrackA,
    sourceTrackB,
    unrelatedMeta,
    walOnlyMeta,
  }
}

const readRows = databasePath => {
  const result = spawnSync(electronPath, [sqliteFixturePath, 'read', databasePath], {
    env: electronNodeEnvironment(),
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('preparer never aliases, mutates, or leaves references to real music files', async t => {
  const fixture = await makeFixture(t)
  const sourceDatabaseBefore = await fs.readFile(fixture.databasePath)

  await assert.rejects(
    prepareWorkspace({
      profileSource: fixture.profileSource,
      outputRoot: fixture.profileSource,
      mediaRoots: [fixture.mediaRoot],
      activeProfilePaths: [],
    }),
    /destination.*source/i,
  )
  await assert.rejects(
    prepareWorkspace({
      profileSource: fixture.profileSource,
      outputRoot: fixture.outputRoot,
      mediaRoots: [fixture.mediaRoot],
      activeProfilePaths: [fixture.profileSource],
    }),
    /profile.*in use/i,
  )

  const manifest = await prepareWorkspace({
    profileSource: fixture.profileSource,
    outputRoot: fixture.outputRoot,
    mediaRoots: [fixture.mediaRoot],
    activeProfilePaths: [],
  })

  assert.equal(manifest.profilePath, path.join(fixture.outputRoot, 'profile-template'))
  assert.equal(manifest.nativeProfilePath, path.join(fixture.outputRoot, 'native-profile'))
  assert.equal(manifest.nativeCachePath, path.join(fixture.outputRoot, 'native-cache'))
  assert.equal(manifest.mediaPath, path.join(fixture.outputRoot, 'media'))
  assert.equal(manifest.manifestPath, path.join(fixture.outputRoot, 'workspace-manifest.json'))
  assert.equal(manifest.sourceProfileWasInactive, true)
  assert.equal(manifest.copiedLocalTrackCount, 2)
  assert.equal(manifest.copiedLocalTrackBytes, 6 + Buffer.byteLength('synthetic-track-b'))
  assert.ok(manifest.gitCommit)
  assert.ok(manifest.electronVersion)

  const copiedTrack = path.join(manifest.mediaPath, 'root-0', 'album-a', 'track-a.flac')
  assert.notEqual((await fs.stat(copiedTrack)).ino, (await fs.stat(fixture.sourceTrackA)).ino)
  assert.equal(await fs.readFile(copiedTrack, 'hex'), await fs.readFile(fixture.sourceTrackA, 'hex'))

  const copiedRows = readRows(path.join(manifest.profilePath, 'LxDatas', 'lx.data.db'))
  const rewrittenMeta = JSON.parse(copiedRows.find(row => row.id === 'local-a').meta)
  assert.ok(rewrittenMeta.filePath.startsWith(manifest.mediaPath))
  assert.ok(rewrittenMeta.picUrl.startsWith(manifest.mediaPath))
  assert.ok(rewrittenMeta.lyricInfo.path.startsWith(manifest.mediaPath))
  assert.equal(rewrittenMeta.custom, 'preserved')
  assert.equal(copiedRows.find(row => row.id === 'remote-a').meta, fixture.unrelatedMeta)
  assert.equal(copiedRows.find(row => row.id === 'wal-only').meta, fixture.walOnlyMeta)
  assert.equal(copiedRows.some(row => row.meta.includes(fixture.mediaRoot)), false)

  assert.deepEqual(await fs.readFile(fixture.databasePath), sourceDatabaseBefore)
  assert.equal(await fs.readFile(path.join(fixture.profileSource, 'lockfile'), 'utf8'), 'source-lock-must-survive')
  assert.equal(await fs.readFile(path.join(fixture.profileSource, 'DevToolsActivePort'), 'utf8'), 'source-port-must-survive')
  await assert.rejects(fs.stat(path.join(manifest.profilePath, 'lockfile')), { code: 'ENOENT' })
  await assert.rejects(fs.stat(path.join(manifest.profilePath, 'DevToolsActivePort')), { code: 'ENOENT' })
  await assert.rejects(fs.stat(path.join(manifest.profilePath, 'Cache')), { code: 'ENOENT' })

  const persistedManifest = JSON.parse(await fs.readFile(manifest.manifestPath, 'utf8'))
  assert.deepEqual(persistedManifest, manifest)
  assert.equal(
    persistedManifest.database.sha256,
    sha256(await fs.readFile(persistedManifest.database.path)),
  )
  for (const copiedFile of persistedManifest.copiedMedia) {
    assert.equal(copiedFile.sha256, sha256(await fs.readFile(copiedFile.destinationPath)))
  }
})

test('preparation requires explicit completed profile-activity evidence', async t => {
  const fixture = await makeFixture(t)

  await assert.rejects(
    prepareWorkspace({
      profileSource: fixture.profileSource,
      outputRoot: fixture.outputRoot,
      mediaRoots: [fixture.mediaRoot],
    }),
    /activity|process scan|evidence/i,
  )
  await assert.rejects(fs.stat(fixture.outputRoot), { code: 'ENOENT' })
})

test('an output path below a junction ancestor cannot physically alias a source', async t => {
  const fixture = await makeFixture(t)
  const outputAlias = path.join(fixture.fixtureRoot, 'output-alias')
  await fs.symlink(fixture.mediaRoot, outputAlias, process.platform === 'win32' ? 'junction' : 'dir')

  await assert.rejects(
    prepareWorkspace({
      profileSource: fixture.profileSource,
      outputRoot: path.join(outputAlias, 'nested-workspace'),
      mediaRoots: [fixture.mediaRoot],
      activeProfilePaths: [],
    }),
    /destination.*source|ancestor.*(?:symbolic link|junction|reparse)|physical alias/i,
  )
  await assert.rejects(fs.stat(path.join(fixture.mediaRoot, 'nested-workspace')), { code: 'ENOENT' })
})

test('a local database path outside declared media roots aborts without leaving an output', async t => {
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-outside-'))
  t.after(() => fs.rm(outsideRoot, { recursive: true, force: true }))
  const outsideTrack = path.join(outsideRoot, 'outside.flac')
  await fs.writeFile(outsideTrack, 'must-not-be-referenced')
  const fixture = await makeFixture(t, { outsideLocalPath: outsideTrack })

  await assert.rejects(
    prepareWorkspace({
      profileSource: fixture.profileSource,
      outputRoot: fixture.outputRoot,
      mediaRoots: [fixture.mediaRoot],
      activeProfilePaths: [],
    }),
    /outside.*media root/i,
  )
  await assert.rejects(fs.stat(fixture.outputRoot), { code: 'ENOENT' })
})

test('symlink and junction media inputs are rejected before copying', async t => {
  const fixture = await makeFixture(t)
  const targetRoot = path.join(fixture.fixtureRoot, 'junction-target')
  const linkedRoot = path.join(fixture.fixtureRoot, 'linked-media-root')
  await fs.mkdir(targetRoot)
  await fs.symlink(targetRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')

  await assert.rejects(
    prepareWorkspace({
      profileSource: fixture.profileSource,
      outputRoot: fixture.outputRoot,
      mediaRoots: [linkedRoot],
      activeProfilePaths: [],
    }),
    /symbolic link|junction|reparse/i,
  )

  const linkedEntry = path.join(fixture.mediaRoot, 'linked-entry')
  await fs.symlink(targetRoot, linkedEntry, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(
    prepareWorkspace({
      profileSource: fixture.profileSource,
      outputRoot: fixture.outputRoot,
      mediaRoots: [fixture.mediaRoot],
      activeProfilePaths: [],
    }),
    /symbolic link|junction|reparse/i,
  )
})
