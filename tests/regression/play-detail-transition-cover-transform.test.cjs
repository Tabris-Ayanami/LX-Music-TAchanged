const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const transitionUtilsPath = path.join(rootDir, 'src', 'renderer', 'utils', 'playDetailTransition.js')
const playDetailPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'index.vue')
const transitionUtilsSource = fs.readFileSync(transitionUtilsPath, 'utf8')
const playDetailSource = fs.readFileSync(playDetailPath, 'utf8')

test('RG-011: play-detail close transition reuses live compact-cover transform', () => {
  assert.match(
    transitionUtilsSource,
    /const getTransformValue = \(element\) => \{[\s\S]*window\.getComputedStyle\(element\)\.transform[\s\S]*transform && transform != 'none' \? transform : ''/m,
    'Transition snapshot should capture the floating cover transform to avoid a visual angle jump',
  )
  assert.match(
    transitionUtilsSource,
    /coverTransform: getTransformValue\(coverMotionElement\)/m,
    'Transition snapshot should persist cover transform for both cached and live origin reads',
  )
  assert.match(
    transitionUtilsSource,
    /export const getPlayDetailOrigin = \(preferLive = false\) => \{/m,
    'Transition origin getter should support a live-read mode for close transitions',
  )
  assert.match(
    playDetailSource,
    /const snapshot = getPlayDetailOrigin\(!opening\)/m,
    'Play-detail animation should request a live origin snapshot while closing',
  )
  assert.match(
    playDetailSource,
    /transform: snapshot\.coverTransform \|\| 'translateZ\(0\)'/m,
    'Motion cover element should reuse the captured cover transform instead of resetting to zero angle',
  )
  assert.match(
    playDetailSource,
    /const getCoverTransform = \(value\) => value \|\| 'translateZ\(0\)'/m,
    'Play-detail transition should normalize missing cover transforms to a safe baseline value',
  )
  assert.match(
    playDetailSource,
    /const coverFrames = opening[\s\S]*transform: getCoverTransform\(snapshot\.coverTransform\)[\s\S]*transform: 'translateZ\(0\)'[\s\S]*transform: getCoverTransform\(snapshot\.coverTransform\)/m,
    'Cover motion frames should animate compact-cover rotation back to the detail artwork baseline while preserving the live angle for the return trip',
  )
})
