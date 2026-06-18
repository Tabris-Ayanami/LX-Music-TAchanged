const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-020: liquid-glass defaults keep distortion controlled by animation settings', () => {
  assert.match(
    liquidGlassLayerSource,
    /const variantDefaults: Record<Variant, \{ scale: number, blur: number, frequency: number, octaves: number \}> = \{[\s\S]*search: \{ scale: 18, blur: 18[\s\S]*capsule: \{ scale: 20, blur: 16[\s\S]*island: \{ scale: 24, blur: 22/m,
    'VGlass defaults should keep per-surface scale and blur tuned for search, capsule, and island surfaces',
  )
  assert.match(
    liquidGlassLayerSource,
    /const useDistortion = computed\(\(\) => isShowAnimation\.value && mergedActive\.value\)/m,
    'Animated distortion should be disabled whenever global animation is off or the surface is inactive',
  )
})
