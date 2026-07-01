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
})
