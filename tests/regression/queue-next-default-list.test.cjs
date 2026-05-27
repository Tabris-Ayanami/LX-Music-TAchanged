const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const playDefaultListPath = path.join(rootDir, 'src', 'renderer', 'utils', 'playDefaultList.ts')
const songListActionPath = path.join(rootDir, 'src', 'renderer', 'views', 'songList', 'Detail', 'action.ts')
const localMusicPath = path.join(rootDir, 'src', 'renderer', 'utils', 'localMusic.ts')
const listAddModalPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'ListAddModal.vue')
const listAddMultipleModalPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'ListAddMultipleModal.vue')
const playDefaultListSource = fs.readFileSync(playDefaultListPath, 'utf8')
const songListActionSource = fs.readFileSync(songListActionPath, 'utf8')
const localMusicSource = fs.readFileSync(localMusicPath, 'utf8')
const listAddModalSource = fs.readFileSync(listAddModalPath, 'utf8')
const listAddMultipleModalSource = fs.readFileSync(listAddMultipleModalPath, 'utf8')

test('RG-032: playlist play queues the requested list immediately after the current song', () => {
  assert.match(
    playDefaultListSource,
    /export const queueNextInDefaultList = async\(musicInfos: LX\.Music\.MusicInfo\[\]\)/m,
    'Shared queue helper should make the next-play behavior explicit',
  )
  assert.match(
    playDefaultListSource,
    /const nextList = dedupeMusicInfos\(\[[\s\S]*\.\.\.currentList\.slice\(0, currentIndex \+ 1\),\s*\.\.\.insertList,\s*\.\.\.currentList\.slice\(currentIndex \+ 1\)\.filter/m,
    'Queued songs should be inserted directly after the currently playing song, before the old remainder',
  )
  assert.match(
    playDefaultListSource,
    /const dedupeMusicInfos = \(musicInfos: LX\.Music\.MusicInfo\[\]\) => \{[\s\S]*if \(ids\.has\(musicInfo\.id\)\) return false/m,
    'Queue overwrite should remove duplicate ids before writing to the default list database table',
  )
  assert.match(
    playDefaultListSource,
    /'progress' in currentMusicInfo\s*\?\s*currentMusicInfo\.metadata\.musicInfo\.id\s*:\s*currentMusicInfo\.id/m,
    'Queue insertion should unwrap progress playback metadata before matching the current song',
  )
  assert.match(
    playDefaultListSource,
    /playMusicInfo\.listId == defaultList\.id && playInfo\.playerPlayIndex > -1/m,
    'Queue insertion should fall back to the active default-list play index when id matching is unavailable',
  )
  assert.match(
    playDefaultListSource,
    /if \(currentIndex < 0\) \{\s*await addListMusics\(defaultList\.id, normalizedList, 'bottom'\)/m,
    'When the current default-list position cannot be resolved, new songs should not be inserted at the first item',
  )
  assert.match(
    songListActionSource,
    /await queueNextInDefaultList\(fullList\)/m,
    'Online song-list play should queue the full playlist as the upcoming sequence',
  )
  assert.match(
    localMusicSource,
    /await queueNextInDefaultList\(tracks\)/m,
    'Local album and artist play should share the same next-play queue behavior',
  )
  assert.match(
    listAddModalSource,
    /else if \(listId == defaultList\.id\) void queueNextInDefaultList\(\[this\.currentMusicInfo\]\)/m,
    'Adding a single song to the audition list should insert it after the currently playing item',
  )
  assert.match(
    listAddMultipleModalSource,
    /else if \(listId == defaultList\.id\) void queueNextInDefaultList\(list\)/m,
    'Adding multiple songs to the audition list should insert them after the currently playing item',
  )
})
