const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const navBarPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'NavBar.vue')
const navBarSource = fs.readFileSync(navBarPath, 'utf8')

test('RG-007: sidebar collapse keeps a fixed icon column and only collapses the label lane', () => {
  assert.match(
    navBarSource,
    /\.link \{[\s\S]*grid-template-columns: 42px minmax\(0, 1fr\);/,
    'Sidebar links should keep a stable icon column in the default layout',
  )
  assert.match(
    navBarSource,
    /\.iconWrap \{[\s\S]*width: 36px;[\s\S]*height: 36px;[\s\S]*justify-self: center;[\s\S]*overflow: visible;/,
    'Sidebar icon boxes should stay centered inside the fixed 42px lane so the translucent tile keeps a consistent inset',
  )
  assert.match(
    navBarSource,
    /\.iconWrap \{[\s\S]*background: transparent;[\s\S]*border: none;/,
    'Sidebar icons should no longer render an extra translucent square frame around each icon',
  )
  assert.doesNotMatch(
    navBarSource,
    /\.collapsed \s*\{[\s\S]*\.link \{[\s\S]*grid-template-columns:/,
    'Collapsed sidebar should not redefine the grid columns, otherwise the icon lane can jump during the width animation',
  )
  assert.match(
    navBarSource,
    /\.collapsed \s*\{[\s\S]*\.link \{[\s\S]*width: 42px;[\s\S]*margin: 0;[\s\S]*justify-items: start;/s,
    'Collapsed sidebar should keep the nav item anchored to the same fixed left baseline',
  )
  assert.match(
    navBarSource,
    /\.collapsed \s*\{[\s\S]*\.iconWrap \{[\s\S]*grid-column: 1;[\s\S]*justify-self: center;/s,
    'Collapsed sidebar should keep the icon box on the first grid lane while centering it inside the fixed 42px track',
  )
  assert.match(
    navBarSource,
    /\.collapsed \s*\{[\s\S]*\.label \{[\s\S]*max-width: 0;[\s\S]*opacity: 0;[\s\S]*transform: translateX\(-6px\);/s,
    'Collapsed sidebar should only hide the label lane while preserving the icon lane geometry',
  )
})
