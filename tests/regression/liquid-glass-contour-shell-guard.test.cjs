const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-022: liquid-glass shell uses transparent warp fill and a dedicated contour layer', () => {
  assert.match(
    liquidGlassLayerSource,
    /<span :class="\$style\.warp" :style="warpStyle" \/>\s*<span :class="\$style\.surfaceTint" :style="surfaceTintStyle" \/>\s*<span :class="\$style\.contour" :style="contourStyle" \/>/m,
    'The glass shell should separate the transparent blur layer from the outer contour styling so the interior does not render as a gray slab',
  )
  assert.match(
    liquidGlassLayerSource,
    /const contourShadowByVariant: Record<Variant, string> = \{[\s\S]*search: '0 20px 44px rgba\(34, 50, 82, 0\.16\), 0 8px 18px rgba\(34, 50, 82, 0\.1\), 0 1px 0 rgba\(255, 255, 255, 0\.74\) inset, 0 0 0 1px rgba\(255, 255, 255, 0\.38\) inset'/m,
    'The search glass shell should rely on contour shadow/highlight instead of an interior fill plate',
  )
  assert.match(
    liquidGlassLayerSource,
    /\.variant_search \.warp,\s*\.variant_capsule \.warp,\s*\.variant_island \.warp \{[\s\S]*background: transparent;/m,
    'The variant warp layers should stay transparent so the blur does not draw a separate inner rectangle',
  )
  const warpStyleBlock = liquidGlassLayerSource.match(/const warpStyle = computed<Partial<CSSProperties>>\(\(\) => \(\{[\s\S]*?\}\)\)/m)
  assert.ok(
    warpStyleBlock,
    'The liquid-glass layer should keep a dedicated warpStyle block for backdrop blur composition',
  )
  assert.doesNotMatch(
    warpStyleBlock[0],
    /background(Image|Color)?\s*:/m,
    'The warped blur layer must not paint its own fill; otherwise a gray inner slab appears on light surfaces',
  )
})
