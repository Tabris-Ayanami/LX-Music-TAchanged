const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8')

test('RG-044: sidebar queue cover loading does not retry missing artwork forever', () => {
  const source = read('src', 'renderer', 'components', 'layout', 'Aside', 'NowPlayingList.vue')

  assert.match(
    source,
    /const failedPicIds = new Set\(\)[\s\S]*failedPicIds\.has\(itemKey\)/m,
    'Failed artwork ids should be excluded from lazy-loading candidates',
  )
  assert.match(
    source,
    /if \(!pic\) \{[\s\S]*failedPicIds\.add\(itemKey\)[\s\S]*return[\s\S]*\}[\s\S]*\.catch\(\(\) => \{[\s\S]*failedPicIds\.add\(itemKey\)/m,
    'Empty and rejected cover lookups should be marked failed to avoid an endless request loop',
  )
  assert.match(
    source,
    /picRequestId\+\+[\s\S]*loadingPicIds\.clear\(\)[\s\S]*failedPicIds\.clear\(\)[\s\S]*queueList\.value = getList\(listId\)\.map/m,
    'A fresh queue sync should clear failed ids so new list contents can resolve covers normally',
  )
})

test('RG-045: animated background and visualizer clean up deferred work on unmount', () => {
  const fluidBackground = read('src', 'renderer', 'components', 'layout', 'PlayDetail', 'FluidBackground.vue')
  const visualizer = read('src', 'renderer', 'components', 'common', 'AudioVisualizer.vue')

  assert.match(
    fluidBackground,
    /let initTimer = null[\s\S]*let disposed = false[\s\S]*window\.clearTimeout\(initTimer\)[\s\S]*disposed = true[\s\S]*cleanup\(\)/m,
    'FluidBackground should cancel deferred init and mark itself disposed before stopping the worker',
  )
  assert.match(
    fluidBackground,
    /if \(disposed\) return[\s\S]*initTimer = window\.setTimeout\(\(\) => \{[\s\S]*initTimer = null[\s\S]*init\(\)/m,
    'Deferred canvas re-init should no-op after unmount instead of recreating a worker',
  )
  assert.match(
    visualizer,
    /onMounted\(\(\) => \{[\s\S]*ctx = canvas\.getContext\('2d'\)[\s\S]*window\.app_event\.on\('play', handlePlay\)[\s\S]*if \(isPlay\.value\) handlePlay\(\)/m,
    'AudioVisualizer should register play events only after the canvas context has been initialized',
  )
  assert.match(
    visualizer,
    /const handlePlay = \(\) => \{[\s\S]*if \(!ctx \|\| !dom_canvas\.value \|\| !WIDTH \|\| !HEIGHT\) return/m,
    'AudioVisualizer should ignore early play events until the canvas is ready',
  )

  const auraWorker = read('src', 'renderer', 'components', 'layout', 'PlayDetail', 'auraBackground', 'renderer', 'webWorkerBackground.worker.ts')
  assert.match(
    auraWorker,
    /const onNewCover = \(bitmap: ImageBitmap\) => \{[\s\S]*finally \{[\s\S]*bitmap\.close\(\)/m,
    'The aura worker should release transferred ImageBitmaps after uploading their pixels',
  )
})

test('RG-048: long-running caches remain bounded', () => {
  const biliProxy = read('src', 'main', 'modules', 'bili', 'proxy.ts')
  const dbLists = read('src', 'main', 'worker', 'dbService', 'modules', 'list', 'index.ts')
  const musicSdk = read('src', 'renderer', 'utils', 'musicSdk', 'index.js')

  assert.match(
    biliProxy,
    /const MAX_PROXY_TOKENS = [\d_]+[\s\S]*const pruneTokens = [\s\S]*info\.expiresAt <= now[\s\S]*tokenMap\.size >= MAX_PROXY_TOKENS/m,
    'Bilibili proxy tokens should expire and have a hard upper bound',
  )
  assert.match(
    biliProxy,
    /let startServerPromise:[\s\S]*if \(startServerPromise\) return startServerPromise/m,
    'Concurrent proxy URL requests should share one server startup instead of leaking listeners',
  )
  assert.match(
    dbLists,
    /const MAX_UNPINNED_LIST_CACHE_SIZE = \d+[\s\S]*const trimMusicListCache = [\s\S]*unpinnedCount <= MAX_UNPINNED_LIST_CACHE_SIZE/m,
    'The database worker should not retain every user list visited during a long session',
  )
  assert.match(
    dbLists,
    /export const removeUserLists = [\s\S]*for \(const id of ids\) musicLists\.delete\(id\)/m,
    'Deleted lists should be released from the database worker cache immediately',
  )
  assert.match(
    musicSdk,
    /localCommentMatchCache = createLimitedCache\(100, 30 \* 60 \* 1000\)/,
    'Local comment matching should use the shared bounded TTL cache',
  )
})
