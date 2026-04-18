const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const floatingIslandPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayBar', 'FloatingIsland.vue')
const floatingIslandSource = fs.readFileSync(floatingIslandPath, 'utf8')

test('RG-010: floating island keeps centered main controls and a left-anchored compact cover', () => {
  assert.match(
    floatingIslandSource,
    /\.topRow \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 116px minmax\(0, 1fr\);/m,
    'Expanded floating-island layout should reserve a dedicated center lane for the main controls',
  )
  assert.match(
    floatingIslandSource,
    /\.controls \{[\s\S]*grid-column: 2;[\s\S]*justify-self: center;[\s\S]*width: 116px;/m,
    'Main controls should stay pinned to the middle grid column instead of being visually pulled by side content',
  )
  assert.match(
    floatingIslandSource,
    /\.compact \.coverTrigger \{[\s\S]*width: 42px;[\s\S]*height: 42px;[\s\S]*border-radius: 999px;[\s\S]*align-self: center;[\s\S]*justify-self: center;[\s\S]*\}/m,
    'Compact cover trigger should keep a fixed left anchor without additional horizontal offsets',
  )
  assert.doesNotMatch(
    floatingIslandSource,
    /\.compact \.coverTrigger \{[^}]*translateX\(/m,
    'Compact cover trigger should not apply extra horizontal offsets because they make the cover drift during collapse',
  )
  assert.match(
    floatingIslandSource,
    /:global\(#player\[data-floating-compact='true'\]\) \{[\s\S]*left: var\(--player-window-gutter\);[\s\S]*transform: none;[\s\S]*width: 152px;/m,
    'Compact floating island should pin itself to the left window gutter so the right side collapses toward the cover anchor',
  )
})
