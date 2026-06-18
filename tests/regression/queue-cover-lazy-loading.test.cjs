const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const sidebarQueueSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'NowPlayingList.vue'), 'utf8')
const detailQueueSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'components', 'PlayQueueBtn.vue'), 'utf8')
const localMusicSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'core', 'music', 'local.ts'), 'utf8')
const downloadMusicSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'core', 'music', 'download.ts'), 'utf8')

test('RG-041: queue cover thumbnails keep lazy loading without leaving local covers broken', () => {
  assert.match(
    localMusicSource,
    /pathToFileURL\(pic\)\.href/m,
    'Local embedded/file covers should be converted to file URLs before reaching image tags',
  )
  assert.match(
    downloadMusicSource,
    /pathToFileURL\(pic\)\.href/m,
    'Downloaded local-file covers should be converted to file URLs before reaching image tags',
  )
  assert.match(
    sidebarQueueSource,
    /@scroll\.passive="handleListScroll"/m,
    'Sidebar queue should keep loading local covers as the user scrolls',
  )
  assert.match(
    sidebarQueueSource,
    /LOCAL_PIC_BATCH_SIZE = 12[\s\S]*getVisibleLocalPicTargets[\s\S]*slice\(firstIndex, firstIndex \+ visibleCount\)[\s\S]*\.slice\(0, LOCAL_PIC_BATCH_SIZE\)/m,
    'Sidebar queue should load only a bounded visible window of local covers at a time',
  )
  assert.match(
    sidebarQueueSource,
    /picRequestId\+\+[\s\S]*loadingPicIds\.clear\(\)[\s\S]*queueList\.value = getList\(listId\)\.map/m,
    'Sidebar queue should invalidate cover requests only when the list identity/content is resynced',
  )
  assert.match(
    sidebarQueueSource,
    /const failedPicIds = new Set\(\)[\s\S]*failedPicIds\.has\(itemKey\)[\s\S]*failedPicIds\.add\(itemKey\)/m,
    'Sidebar queue should remember failed cover lookups so missing artwork does not spin an endless retry loop',
  )
  assert.match(
    sidebarQueueSource,
    /file:\/\/\/\$\{encodePath\(pic\)\}/m,
    'Sidebar queue should normalize cached local cover paths before binding image src',
  )
  assert.match(
    sidebarQueueSource,
    /musicInfo\?\.source == 'bili' && pic && !isBiliProxyPic\(pic\)[\s\S]*return ''/m,
    'Sidebar queue should not directly render raw Bilibili image URLs',
  )
  assert.match(
    sidebarQueueSource,
    /return item\.musicInfo\?\.source == 'bili' && !!item\.musicInfo\.meta\?\.bvid/m,
    'Sidebar queue should lazily resolve missing Bilibili covers through getPicPath',
  )
  assert.match(
    detailQueueSource,
    /file:\/\/\/\$\{encodePath\(pic\)\}/m,
    'Detail queue should normalize cached local cover paths before binding image src',
  )
  assert.match(
    detailQueueSource,
    /musicInfo\?\.source == 'bili' && pic && !isBiliProxyPic\(pic\)[\s\S]*return ''/m,
    'Detail queue should not directly render raw Bilibili image URLs',
  )
  assert.match(
    detailQueueSource,
    /return item\.musicInfo\?\.source == 'bili' && !!item\.musicInfo\.meta\?\.bvid/m,
    'Detail queue should lazily resolve missing Bilibili covers through getPicPath',
  )
})
