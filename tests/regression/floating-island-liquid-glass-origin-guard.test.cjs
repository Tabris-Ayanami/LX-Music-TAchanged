const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const floatingIslandPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayBar', 'FloatingIsland.vue')
const transitionUtilsPath = path.join(rootDir, 'src', 'renderer', 'utils', 'playDetailTransition.js')

const floatingIslandSource = fs.readFileSync(floatingIslandPath, 'utf8')
const transitionUtilsSource = fs.readFileSync(transitionUtilsPath, 'utf8')

test('RG-017: floating-island glass shell keeps a DOM host for play-detail origin capture', () => {
  assert.match(
    floatingIslandSource,
    /<div[\s\S]*ref="playerRef"[\s\S]*data-play-floating-island="true"[\s\S]*>\s*<LiquidGlassLayer[\s\S]*variant="island"/m,
    'The floating island should keep the native shell div as the root and mount liquid glass inside it instead of replacing the host element',
  )
  assert.match(
    floatingIslandSource,
    /const showPlayerDetail = \(\) => \{[\s\S]*capturePlayDetailOrigin\(playerRef\.value\)[\s\S]*setShowPlayerDetail\(true\)/m,
    'Opening the detail view should still capture geometry from the live floating-island DOM node before toggling the panel',
  )
  assert.match(
    transitionUtilsSource,
    /export const capturePlayDetailOrigin = \(element\) => \{[\s\S]*if \(!element\) return[\s\S]*element\.querySelector\('\[data-play-floating-cover="true"\]'\)/m,
    'Transition origin capture should keep its null guard and continue reading the floating cover from a DOM element host',
  )
})
