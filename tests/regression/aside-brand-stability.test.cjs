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
    /\.brand \{[\s\S]*grid-template-columns: 42px minmax\(0, 1fr\);/,
    'Brand row should keep a fixed-width logo lane so the logo anchor does not shift during collapse',
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
    /\.panel \{[\s\S]*overflow: visible;[\s\S]*contain: layout style;/m,
    'Sidebar panel should avoid paint containment so continuous corners are not clipped during collapse animation',
  )
  assert.match(
    asideSource,
    /\.panel \{[\s\S]*--sidebar-motion-duration: \.46s;[\s\S]*--sidebar-motion-curve: cubic-bezier\(\.2, 0, 0, 1\);/m,
    'Sidebar panel should expose a shared slower motion curve for collapse animation',
  )
  assert.match(
    asideSource,
    /\.logo \{[\s\S]*width: 42px;[\s\S]*height: 42px;[\s\S]*border-radius: 12px;[\s\S]*corner-shape: squircle;/m,
    'Sidebar logo tile should use a stable square squircle geometry',
  )
  assert.match(
    appSource,
    /#left \{[\s\S]*contain: layout style;[\s\S]*transition: width \.46s cubic-bezier\(\.2, 0, 0, 1\);/m,
    'Outer sidebar shell should avoid paint containment and use the same slower width animation curve',
  )
})
