const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const toolsSource = fs.readFileSync(path.join(rootDir, 'src', 'common', 'utils', 'tools.ts'), 'utf8')
const onlineMusicSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'core', 'music', 'online.ts'), 'utf8')
const downloadMusicSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'core', 'music', 'download.ts'), 'utf8')
const downloadActionSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'store', 'download', 'action.ts'), 'utf8')
const sidebarQueueSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'NowPlayingList.vue'), 'utf8')
const detailQueueSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'components', 'PlayQueueBtn.vue'), 'utf8')
const playerActionSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'store', 'player', 'action.ts'), 'utf8')

test('RG-046: Bilibili cover proxy URLs are treated as runtime-only values', () => {
  assert.match(
    toolsSource,
    /export const isBiliRuntimePicUrl = \(url\?: string \| null\) => \{[\s\S]*\/\^http:\\\/\\\/\(\?:127\\\.0\\\.0\\\.1\|localhost\):\\d\+\\\/bili\\\/image\\\?\/i\.test\(String\(url \?\? ''\)\)/m,
    'Bilibili image proxy URLs should have one shared detector because the token map is process-local',
  )
  assert.match(
    onlineMusicSource,
    /if \(musicInfo\.meta\.picUrl && !isRefresh && musicInfo\.source != 'bili'\) return musicInfo\.meta\.picUrl/m,
    'Online cover lookup should not reuse persisted Bilibili picUrl values after app restart',
  )
  assert.match(
    onlineMusicSource,
    /if \(listId && musicInfo\.source != 'bili' && !isBiliRuntimePicUrl\(url\)\) \{[\s\S]*musicInfo\.meta\.picUrl = url[\s\S]*updateListMusics/m,
    'Online cover lookup should not persist Bilibili runtime proxy URLs back into list storage',
  )
  assert.match(
    sidebarQueueSource,
    /if \(musicInfo\?\.source == 'bili'\) return ''[\s\S]*return normalizePicUrl\(pic\)/m,
    'Sidebar queue should force Bilibili covers through lazy regeneration instead of trusting restored metadata',
  )
  assert.match(
    detailQueueSource,
    /if \(musicInfo\?\.source == 'bili'\) return ''[\s\S]*return normalizePicUrl\(pic\)/m,
    'Detail queue should force Bilibili covers through lazy regeneration instead of trusting restored metadata',
  )
  assert.match(
    playerActionSource,
    /const getInitialPic = \(musicInfo: LX\.Music\.MusicInfo\) => \{[\s\S]*return musicInfo\.source == 'bili' \? null : musicInfo\.meta\.picUrl[\s\S]*\}/m,
    'The player should not seed cover art from a possibly stale Bilibili proxy URL before getPicPath refreshes it',
  )
  assert.match(
    downloadMusicSource,
    /onlineMusicInfo\.meta\.picUrl && onlineMusicInfo\.source != 'bili' && !isBiliRuntimePicUrl\(onlineMusicInfo\.meta\.picUrl\)/m,
    'Downloaded Bilibili items should not reuse stale proxy URLs as embedded artwork',
  )
  assert.match(
    downloadActionSource,
    /const canUseCachedPicUrl = !!cachedPicUrl && musicInfo\.source != 'bili' && !isBiliRuntimePicUrl\(cachedPicUrl\)/m,
    'Download completion metadata should regenerate Bilibili artwork instead of embedding a stale proxy URL',
  )
})
