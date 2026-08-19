'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const {
  collectActiveProfilePaths,
  excludeInvokerProcessChain,
} = require('../../scripts/performance/stage2/process-discovery.cjs')
const { buildPreparationOptions, runPreparation } = require('../../scripts/performance/stage2/prepare-workspace.cjs')

const electronPath = require('electron')
const sqliteFixturePath = path.resolve(__dirname, '..', 'helpers', 'stage2-sqlite-fixture.cjs')

test('process discovery detects a profile path anywhere in a complete command line', () => {
  const profileSource = path.resolve('synthetic fixtures', 'profile source')
  const otherProfile = path.resolve('synthetic fixtures', 'other profile')
  const processes = [
    { processId: 100, parentProcessId: 1, commandLine: `"LX Music.exe" --database-root="${profileSource}"` },
    { processId: 101, parentProcessId: 1, commandLine: `"helper.exe" --user-data-dir="${otherProfile}"` },
    { processId: 102, parentProcessId: 1, commandLine: '"unrelated.exe" --flag=value' },
  ]

  assert.deepEqual(
    collectActiveProfilePaths(processes, profileSource),
    [profileSource, otherProfile],
  )
})

test('process discovery excludes only the preparer invoker chain', () => {
  const processes = [
    { processId: 10, parentProcessId: 0, commandLine: 'terminal.exe' },
    { processId: 20, parentProcessId: 10, commandLine: 'npm.cmd memory:stage2:prepare' },
    { processId: 30, parentProcessId: 20, commandLine: 'node.exe prepare-workspace.cjs' },
    { processId: 40, parentProcessId: 10, commandLine: 'LX Music.exe' },
  ]

  assert.deepEqual(
    excludeInvokerProcessChain(processes, 30).map(process => process.processId),
    [40],
  )
})

test('CLI preparation options carry completed synthetic command-line scan evidence', () => {
  const profileSource = path.resolve('synthetic fixtures', 'profile source')
  const mediaRoot = path.resolve('synthetic fixtures', 'media')
  const outputRoot = path.resolve('synthetic fixtures', 'output')
  const processes = [
    { processId: 10, parentProcessId: 0, commandLine: 'terminal.exe' },
    { processId: 20, parentProcessId: 10, commandLine: `node.exe prepare-workspace.cjs --profile-source="${profileSource}"` },
    { processId: 30, parentProcessId: 10, commandLine: `"LX Music.exe" --database-root="${profileSource}"` },
  ]

  const options = buildPreparationOptions({
    argumentsList: [
      `--profile-source=${profileSource}`,
      `--media-root=${mediaRoot}`,
      `--output=${outputRoot}`,
    ],
    processRecords: processes,
    currentProcessId: 20,
  })

  assert.deepEqual(options.activeProfilePaths, [profileSource])
  assert.equal(options.activityEvidenceMethod, 'windows-process-command-lines')
})

test('CLI orchestration prepares a synthetic workspace from injected process records', async t => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-cli-'))
  t.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }))
  const profileSource = path.join(fixtureRoot, 'profile')
  const mediaRoot = path.join(fixtureRoot, 'media')
  const outputRoot = path.join(fixtureRoot, 'output')
  const databasePath = path.join(profileSource, 'LxDatas', 'lx.data.db')
  const trackPath = path.join(mediaRoot, 'track.flac')
  const configPath = path.join(fixtureRoot, 'database-config.json')
  await fs.mkdir(path.dirname(databasePath), { recursive: true })
  await fs.mkdir(mediaRoot)
  await fs.writeFile(trackPath, 'cli-synthetic-track')
  await fs.writeFile(configPath, JSON.stringify({
    rows: [{ id: 'local-cli', name: 'CLI Local', source: 'local', meta: JSON.stringify({ filePath: trackPath }) }],
  }))
  const createResult = spawnSync(electronPath, [sqliteFixturePath, 'create', databasePath, configPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(createResult.status, 0, createResult.stderr)

  const manifest = await runPreparation({
    argumentsList: [
      `--profile-source=${profileSource}`,
      `--media-root=${mediaRoot}`,
      `--output=${outputRoot}`,
    ],
    processRecords: [{ processId: 20, parentProcessId: 0, commandLine: `node.exe prepare-workspace.cjs --profile-source="${profileSource}"` }],
    currentProcessId: 20,
  })

  assert.equal(manifest.profileActivityEvidence.method, 'windows-process-command-lines')
  assert.equal(manifest.copiedLocalTrackCount, 1)
  assert.equal(await fs.readFile(path.join(manifest.mediaPath, 'root-0', 'track.flac'), 'utf8'), 'cli-synthetic-track')
})
