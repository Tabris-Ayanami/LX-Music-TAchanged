const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const viewPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'View.vue')
const viewSource = fs.readFileSync(viewPath, 'utf8')

test('RG-006: layout view guards router-view component before mounting keep-alive child', () => {
  assert.match(
    viewSource,
    /<component\s+:is="Component"\s+v-if="Component"\s+:key="routeViewKey"\s+class="view-container"\s*\/>/,
    'The keep-alive view shell should only mount the dynamic route component after router-view provides a concrete component',
  )
})
