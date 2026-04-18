const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const floatingIslandPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayBar', 'FloatingIsland.vue')
const floatingIslandSource = fs.readFileSync(floatingIslandPath, 'utf8')

test('RG-004: compact cover spin pauses in place instead of resetting', () => {
  assert.match(
    floatingIslandSource,
    /\.compact \.coverArt \{[\s\S]*animation: floatingIslandCoverSpin 15s linear infinite;[\s\S]*animation-fill-mode: both;[\s\S]*animation-play-state: paused;/,
    'Compact cover art should keep the same animation instance and pause it in place',
  )
  assert.match(
    floatingIslandSource,
    /\.coverArtSpinning \{[\s\S]*animation-play-state: running;/,
    'Playback should resume the existing compact cover animation instead of recreating it',
  )
  assert.match(
    floatingIslandSource,
    /\.compact \.coverArtSpinning \{[\s\S]*animation-play-state: running;/,
    'Compact mode should explicitly override the paused base state so playback visibly rotates the cover art',
  )
})

test('RG-005: compact-to-expanded transition keeps content in animated states', () => {
  assert.match(
    floatingIslandSource,
    /\.expandedContent \{[\s\S]*transform: translateX\(0\);[\s\S]*transition: [^}]*transform [^;]*;/,
    'Expanded content should animate transform as well as width/opacity',
  )
  assert.match(
    floatingIslandSource,
    /\.compact \.expandedContent \{[\s\S]*opacity: 0;[\s\S]*transform: translateX\(18px\);/,
    'Compact state should hide expanded content through an animated offset instead of a hard visual snap',
  )
  assert.match(
    floatingIslandSource,
    /\.compactControls \{[\s\S]*transform: translateX\(14px\);[\s\S]*transition: [^}]*transform [^;]*;/,
    'Compact controls should ease in and out instead of appearing abruptly',
  )
})
