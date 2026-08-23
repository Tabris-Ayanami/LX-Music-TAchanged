const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8')

test('local music query changes reuse one keep-alive view instance', () => {
  const source = read('src', 'renderer', 'components', 'layout', 'View.vue')

  assert.match(
    source,
    /route\.path == '\/local'[\s\S]*return route\.path[\s\S]*const query = route\.query/m,
    'The local music route should use a stable keep-alive key while other routes retain query-specific keys',
  )
})
