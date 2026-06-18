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
    /<VGlass[\s\S]*:disable-distortion="!useDistortion"[\s\S]*aria-hidden="true"/m,
    'The optimized glass layer should delegate distortion to VGlass while remaining an aria-hidden visual overlay',
  )
  assert.match(
    liquidGlassLayerSource,
    /const useDistortion = computed\(\(\) => isShowAnimation\.value && mergedActive\.value\)/m,
    'Distortion should stay gated by the animation setting and active state for performance',
  )
  assert.doesNotMatch(
    liquidGlassLayerSource,
    /addEventListener\('mousemove'|'mouseenter'|'mouseleave'|'mousedown'|'mouseup'\)/m,
    'The optimized layer should not attach host pointer listeners from this wrapper',
  )
})
