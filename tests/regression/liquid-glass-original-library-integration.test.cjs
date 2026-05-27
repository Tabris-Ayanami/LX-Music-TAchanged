const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const liquidGlassLayerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')
const vendorContainerPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'vendor', 'liquid-glass-js', 'container.js')
const vendorCssPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'vendor', 'liquid-glass-js', 'glass.css')

const liquidGlassLayerSource = fs.readFileSync(liquidGlassLayerPath, 'utf8')

test('RG-028: liquid-glass layer uses upstream liquid-glass-js runtime instead of only local hand-written blur', () => {
  assert.ok(
    fs.existsSync(vendorContainerPath),
    'The upstream liquid-glass-js container runtime should be vendored in the repo',
  )
  assert.ok(
    fs.existsSync(vendorCssPath),
    'The upstream liquid-glass-js glass stylesheet should be vendored in the repo',
  )
  assert.match(
    liquidGlassLayerSource,
    /import Container from '\.\/vendor\/liquid-glass-js\/container'/m,
    'LiquidGlassLayer should import the upstream container runtime directly',
  )
  assert.match(
    liquidGlassLayerSource,
    /import '\.\/vendor\/liquid-glass-js\/glass\.css'/m,
    'LiquidGlassLayer should import upstream glass.css directly',
  )
  assert.match(
    liquidGlassLayerSource,
    /vendorContainer = new Container\(\{/m,
    'LiquidGlassLayer should instantiate the upstream container runtime at mount time',
  )
})

