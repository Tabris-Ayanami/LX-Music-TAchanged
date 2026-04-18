const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const appVuePath = path.join(__dirname, '..', '..', 'src', 'renderer', 'App.vue')
const appVueSource = fs.readFileSync(appVuePath, 'utf8')

test('RG-009: floating island is centered against the whole window', () => {
  assert.match(
    appVueSource,
    /#player\s*\{[\s\S]*left:\s*50%;[\s\S]*bottom:\s*24px;[\s\S]*width:\s*min\(calc\(100% - \(var\(--player-window-gutter\) \* 2\)\),\s*1180px\);[\s\S]*transform:\s*translateX\(-50%\);/m,
  )
})
