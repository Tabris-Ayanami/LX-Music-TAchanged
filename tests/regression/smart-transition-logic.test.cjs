const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

const loadTs = relativePath => {
  const filename = path.join(root, relativePath)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(output, filename)
  return loaded.exports
}

test('tail activity requires sustained silence before triggering', () => {
  const { createTailActivityTracker } = loadTs('src/renderer/plugins/player/transition.ts')
  const tracker = createTailActivityTracker({ silenceDurationSec: 0.3, thresholdRatio: 0.18, floorRms: 0.003 })

  assert.equal(tracker.update(0.4, 0).isSilent, false)
  assert.equal(tracker.update(0.001, 0.1).isSilent, false)
  assert.equal(tracker.update(0.001, 0.41).isSilent, true)
})

test('transition start waits for a ready deck and uses tail silence when available', () => {
  const { chooseTransitionStart } = loadTs('src/renderer/plugins/player/transition.ts')

  assert.equal(chooseTransitionStart({ prepared: false, playing: true, remainingSec: 2 }).shouldStart, false)
  assert.deepEqual(
    chooseTransitionStart({ prepared: true, playing: true, remainingSec: 7.5, silenceSec: 0.4 }),
    { shouldStart: true, overlapSec: 2, reason: 'tail-silence' },
  )
  assert.deepEqual(
    chooseTransitionStart({ prepared: true, playing: true, remainingSec: 4.5 }),
    { shouldStart: true, overlapSec: 4.5, reason: 'fallback-window' },
  )
})

test('equal-power gains are bounded, complementary, and silent at the correct endpoints', () => {
  const { computeEqualPowerGains } = loadTs('src/renderer/plugins/player/transition.ts')

  assert.deepEqual(computeEqualPowerGains(0), { outgoingGain: 1, incomingGain: 0 })
  const middle = computeEqualPowerGains(0.5)
  assert.ok(Math.abs(middle.outgoingGain - middle.incomingGain) < 0.000001)
  assert.ok(middle.outgoingGain + middle.incomingGain <= 1.42)
  assert.deepEqual(computeEqualPowerGains(1), { outgoingGain: 0, incomingGain: 1 })
})

test('perceptual crossfade gains duck the outgoing deck early and cap the mix', () => {
  const { computeEqualPowerGains, computePerceptualCrossfadeGains } = loadTs('src/renderer/plugins/player/transition.ts')

  const middle = computePerceptualCrossfadeGains(0.5)
  assert.ok(middle.outgoingGain < computeEqualPowerGains(0.5).outgoingGain)
  assert.ok(middle.incomingGain > 0)
  assert.ok(middle.outgoingGain + middle.incomingGain <= 1.04 + 0.000001)
  assert.deepEqual(computePerceptualCrossfadeGains(0), { outgoingGain: 1, incomingGain: 0 })
  assert.deepEqual(computePerceptualCrossfadeGains(1), { outgoingGain: 0, incomingGain: 1 })
})

test('outgoing perceptual fade is front-loaded and eases near the end', () => {
  const { computePerceptualCrossfadeGains } = loadTs('src/renderer/plugins/player/transition.ts')

  const early = computePerceptualCrossfadeGains(0.25).outgoingGain
  const firstQuarterDrop = 1 - computePerceptualCrossfadeGains(0.25).outgoingGain
  const lastQuarterDrop = computePerceptualCrossfadeGains(0.75).outgoingGain
  assert.ok(early >= 0.66 && early <= 0.74)
  assert.ok(firstQuarterDrop > lastQuarterDrop)
})

test('operation tokens invalidate stale asynchronous results', () => {
  const { createTransitionOperation } = loadTs('src/renderer/plugins/player/transition.ts')
  const operation = createTransitionOperation()
  const first = operation.begin()
  const second = operation.begin()

  assert.equal(operation.isCurrent(first), false)
  assert.equal(operation.isCurrent(second), true)
  operation.cancel()
  assert.equal(operation.isCurrent(second), false)
})

