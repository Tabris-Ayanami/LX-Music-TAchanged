const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const asidePath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'index.vue')
const appPath = path.join(rootDir, 'src', 'renderer', 'App.vue')
const asideSource = fs.readFileSync(asidePath, 'utf8')
const appSource = fs.readFileSync(appPath, 'utf8')

test('RG-008: sidebar brand keeps a fixed logo lane while only collapsing the text lane', () => {
  assert.match(
    asideSource,
    /\.panel \{[\s\S]*--sidebar-icon-lane: 44px;[\s\S]*--sidebar-logo-size: 34px;[\s\S]*--sidebar-icon-glyph-size: 16px;/,
    'Sidebar should define a compact shared icon lane with a smaller logo tile and glyph',
  )
  assert.match(
    asideSource,
    /\.brand \{[\s\S]*grid-template-columns: var\(--sidebar-icon-lane\) minmax\(0, 1fr\);/,
    'Brand row should keep a fixed-width logo lane so the logo anchor does not shift during collapse',
  )
  assert.match(
    asideSource,
    /\.brandRow \{[\s\S]*height: var\(--sidebar-icon-lane\);[\s\S]*min-height: var\(--sidebar-icon-lane\);[\s\S]*overflow: visible;/m,
    'Brand row should reserve the full logo lane height and avoid clipping the logo tile',
  )
  assert.match(
    asideSource,
    /<strong :class="\$style\.brandText">LX MUSIC<\/strong>/,
    'Sidebar title should use the requested uppercase LX MUSIC text',
  )
  assert.doesNotMatch(
    asideSource,
    /#icon-lx-note/,
    'Sidebar brand should draw its own music-note mark instead of reusing the old LX note symbol',
  )
  assert.doesNotMatch(
    asideSource,
    /\.collapsed \s*\{[\s\S]*\.brandRow \{[\s\S]*justify-content:/,
    'Collapsed brand state should not re-center the brand row because that makes the logo jump horizontally',
  )
  assert.match(
    asideSource,
    /\.collapsed \s*\{[\s\S]*\.brandLink \{[\s\S]*max-width: 0;[\s\S]*opacity: 0;[\s\S]*transform: translateX\(-6px\);/,
    'Collapsed brand state should hide the text lane by collapsing it rather than removing the logo anchor',
  )
  assert.match(
    asideSource,
    /\.collapsed \s*\{[\s\S]*\.brand \{[\s\S]*gap: 0;/,
    'Collapsed brand state should remove the text-lane gap so the logo lane fits the collapsed sidebar exactly',
  )
  assert.match(
    asideSource,
    /\.panel \{[\s\S]*--sidebar-motion-duration: \.46s;[\s\S]*--sidebar-motion-curve: cubic-bezier\(\.2, 0, 0, 1\);/m,
    'Sidebar panel should expose a shared slower motion curve for collapse animation',
  )
  assert.match(
    asideSource,
    /\.logo \{[\s\S]*position: absolute;[\s\S]*inset: 50% auto auto 50%;[\s\S]*transform: translate\(-50%, -50%\);[\s\S]*width: var\(--sidebar-logo-size\);[\s\S]*height: var\(--sidebar-logo-size\);[\s\S]*border-radius: var\(--sidebar-item-radius\);[\s\S]*corner-shape: squircle;/m,
    'Sidebar logo tile should be absolutely centered in the touch lane while keeping stable squircle geometry',
  )
  assert.match(
    appSource,
    /'--sidebar-width': isSidebarCollapsed \? '80px' : '196px'/m,
    'The outer sidebar width should fit a 44px icon lane plus the wider sidebar panel gutters',
  )
  assert.match(
    appSource,
    /#left \{[\s\S]*padding: 0;/m,
    'Outer sidebar shell should not add a second padding layer around the sidebar panel',
  )
  assert.match(
    appSource,
    /#left \{[\s\S]*contain: layout style;[\s\S]*transition: width \.46s cubic-bezier\(\.2, 0, 0, 1\);/m,
    'Outer sidebar shell should avoid paint containment and use the same slower width animation curve',
  )
})
