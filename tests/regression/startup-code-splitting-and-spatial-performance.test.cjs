const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8')

test('RG-052: renderer startup defers non-critical views and global components', () => {
  const routerSource = read('src', 'renderer', 'router.ts')
  const componentsSource = read('src', 'renderer', 'components', 'index.js')
  const viewSource = read('src', 'renderer', 'components', 'layout', 'View.vue')
  const packSource = read('build-config', 'build-pack.js')
  const rendererProdSource = read('build-config', 'renderer', 'webpack.config.prod.js')

  assert.doesNotMatch(
    routerSource,
    /component:\s*require\(/m,
    'Routes should not synchronously parse every view during renderer startup',
  )
  assert.equal(
    (routerSource.match(/component:\s*async\(\) => import\(/g) ?? []).length,
    9,
    'Each concrete route should be split into an on-demand chunk',
  )
  assert.match(
    componentsSource,
    /require\.context\('\.\/', true, \/\\\.vue\$\/, 'lazy'\)[\s\S]*defineAsyncComponent\(\{[\s\S]*await requireComponent\(fileName\)/m,
    'The global component registry should expose lazy component loaders instead of one monolithic startup chunk',
  )
  assert.match(
    componentsSource,
    /import LayoutIcons from '.\/layout\/Icons\.vue'[\s\S]*const eagerComponents = \{[\s\S]*LayoutIcons/m,
    'The SVG symbol sprite should remain eager so deferred controls never render missing icons',
  )
  assert.match(
    viewSource,
    /<keep-alive :max="6">/m,
    'Route retention should be bounded below the number of top-level pages',
  )
  assert.match(
    packSource,
    /'dist\/\*\*\/\*',[\s\S]*'!dist\/\*\*\/\*\.map'/m,
    'Installer payloads should omit production source maps that are not used at runtime',
  )
  assert.match(
    rendererProdSource,
    /splitChunks: \{[\s\S]*chunks: 'all',[\s\S]*minChunks: 2/m,
    'Shared dependencies should be deduplicated across both startup and deferred component chunks',
  )
})

test('RG-053: spatial canvas pauses hidden work and keeps cover preloading stable', () => {
  const localMusicSource = read('src', 'renderer', 'views', 'LocalMusic', 'index.vue')

  assert.match(
    localMusicSource,
    /albumCoverGroupSignature = computed[\s\S]*artistCoverGroupSignature = computed[\s\S]*watch\(\[normalizedView, albumCoverGroupSignature\][\s\S]*watch\(\[normalizedView, artistCoverGroupSignature\]/m,
    'Cover resolution should react to stable visible-key signatures rather than a fresh array on every pan frame',
  )
  assert.match(
    localMusicSource,
    /scheduleSpatialViewportSync = \(\) => \{[\s\S]*requestAnimationFrame[\s\S]*new ResizeObserver\(scheduleSpatialViewportSync\)/m,
    'Resize observer updates should be coalesced into one layout read per animation frame',
  )
  assert.match(
    localMusicSource,
    /const deactivateSpatialLifecycle = \(\) => \{[\s\S]*cancelCoverResolutionTasks\(\)[\s\S]*spatialResizeObserver\?\.disconnect\(\)[\s\S]*onActivated\(activateSpatialLifecycle\)[\s\S]*onDeactivated\(deactivateSpatialLifecycle\)/m,
    'Keep-alive deactivation should stop cover tasks, animation frames, and viewport observers',
  )
  assert.doesNotMatch(
    localMusicSource,
    /backdrop-filter: blur\(16px\) saturate\(135%\)/m,
    'Mounted planets should not each allocate an almost invisible live backdrop blur',
  )
  assert.match(
    localMusicSource,
    /\.spatialDragging \{[\s\S]*will-change: transform;/m,
    'GPU layer hints should be limited to active dragging instead of all fifty mounted cards',
  )
})
