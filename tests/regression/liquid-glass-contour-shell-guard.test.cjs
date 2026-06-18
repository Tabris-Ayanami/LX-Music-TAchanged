const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-022: liquid-glass shell uses VGlass with lightweight tint and edge layers', () => {
  assert.match(
    liquidGlassLayerSource,
    /<VGlass[\s\S]*:blur="resolvedBlur"[\s\S]*:scale="resolvedScale"[\s\S]*:base-frequency="resolvedBaseFrequency"[\s\S]*:num-octaves="resolvedNumOctaves"/m,
    'The optimized glass shell should pass tuned blur and distortion values into VGlass',
  )
  assert.match(
    liquidGlassLayerSource,
    /<span :class="\$style\.tint" \/>\s*<span :class="\$style\.edge" \/>/m,
    'The wrapper should keep separate tint and edge layers over the VGlass distortion',
  )
  assert.match(
    liquidGlassLayerSource,
    /\.variant_search \{[\s\S]*\.tint \{[\s\S]*\.edge \{/m,
    'Search glass should keep variant-specific tint and edge styling',
  )
  assert.doesNotMatch(
    liquidGlassLayerSource,
    /const contourShadowByVariant|\.warp|\.surfaceTint|\.contour/m,
    'The optimized VGlass wrapper should not carry the old hand-written warp and contour runtime',
  )
})
