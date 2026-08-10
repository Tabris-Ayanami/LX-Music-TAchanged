const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...segments) => fs.readFileSync(path.join(rootDir, ...segments), 'utf8')

const localMusicSource = read('src', 'renderer', 'views', 'LocalMusic', 'index.vue')
const listSource = read('src', 'renderer', 'views', 'List', 'MusicList', 'index.vue')
const actionsSource = read('src', 'renderer', 'components', 'localMusic', 'LocalTrackActions.vue')
const metadataSource = read('src', 'main', 'modules', 'localMusicTools', 'metadata.ts')
const localMusicUtilsSource = read('src', 'renderer', 'utils', 'music.ts')
const packSource = read('build-config', 'build-pack.js')

test('RG-058: spatial local tracks open the shared local-track context actions', () => {
  assert.match(
    localMusicSource,
    /@contextmenu\.stop\.prevent="showTrackContextMenu\(\$event, entry\.item\.track\)"/m,
    'The planet/spatial song object must resolve the hit track on right click',
  )
  assert.match(localMusicSource, /<LocalTrackActions[^>]+with-menu/m)
  assert.match(listSource, /<LocalTrackActions[^>]+:list-id="listId"/m)
  assert.match(actionsSource, /编辑歌曲信息[\s\S]*匹配歌词/m)
})

test('RG-059: metadata writes remain in main process and use verified copy-and-swap', () => {
  assert.match(metadataSource, /copyFile\(request\.filePath, tempPath\)/m)
  assert.match(metadataSource, /const verified = await readLocalMetadata\(tempPath\)/m)
  assert.match(metadataSource, /rename\(request\.filePath, backupPath\)/m)
  assert.match(metadataSource, /rename\(tempPath, request\.filePath\)/m)
  assert.match(packSource, /node_modules\/taglib-wasm\/\*\*\/\*/m)
})

test('RG-060: embedded lyric writes use TagLib and can restore the original audio', () => {
  assert.match(metadataSource, /file\.setLyrics\(\[\{ text: lyric\.trim\(\)/m)
  assert.match(metadataSource, /readLocalEmbeddedLyrics\(tempPath\)/m)
  assert.match(metadataSource, /rename\(backupPath, filePath\)/m)
  assert.match(
    localMusicUtilsSource,
    /const key = `\$\{path}:\$\{stats\.mtimeMs}:\$\{stats\.size}`/m,
    'The renderer metadata cache must invalidate after in-place tag writes',
  )
})
