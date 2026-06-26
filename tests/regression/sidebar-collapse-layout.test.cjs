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
    /\.menu \{[\s\S]*--sidebar-nav-rail: var\(--sidebar-icon-lane, 44px\);[\s\S]*--sidebar-nav-height: var\(--sidebar-item-height, 40px\);[\s\S]*--sidebar-nav-radius: var\(--sidebar-item-radius, 12px\);[\s\S]*--sidebar-nav-glyph: var\(--sidebar-icon-glyph-size, 16px\);[\s\S]*--sidebar-motion-duration: \.46s;[\s\S]*--sidebar-motion-curve: cubic-bezier\(\.2, 0, 0, 1\);[\s\S]*margin-left: 0;[\s\S]*padding: 0;/,
    'Sidebar nav should define shared geometry tokens for expanded and collapsed states',
  )
  assert.match(
    navBarSource,
    /:data-nav-key="item\.key"/m,
    'Each sidebar row should expose a stable DOM key so the active pill can measure the rendered target',
  )
  assert.match(
    navBarSource,
    /const pillRect = ref\(\{[\s\S]*x: 0,[\s\S]*y: 0,[\s\S]*width: 0,[\s\S]*height: 0,/m,
    'The sidebar active pill should store measured geometry instead of deriving it from duplicated layout constants',
  )
  assert.match(
    navBarSource,
    /querySelectorAll\('\[data-nav-key\]'\)[\s\S]*link\.dataset\.navKey == key/m,
    'The active pill should resolve its target from the rendered nav element key',
  )
  assert.match(
    navBarSource,
    /const menuBounds = menuEl\.getBoundingClientRect\(\)[\s\S]*const linkBounds = linkEl\.getBoundingClientRect\(\)[\s\S]*const blockInset = 0[\s\S]*const measuredHeight = Math\.max\(0, linkBounds\.height - blockInset \* 2\)[\s\S]*const targetWidth = Math\.max\(0, getSidebarContentTargetWidth\(menuEl\) - inlineInset \* 2\)[\s\S]*const width = isSidebarCollapsed\.value \? Math\.min\(targetWidth, measuredHeight\) : targetWidth[\s\S]*const height = measuredHeight[\s\S]*x: linkBounds\.left - menuBounds\.left \+ inlineInset,[\s\S]*y: linkBounds\.top - menuBounds\.top \+ blockInset,/m,
    'The active pill should use the target sidebar width while keeping its left/top/bottom edges fixed',
  )
  assert.match(
    navBarSource,
    /getCssPxNumber\(el, '--sidebar-width', isSidebarCollapsed\.value \? 80 : 196\)[\s\S]*getCssPxNumber\(el, '--sidebar-panel-x', 16\) \* 2/m,
    'Sidebar active pill should read the CSS target width instead of measuring the animated intermediate width',
  )
  assert.match(
    navBarSource,
    /const width = isSidebarCollapsed\.value \? Math\.min\(targetWidth, measuredHeight\) : targetWidth[\s\S]*const height = measuredHeight/m,
    'Collapsed sidebar active pill should become square from the target width by shrinking only its right edge',
  )
  assert.doesNotMatch(
    navBarSource,
    /const itemHeight|const itemGap|const sectionTitleHeight|const sectionGap|const sectionTitleGap/m,
    'Sidebar active-pill positioning should not depend on hand-maintained layout constants',
  )
  assert.match(
    navBarSource,
    /const trackPillDuringLayoutMotion = \(\) => \{[\s\S]*pillTracking\.value = true[\s\S]*if \(pillTrackTimer\) clearTimeout\(pillTrackTimer\)[\s\S]*pillTrackTimer = setTimeout\(\(\) => \{[\s\S]*pillTracking\.value = false[\s\S]*measureCurrentPill\(\)[\s\S]*\}, sidebarMotionMs \+ 80\)/m,
    'The active pill should animate to a single target and only re-measure once after layout motion completes',
  )
  assert.doesNotMatch(
    navBarSource,
    /requestAnimationFrame\(tick\)/m,
    'Sidebar active pill tracking should not restart transitions every frame during collapse',
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
    /\.navPill \{[\s\S]*will-change: transform, width;[\s\S]*transition:[\s\S]*transform var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*box-shadow 220ms ease;/m,
    'Sidebar active pill should animate only transform and width so its vertical bounds do not pulse during collapse',
  )
  assert.match(
    navBarSource,
    /\.navPill\.tracking \{[\s\S]*transform var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*box-shadow 220ms ease;/m,
    'Tracking state should keep the width transition so both expand and collapse remain animated',
  )
  assert.doesNotMatch(
    navBarSource,
    /\.navPill \{[^}]*height var\(--sidebar-motion-duration\)/m,
    'Sidebar active pill should not animate height when collapse is meant to extend only from the right edge',
  )
  assert.match(
    navBarSource,
    /\.sectionTitle \{[\s\S]*margin: 0;[\s\S]*height: 11px;[\s\S]*transition: opacity \.28s var\(--sidebar-motion-curve\), color @transition-fast;/m,
    'Collapsed section titles should fade without changing reserved layout height',
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
  assert.doesNotMatch(
    navBarSource,
    /\.link \{[\s\S]*&::before/m,
    'Sidebar links should not keep a second pseudo-element highlight that can drift away from the measured pill',
  )
  assert.doesNotMatch(
    navBarSource,
    /transform: translateY\(-1px\);/m,
    'Sidebar links should not move their own measured box on hover because that double-applies motion to the active pill',
  )
  assert.match(
    navBarSource,
    /\.label \{[\s\S]*transition: max-width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\), opacity \.28s ease, transform var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\);/m,
    'Sidebar label collapse should use the shared slower motion curve instead of snapping away',
  )
})
