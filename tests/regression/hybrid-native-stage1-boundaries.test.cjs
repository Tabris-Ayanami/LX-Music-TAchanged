const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('Stage 1 feature flags preserve legacy ownership by default', () => {
  const settings = read('src/common/defaultSetting.ts')
  assert.match(settings, /'backend\.metadata': 'native-shadow'/)
  assert.match(settings, /'backend\.metadataWrite': 'electron'/)
  assert.match(settings, /'backend\.artwork': 'electron'/)
})

test('metadata shadow mode returns legacy data and native write never double-writes', () => {
  const source = read('src/main/modules/nativeCore/mediaServices.ts')
  assert.match(source, /const legacy = await readLocalMetadata\(filePath\)[\s\S]*void recordShadow\(filePath, legacy, nativeResult\)[\s\S]*return legacy/)
  assert.match(source, /if \(global\.lx\.appSetting\['backend\.metadataWrite'] != 'native'\) \{[\s\S]*return writeLocalMetadata\(legacyRequest\)[\s\S]*\}/)
  assert.doesNotMatch(source, /call<NativeMetadata>\('metadata\.write'[\s\S]*catch[\s\S]*writeLocalMetadata/)
})

test('artwork UI path uses ArtworkService with a legacy fallback', () => {
  const localMusic = read('src/renderer/core/music/local.ts')
  const adapter = read('src/renderer/backend/electron.ts')
  assert.match(localMusic, /backend\.artwork\.getLocalTrackArtwork\(\{ filePath: musicInfo\.meta\.filePath, size: 512 \}\)/)
  assert.doesNotMatch(localMusic, /window\.lx\.worker\.main\.getMusicFilePic/)
  assert.match(adapter, /window\.lxData\.appSetting\['backend\.artwork'] == 'native'/)
  assert.match(adapter, /legacyIpc\.getLegacyArtworkPath\(request\.filePath\)/)
})

test('native transport is framed, versioned, supervised, and bounded', () => {
  const supervisor = read('src/main/modules/nativeCore/supervisor.ts')
  assert.match(supervisor, /const PROTOCOL_VERSION = '1\.0'/)
  assert.match(supervisor, /writeUInt32LE\(payload\.length, 0\)/)
  assert.match(supervisor, /MAX_FRAME_BYTES/)
  assert.match(supervisor, /core\.handshake/)
  assert.match(supervisor, /rpc\.cancel/)
  assert.match(supervisor, /backend_unavailable/)
})
