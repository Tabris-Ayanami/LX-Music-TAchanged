const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const transitionUtilsPath = path.join(rootDir, 'src', 'renderer', 'utils', 'playDetailTransition.js')
const playDetailPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'index.vue')
const floatingIslandPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayBar', 'FloatingIsland.vue')
const liquidGlassPath = path.join(rootDir, 'src', 'renderer', 'components', 'common', 'liquidGlass', 'LiquidGlassLayer.vue')

const transitionUtilsSource = fs.readFileSync(transitionUtilsPath, 'utf8')
const playDetailSource = fs.readFileSync(playDetailPath, 'utf8')
const floatingIslandSource = fs.readFileSync(floatingIslandPath, 'utf8')
const liquidGlassSource = fs.readFileSync(liquidGlassPath, 'utf8')

test('RG-025: play-detail motion shell interpolates the floating island glass visuals instead of only geometry', () => {
  assert.match(
    transitionUtilsSource,
    /const getShellVisualState = \(element\) => \{[\s\S]*shellBackground:[\s\S]*shellBorderColor:[\s\S]*shellBoxShadow:[\s\S]*shellBackdropFilter:[\s\S]*shellWebkitBackdropFilter:/m,
    'Origin capture should snapshot the floating island glass appearance along with geometry',
  )
  assert.match(
    transitionUtilsSource,
    /capturePlayDetailOrigin[\s\S]*\.\.\.getShellVisualState\(element\)/m,
    'The live floating-island snapshot should include shell visuals before opening the detail panel',
  )
  assert.match(
    playDetailSource,
    /const getShellVisualStyles = state => \(\{[\s\S]*background:[\s\S]*borderColor:[\s\S]*boxShadow:[\s\S]*backdropFilter:[\s\S]*WebkitBackdropFilter:/m,
    'The motion shell should expose a reusable visual-state mapper for animated shell frames',
  )
  assert.match(
    playDetailSource,
    /const shellFrames = opening[\s\S]*\.\.\.getShellVisualStyles\(snapshot\)[\s\S]*\.\.\.shellTargetVisual[\s\S]*:\s*\[[\s\S]*\.\.\.shellTargetVisual[\s\S]*\.\.\.getShellVisualStyles\(snapshot\)/m,
    'Open and close shell frames should interpolate between detail-shell and floating-island visual states',
  )
  assert.match(
    playDetailSource,
    /const hideFloatingIslandShell = \(\) => \{[\s\S]*floatingIsland\.style\.opacity = '0'[\s\S]*floatingIsland\.style\.visibility = 'hidden'[\s\S]*return \(\) => \{[\s\S]*floatingIsland\.style\.opacity = previousOpacity/m,
    'The real floating-island shell should stay hidden during the close motion so the proxy shell remains visible while shrinking back',
  )
})

test('RG-026: floating-island controls use protruding glass button shells across all button groups', () => {
  assert.match(
    floatingIslandSource,
    /\.iconBtn,\s*\.compactToggleBtn,\s*\.utilityBtn \{[\s\S]*--floating-btn-fill:[\s\S]*box-shadow: var\(--floating-btn-shadow\);[\s\S]*backdrop-filter: blur\(22px\) saturate\(178%\);[\s\S]*&::before \{[\s\S]*&::after \{/m,
    'Primary, compact, and utility controls should all share the lifted glass button shell treatment',
  )
  assert.match(
    floatingIslandSource,
    /\.playBtn \{[\s\S]*width: 34px;[\s\S]*height: 34px;[\s\S]*transition-property: transform, opacity, background-color, box-shadow, color, border-color, backdrop-filter;[\s\S]*&::before \{/m,
    'The main play button should keep the shared protruding glass button shell instead of drawing a flat sticker-like highlight',
  )
  assert.match(
    floatingIslandSource,
    /\.utilityBtn \{[\s\S]*:global\(button\) \{[\s\S]*border-radius: inherit;/m,
    'Nested utility controls should inherit the outer glass shell shape instead of drawing their own conflicting frames',
  )
})

test('RG-040: floating-island floating controls can paint beyond the shell and use cover-derived aura', () => {
  assert.match(
    floatingIslandSource,
    /:style="playerStyle"[\s\S]*'--floating-cover-image': musicInfo\.pic/m,
    'The floating island should expose the current artwork as a CSS image for cover-derived ambient glow',
  )
  assert.match(
    floatingIslandSource,
    /\.player \{[\s\S]*overflow: visible;[\s\S]*contain: layout style;/m,
    'The floating island should allow controls such as the vertical volume capsule to render outside the shell bounds',
  )
  assert.match(
    floatingIslandSource,
    /<span :class="\$style\.coverAura"[\s\S]*\.coverAura \{[\s\S]*overflow: hidden;[\s\S]*&::before \{[\s\S]*background-image: var\(--floating-cover-image\);[\s\S]*filter: blur\(30px\) saturate\(180%\);/m,
    'The cover glow should be generated from the album art inside the island bounds instead of spilling outside the shell',
  )
  assert.doesNotMatch(
    floatingIslandSource,
    /\.coverTrigger \{[^}]*&::before \{/m,
    'The cover glow should not live on the cover trigger where it can escape the island bounds',
  )
  assert.doesNotMatch(
    liquidGlassSource,
    /rgba\(31, 137, 150, 0\.34\)/m,
    'The floating island should not keep the old fixed green/cyan glow source',
  )
})