test('activating a prepared media element relays loadeddata to duration consumers', () => {
  const { relayPreparedMediaReady } = loadTs('src/renderer/plugins/player/transition.ts')
  const media = new EventTarget()
  Object.defineProperty(media, 'readyState', { value: 4 })
  let loadedCount = 0
  media.addEventListener('loadeddata', () => { loadedCount++ })

  assert.equal(relayPreparedMediaReady(media), true)
  assert.equal(loadedCount, 1)
})

test('manual smart transition preserves the outgoing position until the new deck is ready', () => {
  const { shouldPreserveOutgoingProgress } = loadTs('src/renderer/plugins/player/transition.ts')

  assert.equal(shouldPreserveOutgoingProgress({ enabled: true, playing: true, empty: false }), true)
  assert.equal(shouldPreserveOutgoingProgress({ enabled: false, playing: true, empty: false }), false)
  assert.equal(shouldPreserveOutgoingProgress({ enabled: true, playing: false, empty: false }), false)
  assert.equal(shouldPreserveOutgoingProgress({ enabled: true, playing: true, empty: true }), false)
})

test('player contracts expose durationchange for streaming duration corrections', () => {
  const contracts = fs.readFileSync(path.join(root, 'src/renderer/backend/contracts.ts'), 'utf8')
  const player = fs.readFileSync(path.join(root, 'src/renderer/plugins/player/index.ts'), 'utf8')
  const electron = fs.readFileSync(path.join(root, 'src/renderer/backend/electron.ts'), 'utf8')

  assert.match(contracts, /\| 'durationchange'/)
  assert.match(player, /'durationchange'/)
  assert.match(electron, /durationchange:\s*webPlayer\.onDurationchange/)
})

test('manual resource loads carry an explicit transition intent while refreshes stay immediate', () => {
  const contracts = fs.readFileSync(path.join(root, 'src/renderer/backend/contracts.ts'), 'utf8')
  const player = fs.readFileSync(path.join(root, 'src/renderer/plugins/player/index.ts'), 'utf8')
  const action = fs.readFileSync(path.join(root, 'src/renderer/core/player/action.ts'), 'utf8')
  const electron = fs.readFileSync(path.join(root, 'src/renderer/backend/electron.ts'), 'utf8')

  assert.match(contracts, /interface PlayerLoadRequest[\s\S]*transition\?: boolean/)
  assert.match(player, /setResource = \(src: string, transition = isSmartTransitionEnabled\(\)\)/)
  assert.match(player, /!transition \|\| !isSmartTransitionEnabled\(\)/)
  assert.match(electron, /load:\s*\(\{ source, transition \}\) => \{ webPlayer\.setResource\(source, transition\) \}/)
  assert.match(action, /backend\.player\.load\(\{ source: url, transition: !isRefresh \}\)/)
})

test('gain curve scheduling uses one future anchor and guards Web Audio scheduling failures', () => {
  const player = fs.readFileSync(path.join(root, 'src/renderer/plugins/player/index.ts'), 'utf8')

  assert.match(player, /const curveStartAt = audioContext\.currentTime \+ 0\.03/)
  assert.match(player, /scheduleGainCurve\(outgoingIndex, 'outgoing', durationSec, breathRatio, curveStartAt\)/)
  assert.match(player, /scheduleGainCurve\(incomingIndex, 'incoming', durationSec, breathRatio, curveStartAt\)/)
  assert.match(player, /try \{[\s\S]*scheduleGainCurve\(outgoingIndex/)
  assert.match(player, /catch \((?:_error|error)\)[\s\S]*activeDeckIndex = outgoingIndex/)
})

test('duplicate manual loads do not cancel a transition already targeting the same source', () => {
  const listPlay = fs.readFileSync(path.join(root, 'src/renderer/views/List/MusicList/usePlay.js'), 'utf8')

  assert.match(listPlay, /const RAPID_PLAY_GUARD_MS = 450/)
  assert.match(listPlay, /if \(playKey == lastPlayKey && now - lastPlayAt < RAPID_PLAY_GUARD_MS\) return/)
  assert.match(listPlay, /lastPlayKey = playKey/)
  assert.match(listPlay, /lastPlayAt = now/)
})
