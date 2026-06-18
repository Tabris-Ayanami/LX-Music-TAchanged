const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-028: liquid-glass layer uses the optimized VGlass runtime instead of the old vendored wrapper', () => {
  assert.match(
    liquidGlassLayerSource,
    /import VGlass from '\.\/VGlass\.vue'/m,
    'LiquidGlassLayer should use the local optimized VGlass renderer',
  )
  assert.match(
    liquidGlassLayerSource,
    /<VGlass[\s\S]*:disable-distortion="!useDistortion"/m,
    'LiquidGlassLayer should delegate distortion gating to VGlass',
  )
  assert.doesNotMatch(
    liquidGlassLayerSource,
    /vendorContainer = new Container|vendor\/liquid-glass-js/m,
    'The old vendored liquid-glass-js wrapper should not be required by the optimized layer',
  )
})
