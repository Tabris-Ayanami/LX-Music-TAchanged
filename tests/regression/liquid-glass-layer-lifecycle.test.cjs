const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-018: liquid-glass layer stays non-interactive and releases host listeners on unmount', () => {
  assert.match(
    liquidGlassLayerSource,
    /\.layer \{[\s\S]*z-index: 0;[\s\S]*pointer-events: none;[\s\S]*border-radius: inherit;/m,
    'The liquid-glass overlay should never sit above the host controls or consume pointer input',
  )
  assert.match(
    liquidGlassLayerSource,
    /hostRef\.value = rootRef\.value\?\.parentElement as HTMLElement \| null/m,
    'The glass layer should bind to its parent host element so the original component DOM remains the interaction owner',
  )
  assert.match(
    liquidGlassLayerSource,
    /const bindHostEvents = \(\) => \{[\s\S]*host\.addEventListener\('mousemove', handleMouseMove\)[\s\S]*host\.addEventListener\('mouseenter', handleMouseEnter\)[\s\S]*host\.addEventListener\('mouseleave', handleMouseLeave\)[\s\S]*host\.addEventListener\('mousedown', handleMouseDown\)[\s\S]*host\.addEventListener\('mouseup', handleMouseUp\)/m,
    'The glass layer should explicitly track hover and press state on the host so interactive feedback stays synchronized',
  )
  assert.match(
    liquidGlassLayerSource,
    /onBeforeUnmount\(\(\) => \{[\s\S]*unbindHostEvents\(\)[\s\S]*resizeObserver\?\.disconnect\(\)[\s\S]*if \(!resizeObserver\) window\.removeEventListener\('resize', updateGlassSize\)/m,
    'Unmounting the glass layer should always clean host listeners and any resize fallback to avoid stale reactions after view switches',
  )
})
