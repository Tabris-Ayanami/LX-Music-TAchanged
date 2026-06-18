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
    /\.edge \{[\s\S]*inset 0 1px 0 rgba\(255, 255, 255, \.74\)[\s\S]*0 18px 42px rgba\(20, 29, 46, \.14\);/m,
    'The VGlass edge layer should keep a crisp highlight and soft exterior shadow',
  )
  assert.doesNotMatch(
    liquidGlassLayerSource,
    /\.edge \{[\s\S]*rgba\(0, 0, 0, 0\.22\)/m,
    'The edge layer should not reintroduce a muddy dark interior shadow',
  )
})
