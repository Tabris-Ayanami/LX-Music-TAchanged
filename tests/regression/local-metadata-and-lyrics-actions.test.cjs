const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('typescript')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...segments) => fs.readFileSync(path.join(rootDir, ...segments), 'utf8')

const localMusicSource = read('src', 'renderer', 'views', 'LocalMusic', 'index.vue')
const listSource = read('src', 'renderer', 'views', 'List', 'MusicList', 'index.vue')
const actionsSource = read('src', 'renderer', 'components', 'localMusic', 'LocalTrackActions.vue')
const editorSource = read('src', 'renderer', 'components', 'localMusic', 'MetadataEditModal.vue')
const lyricsPanelSource = read('src', 'renderer', 'components', 'localMusic', 'LyricsMatchPanel.vue')
const metadataSource = read('src', 'main', 'modules', 'localMusicTools', 'metadata.ts')
const backendSource = read('src', 'renderer', 'backend', 'electron.ts')
const packSource = read('build-config', 'build-pack.js')

const loadTs = relativePath => {
  const filename = path.join(rootDir, relativePath)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(output, filename)
  return loaded.exports
}

test('RG-058: spatial local tracks open the shared local-track context actions', () => {
  assert.match(
    localMusicSource,
    /@contextmenu\.stop\.prevent="showTrackContextMenu\(\$event, entry\.item\.track\)"/m,
    'The planet/spatial song object must resolve the hit track on right click',
  )
  assert.match(localMusicSource, /<LocalTrackActions[^>]+with-menu/m)
  assert.match(listSource, /<LocalTrackActions[^>]+:list-id="listId"/m)
  assert.match(actionsSource, /buildLocalTrackMenuItems\(\{ canRemoveFromList:/m)
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
    backendSource,
    /read: async\(filePath, signal\) => call\(\(\) => legacyIpc\.readLocalMetadata\(filePath\), signal\)/m,
    'Metadata reads must stay uncached so in-place tag writes are immediately visible',
  )
})

test('local track menus expose one canonical action order without a separate lyric action', () => {
  const { buildLocalTrackMenuItems } = loadTs('src/renderer/components/localMusic/localTrackMenu.ts')
  assert.deepEqual(
    buildLocalTrackMenuItems({ canRemoveFromList: false }).map(item => item.action),
    ['play', 'playLater', 'addTo', 'editMetadata', 'revealFile', 'copyName'],
  )
  assert.equal(buildLocalTrackMenuItems({ canRemoveFromList: true }).at(-1).action, 'remove')
  assert.doesNotMatch(actionsSource, /重新匹配歌词|匹配歌词/)
  assert.doesNotMatch(listSource, /const localActions = \[[\s\S]*重新匹配歌词/m)
})

test('lyrics panel loads embedded lyrics on first activation', () => {
  assert.match(
    lyricsPanelSource,
    /watch\(\(\) => props\.active[\s\S]*?\{ immediate: true \}\)/m,
    'The panel mounts while already active, so the watch must run immediately to load embedded lyrics',
  )
})

test('metadata editor exposes immersive information, lyrics, and read-only file sections', () => {
  assert.match(editorSource, /activeTab = ref<'information' \| 'lyrics' \| 'file'>\('information'\)/)
  assert.match(editorSource, /主要信息/)
  assert.match(editorSource, /分类与排序/)
  assert.match(editorSource, /备注/)
  assert.match(editorSource, /文件信息/)
  assert.match(editorSource, /metadata\.bitrate/)
  assert.match(editorSource, /metadata\.sampleRate/)
  assert.match(editorSource, /metadata\.filePath/)
  assert.match(editorSource, /v-if="activeTab == 'information'"/)
})
