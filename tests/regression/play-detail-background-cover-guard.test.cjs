const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const playDetailPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'index.vue')
const fluidBackgroundPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'FluidBackground.vue')
const auraWorkerPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'auraBackground', 'renderer', 'webWorkerBackground.worker.ts')
const auraRendererPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'auraBackground', 'renderer', 'WebWorkerBackgroundRender.ts')
const playDetailSource = fs.readFileSync(playDetailPath, 'utf8')
const fluidBackgroundSource = fs.readFileSync(fluidBackgroundPath, 'utf8')
const auraWorkerSource = fs.readFileSync(auraWorkerPath, 'utf8')
const auraRendererSource = fs.readFileSync(auraRendererPath, 'utf8')

test('RG-027: play-detail uses album-color fluid background instead of blurred cover art', () => {
  assert.match(
    playDetailSource,
    /FluidBackground\(:class="\$style\.bg" :cover="musicInfo\.pic" :colors="detailColors" :active="visibled"\)/m,
    'The detail page should mount the fluid background with both the cover image and album-derived colors',
  )
  assert.match(
    playDetailSource,
    /detailColors,/m,
    'The extracted album palette should be exposed to the fluid background component',
  )
  assert.match(
    playDetailSource,
    /\.bg \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*z-index: 1;[\s\S]*\}/m,
    'The fluid background should fill the play detail shell without inheriting the old blurred-cover transform',
  )
  assert.doesNotMatch(
    playDetailSource,
    /\.bg \{[\s\S]*filter: blur\(34px\)[\s\S]*\}/m,
    'The old heavy cover blur should not be applied to the WebGL fluid canvas',
  )
  assert.match(
    fluidBackgroundSource,
    /import \{ WebWorkerBackgroundRender \} from '\.\/auraBackground\/renderer\/WebWorkerBackgroundRender'/m,
    'The Vue wrapper should call the vendored aura background renderer instead of carrying a local shader clone',
  )
  assert.match(
    auraRendererSource,
    /new Worker\(new URL\([\s\S]*play-detail-aura-background\.worker[\s\S]*'\.\/webWorkerBackground\.worker'[\s\S]*import\.meta\.url/m,
    'The aura renderer should keep the worker-backed OffscreenCanvas path',
  )
  assert.match(
    auraWorkerSource,
    /const KAWASE_FS = `[\s\S]*uniform sampler2D uTexture;[\s\S]*uniform vec2 uTexelSize;[\s\S]*uniform float uOffset;[\s\S]*`/m,
    'The vendored aura worker should use the Kawase blur pass before the main shader',
  )
  assert.match(
    auraWorkerSource,
    /uniform sampler2D uTexA;[\s\S]*uniform sampler2D uTexB;[\s\S]*uniform float uMix;[\s\S]*vec3 sampleCover\(sampler2D tex, vec2 size, float angle, float zoom\)/m,
    'The vendored aura shader should render blurred cover textures and crossfade between song changes',
  )
  assert.match(
    auraWorkerSource,
    /const makeCoverTex = \(bitmap: ImageBitmap\): Tex \| null => \{[\s\S]*ctx\.drawImage\(bitmap,[\s\S]*const raw = makeTex\(canvas, BLUR_SIZE, BLUR_SIZE, true\)[\s\S]*const blurred = blurTexture\(raw\)/m,
    'The cover image should be converted into a blurred aura texture instead of being replaced by a flat color field',
  )
  assert.match(
    fluidBackgroundSource,
    /renderer\?\.setPlaying\(active\)[\s\S]*renderer\?\.setPaused\(!active\)/m,
    'The wrapper should forward play-detail visibility to the aura renderer',
  )
})
