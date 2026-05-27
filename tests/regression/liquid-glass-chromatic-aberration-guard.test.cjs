const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-020: liquid-glass defaults keep chromatic aberration disabled on player surfaces', () => {
  assert.match(
    liquidGlassLayerSource,
    /const variantDefaults: Record<Variant, \{ displacementScale: number, blurAmount: number, saturation: number, aberrationIntensity: number \}> = \{[\s\S]*search: \{[\s\S]*aberrationIntensity: 0[\s\S]*capsule: \{[\s\S]*aberrationIntensity: 0[\s\S]*island: \{[\s\S]*aberrationIntensity: 0/m,
    'Search, toolbar capsule, and floating-island glass defaults should keep RGB edge splitting disabled so light surfaces do not pick up orange fringe artifacts',
  )
  assert.match(
    liquidGlassLayerSource,
    /const resolvedAberrationIntensity = computed\(\(\) => props\.aberrationIntensity \?\? variantDefaults\[currentVariant\.value\]\.aberrationIntensity\)/m,
    'Chromatic aberration should still remain configurable per usage site instead of hard-coding the filter path',
  )
})
