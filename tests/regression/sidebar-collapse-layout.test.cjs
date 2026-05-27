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
    /\.menu \{[\s\S]*--sidebar-nav-rail: 42px;[\s\S]*--sidebar-nav-height: 46px;[\s\S]*--sidebar-nav-radius: 14px;[\s\S]*--sidebar-active-left-bleed: 4px;[\s\S]*--sidebar-active-right-trim: 8px;[\s\S]*--sidebar-motion-duration: \.46s;[\s\S]*--sidebar-motion-curve: cubic-bezier\(\.2, 0, 0, 1\);[\s\S]*margin-left: calc\(var\(--sidebar-active-left-bleed\) \* -1\);[\s\S]*padding: 0 2px 2px var\(--sidebar-active-left-bleed\);/,
    'Sidebar nav should define shared geometry tokens for expanded and collapsed states',
  )
  assert.match(
    navBarSource,
    /\.link \{[\s\S]*height: var\(--sidebar-nav-height\);[\s\S]*padding: 0 12px 0 0;[\s\S]*grid-template-columns: var\(--sidebar-nav-rail\) minmax\(0, 1fr\);/,
    'Sidebar links should keep a stable icon column in the default layout',
  )
  assert.match(
    navBarSource,
    /\.iconWrap \{[\s\S]*width: var\(--sidebar-nav-rail\);[\s\S]*height: var\(--sidebar-nav-rail\);[\s\S]*justify-self: center;[\s\S]*overflow: visible;/,
    'Sidebar icon boxes should fill the fixed 42px lane so icons remain centered in square active tiles',
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
    /\.collapsed \s*\{[\s\S]*\.link \{[\s\S]*width: var\(--sidebar-nav-rail\);[\s\S]*max-width: var\(--sidebar-nav-rail\);[\s\S]*height: var\(--sidebar-nav-height\);[\s\S]*min-height: var\(--sidebar-nav-height\);[\s\S]*padding: 0;[\s\S]*margin: 0;[\s\S]*justify-items: start;/s,
    'Collapsed sidebar should keep the nav item anchored to the same fixed left baseline while using the shared row height',
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
  assert.doesNotMatch(
    navBarSource,
    /\.menu:not\(\.collapsed\)[\s\S]*margin-left: -3px|padding-left: 3px;/m,
    'Expanded active state must not shift the active tile by a few pixels compared with collapsed state',
  )
  assert.match(
    navBarSource,
    /\.link \{[\s\S]*&::before \{[\s\S]*inset: 2px var\(--sidebar-active-right-trim\) 2px calc\(var\(--sidebar-active-left-bleed\) \* -1\);[\s\S]*border-radius: inherit;[\s\S]*corner-shape: squircle;/m,
    'Expanded active and hover fills should keep the same 42px visual height as collapsed while using shared left bleed and right trim',
  )
  assert.match(
    navBarSource,
    /\.collapsed \s*\{[\s\S]*\.link \{[\s\S]*&::before \{[\s\S]*inset: 2px 0 2px calc\(var\(--sidebar-active-left-bleed\) \* -1\);/s,
    'Collapsed active fill must keep the same left bleed as expanded so the left edge stays pixel-aligned during collapse',
  )
  assert.match(
    navBarSource,
    /\.label \{[\s\S]*transition: max-width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\), opacity \.28s ease, transform var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\);/m,
    'Sidebar label collapse should use the shared slower motion curve instead of snapping away',
  )
})
