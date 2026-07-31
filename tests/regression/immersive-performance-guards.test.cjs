const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8')

test('RG-054: immersive mode avoids duplicate and off-screen media work', () => {
  const immersive = read('src', 'renderer', 'components', 'layout', 'PlayDetail', 'ImmersiveLyrics.vue')
  const sourcePanel = read('src', 'renderer', 'components', 'layout', 'PlayDetail', 'ImmersiveSourcePanel.vue')

  assert.match(
    immersive,
    /const loadMv = async\(\) => \{[\s\S]*if \(background\.value != 'mv'\) \{[\s\S]*return[\s\S]*const track = await resolveMvTrack/m,
    'Album and aura backgrounds should not start an unused MV lookup',
  )
  assert.match(
    immersive,
    /let biliSearchPromise = null[\s\S]*if \(searchKey != biliSearchKey \|\| !biliSearchPromise\)[\s\S]*biliSearchPromise = biliSearch/m,
    'MV and lyric selection should share the same in-flight Bilibili search',
  )
  assert.match(
    immersive,
    /const updateMvSync = \(\) => \{[\s\S]*if \(background\.value != 'mv' \|\| !isPlay\.value \|\| !mvUrl\.value\) return[\s\S]*window\.setInterval/m,
    'MV drift correction should only wake while an MV is visibly playing',
  )
  assert.match(
    sourcePanel,
    /const getSearchResults = \(\) => \{[\s\S]*searchPromise = biliSearch[\s\S]*const requestKey = getSearchKey\(\)[\s\S]*if \(requestKey != getSearchKey\(\)\) return/m,
    'The source panel should share searches and reject stale track responses',
  )
})

test('RG-055: audio visualizers reuse frame buffers without reducing detail', () => {
  const canvasVisualizer = read('src', 'renderer', 'components', 'common', 'AudioVisualizer.vue')
  const foliaBridge = read('src', 'renderer', 'components', 'layout', 'PlayDetail', 'FoliaVisualizerBridge.tsx')

  assert.match(
    canvasVisualizer,
    /let waveX = new Float32Array\(0\)[\s\S]*if \(waveX\.length != pointCount\)[\s\S]*waveY\[i\] =/m,
    'Wave points should use reusable typed buffers instead of per-frame objects',
  )
  assert.doesNotMatch(
    canvasVisualizer,
    /const points = new Array\(pointCount\)/m,
    'Wave rendering should not allocate an object array on every frame',
  )
  assert.match(
    foliaBridge,
    /let frequencyPrefix = new Uint32Array\(0\)[\s\S]*let spectrumBuffers = \[new Uint8Array\(0\), new Uint8Array\(0\)\][\s\S]*frequencyPrefix\[index \+ 1\] = frequencyPrefix\[index\] \+ frequencyData\[index\]/m,
    'Folia audio bands should use one prefix pass and reusable spectrum buffers',
  )
})

test('RG-056: abandoned Bilibili streams release network and pipeline resources', () => {
  const proxy = read('src', 'main', 'modules', 'bili', 'proxy.ts')

  assert.match(
    proxy,
    /const controller = new AbortController\(\)[\s\S]*req\.once\('aborted', abortUpstream\)[\s\S]*fetch\(info\.url, \{ headers, signal: controller\.signal \}\)/m,
    'Closing playback should abort the corresponding upstream request',
  )
  assert.match(
    proxy,
    /await pipeline\(Readable\.fromWeb\(upstream\.body as any\), res\)[\s\S]*finally \{[\s\S]*req\.off\('aborted', abortUpstream\)/m,
    'Streaming errors and listeners should be handled through a managed pipeline',
  )
})
