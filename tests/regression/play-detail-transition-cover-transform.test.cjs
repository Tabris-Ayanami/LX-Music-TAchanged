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
    /composeFlipWithTransform\(\s*getFlipTransform\(snapshot\.coverRect, artworkTargetRect\),\s*getCoverTransform\(snapshot\.coverTransform\)/m,
    'Motion cover frames should compose the captured live cover transform with the FLIP motion instead of resetting the angle',
  )
  assert.match(
    playDetailSource,
    /const getCoverTransform = \(value\) => value \|\| 'translateZ\(0\)'/m,
    'Play-detail transition should normalize missing cover transforms to a safe baseline value',
  )
  assert.match(
    playDetailSource,
    /const coverFrames = opening[\s\S]*transform: coverStartTransform[\s\S]*transform: IDENTITY_TRANSFORM[\s\S]*transform: coverStartTransform/m,
    'Cover motion frames should launch and land with the composed live-angle transform while settling to the identity baseline at the artwork',
  )
})
