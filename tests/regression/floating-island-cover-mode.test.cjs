const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const floatingIslandPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayBar', 'FloatingIsland.vue')
const floatingIslandSource = fs.readFileSync(floatingIslandPath, 'utf8')

test('RG-002: floating island cover rotation stays compact-only', () => {
  assert.match(
    floatingIslandSource,
    /\[\$style\.coverArtSpinning\]: isFloatingIslandCompact && isPlay && musicInfo\.pic/,
    'Expanded floating-island state should not apply the compact spinning-disc treatment',
  )
})
