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
    /\.menu \{[\s\S]*--sidebar-nav-rail: var\(--sidebar-icon-lane, 44px\);[\s\S]*--sidebar-nav-height: var\(--sidebar-item-height, 40px\);[\s\S]*--sidebar-nav-radius: var\(--sidebar-item-radius, 12px\);[\s\S]*--sidebar-nav-glyph: var\(--sidebar-icon-glyph-size, 16px\);[\s\S]*--sidebar-active-left-bleed: 0px;[\s\S]*--sidebar-active-right-trim: 6px;[\s\S]*--sidebar-motion-duration: \.46s;[\s\S]*--sidebar-motion-curve: cubic-bezier\(\.2, 0, 0, 1\);[\s\S]*margin-left: 0;[\s\S]*padding: 0;/,
    'Sidebar nav should define shared geometry tokens for expanded and collapsed states',
  )
  assert.match(
    navBarSource,
    /\.link \{[\s\S]*height: var\(--sidebar-nav-height\);[\s\S]*padding: 0 9px 0 0;[\s\S]*grid-template-columns: var\(--sidebar-nav-rail\) minmax\(0, 1fr\);/,
    'Sidebar links should keep a stable icon column in the default layout',
  )
  assert.match(
    navBarSource,
    /\.link \{[\s\S]*transition:[\s\S]*width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*max-width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*padding var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*gap var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),/m,
    'Sidebar links should animate their width, padding, and gap so active tiles morph instead of snapping during collapse',
  )
  assert.match(
    navBarSource,
    /\.iconWrap \{[\s\S]*width: var\(--sidebar-nav-rail\);[\s\S]*height: var\(--sidebar-nav-rail\);[\s\S]*justify-self: center;[\s\S]*overflow: visible;[\s\S]*svg \{[\s\S]*width: var\(--sidebar-nav-glyph\);[\s\S]*height: var\(--sidebar-nav-glyph\);/m,
    'Sidebar icon boxes should fill the fixed nav rail so icons remain centered in square active tiles',
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
    'Collapsed sidebar should keep the icon box on the first grid lane while centering it inside the fixed track',
  )
  assert.match(
    navBarSource,
    /\.collapsed \s*\{[\s\S]*\.label \{[\s\S]*max-width: 0;[\s\S]*opacity: 0;[\s\S]*transform: translateX\(-6px\);/s,
    'Collapsed sidebar should only hide the label lane while preserving the icon lane geometry',
  )
  assert.doesNotMatch(
    navBarSource,
    /\.menu:not\(\.collapsed\)[\s\S]*margin-left: -\d+px|padding-left: \d+px;/m,
    'Expanded active state must not shift the active tile compared with collapsed state',
  )
  assert.match(
    navBarSource,
    /\.link \{[\s\S]*&::before \{[\s\S]*inset: 2px var\(--sidebar-active-right-trim\) 2px calc\(var\(--sidebar-active-left-bleed\) \* -1\);[\s\S]*border-radius: inherit;[\s\S]*corner-shape: squircle;/m,
    'Expanded active and hover fills should keep the same visual height as collapsed while using shared left bleed and right trim',
  )
  assert.match(
    navBarSource,
    /\.link \{[\s\S]*&::before \{[\s\S]*transition: inset var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\), background-color @transition-fast;/m,
    'Sidebar active fill should animate inset changes so the rectangle-to-square transition is continuous',
  )
  assert.match(
    navBarSource,
    /\.collapsed \s*\{[\s\S]*\.link \{[\s\S]*&::before \{[\s\S]*inset: 2px calc\(var\(--sidebar-active-left-bleed\) \* -1\) 2px calc\(var\(--sidebar-active-left-bleed\) \* -1\);/s,
    'Collapsed active fill should keep the expanded-state height and left edge while expanding right equally so its center lines up with the icon center',
  )
  assert.match(
    navBarSource,
    /\.label \{[\s\S]*transition: max-width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\), opacity \.28s ease, transform var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\);/m,
    'Sidebar label collapse should use the shared slower motion curve instead of snapping away',
  )
})
