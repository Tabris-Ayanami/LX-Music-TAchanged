const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const actionPath = path.join(rootDir, 'src', 'renderer', 'views', 'songList', 'Detail', 'action.ts')
const actionSource = fs.readFileSync(actionPath, 'utf8')

test('RG-033: collecting an online song list is idempotent before creating the local list', () => {
  assert.match(
    actionSource,
    /const findCollectedSongList = \(id: string, source: LX\.OnlineSource, listId: string, userListId: string\) => \{/m,
    'Song-list collect should use one helper for duplicate detection',
  )
  assert.match(
    actionSource,
    /if \(l\.id == userListId\) return true/m,
    'Duplicate detection should catch existing deterministic local ids before invoking player_list_add again',
  )
  assert.match(
    actionSource,
    /return l\.sourceListId == id \|\| l\.sourceListId == listId/m,
    'Duplicate detection should support both legacy raw source ids and prefixed source ids',
  )
  assert.match(
    actionSource,
    /if \(pendingCollectListIds\.has\(userListId\)\) return/m,
    'Concurrent collect clicks should be ignored while the first create request is still in flight',
  )
  assert.match(
    actionSource,
    /const latestTargetList = findCollectedSongList\(id, source, listId, userListId\)/m,
    'Collect should re-check duplicates after fetching the remote list and before creating the local list',
  )
  assert.match(
    actionSource,
    /sourceListId: id,/m,
    'Created song lists should keep the raw remote id so sync and source-detail links continue to work',
  )
})
