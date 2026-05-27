const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-021: liquid-glass border treatment avoids internal dark shadow on light surfaces', () => {
  assert.match(
    liquidGlassLayerSource,
    /\.edgeScreen,\s*\.edgeOverlay \{[\s\S]*box-shadow: 0 0 0 0\.5px rgba\(255, 255, 255, 0\.46\) inset;/m,
    'The edge layer should use a tight highlight stroke instead of a blurred inner shadow so the glass interior does not look muddy',
  )
  assert.doesNotMatch(
    liquidGlassLayerSource,
    /\.edgeScreen,\s*\.edgeOverlay \{[\s\S]*rgba\(0, 0, 0, 0\.22\)/m,
    'The border-only layer should not reintroduce the previous dark interior shadow',
  )
})
