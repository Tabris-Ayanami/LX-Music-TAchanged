const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const floatingIslandPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayBar', 'FloatingIsland.vue')
const floatingIslandSource = fs.readFileSync(floatingIslandPath, 'utf8')

test('RG-003: compact floating-island controls keep an interactive hit area', () => {
  assert.match(
    floatingIslandSource,
    /\.compact \.compactControls \{[\s\S]*width: 74px;[\s\S]*pointer-events: auto;[\s\S]*overflow: visible;[\s\S]*z-index: 9;[\s\S]*transform: translateX\(0\);[\s\S]*-webkit-app-region: no-drag;/,
    'Compact controls should keep a dedicated right-side lane with an active hit area even when the pill overlaps the draggable sidebar zone',
  )
  assert.match(
    floatingIslandSource,
    /\.compact \.contentCluster \{[\s\S]*width: 74px;[\s\S]*justify-content: flex-end;[\s\S]*overflow: visible;[\s\S]*z-index: 9;[\s\S]*-webkit-app-region: no-drag;/,
    'Compact content cluster should reserve space for the right controls without clipping them or turning them into a drag surface',
  )
  assert.match(
    floatingIslandSource,
    /\.compact \.compactControls \{[\s\S]*display: flex;[\s\S]*justify-content: space-between;[\s\S]*gap: 6px;/,
    'Compact controls should distribute the play and expand buttons inside the fixed right-side lane',
  )
  assert.match(
    floatingIslandSource,
    /\.iconBtn,\s*\.compactToggleBtn \{[\s\S]*overflow: visible;[\s\S]*-webkit-app-region: no-drag;[\s\S]*svg \{[\s\S]*display: block;[\s\S]*overflow: visible;[\s\S]*transform-origin: center;/,
    'Compact and expanded floating-island icons should remain unclipped and stay clickable inside the draggable shell',
  )
})
