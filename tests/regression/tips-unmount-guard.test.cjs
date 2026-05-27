const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const tipsPath = path.join(rootDir, 'src', 'renderer', 'plugins', 'Tips', 'Tips.vue')
const tipsSource = fs.readFileSync(tipsPath, 'utf8')

test('RG-034: tips unmount tolerates an already-detached DOM node', () => {
  assert.match(
    tipsSource,
    /beforeUnmount\(\) \{\s*const el = this\.\$el\s*if \(el\?\.parentNode\) el\.parentNode\.removeChild\(el\)\s*\}/m,
    'Tips should not call removeChild when Vue or an outer cleanup already detached the element',
  )
})
