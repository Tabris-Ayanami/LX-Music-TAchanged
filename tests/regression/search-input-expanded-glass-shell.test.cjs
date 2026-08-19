const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const searchInputPath = path.join(rootDir, 'src', 'renderer', 'components', 'material', 'SearchInput.vue')
const blankViewPath = path.join(rootDir, 'src', 'renderer', 'views', 'Search', 'components', 'BlankView.vue')
const toolbarSearchInputPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Toolbar', 'SearchInput.vue')

const searchInputSource = fs.readFileSync(searchInputPath, 'utf8')
const blankViewSource = fs.readFileSync(blankViewPath, 'utf8')
const toolbarSearchInputSource = fs.readFileSync(toolbarSearchInputPath, 'utf8')

test('RG-023: search suggestions expand the toolbar shell into a blurred glass panel', () => {
  assert.match(
    searchInputSource,
    /\$style\.goo,[\s\S]*\[\$style\.active\]: focus,[\s\S]*\[\$style\.expanded\]: visibleList/m,
    'The search shell should track a dedicated expanded state when suggestion/history rows are visible',
  )
  assert.match(
    searchInputSource,
    /<filter id="lx-search-goo">[\s\S]*<feGaussianBlur[\s\S]*<feColorMatrix[\s\S]*<feComposite/m,
    'The search shell should keep the dedicated goo filter used by the capsule and detached action button',
  )
  assert.match(
    searchInputSource,
    /\$style\.gooLayer/m,
    'The goo filter should be isolated in a decorative layer',
  )
  assert.match(
    searchInputSource,
    /\.gooLayer\s*\{[\s\S]*?filter:\s*url\(#lx-search-goo\);/m,
    'Only the decorative background layer should receive the SVG goo filter',
  )
  const gooRootBlock = searchInputSource.match(/\.goo\s*\{([^}]*)\}/m)?.[1] ?? ''
  assert.doesNotMatch(gooRootBlock, /filter:/, 'The interactive shell must not filter its border, input, or icon')
  assert.equal(
    (searchInputSource.match(/d="M10 6\.5C10 8\.433/g) ?? []).length,
    1,
    'Collapsed and expanded states should share one search-icon source',
  )
  assert.match(
    searchInputSource,
    /\.list \{[\s\S]*z-index: 10;[\s\S]*background: var\(--search-panel-bg,[\s\S]*border: 1px solid var\(--shell-divider,/m,
    'The suggestion list should render as a separate readable surface above the goo layer',
  )
  assert.match(
    searchInputSource,
    /:global\(\.goo-item-enter-from\) \{[\s\S]*translateY\(10px\) scale\(\.96\);[\s\S]*filter: blur\(6px\);/m,
    'Suggestion items should keep the stagger-compatible reveal motion',
  )
})

test('RG-024: blank search view stays a content-only layer after moving the blur back to the toolbar shell', () => {
  assert.doesNotMatch(
    blankViewSource,
    /backdrop-filter:\s*blur\(/m,
    'BlankView should not keep a fixed blurred backdrop once the glass shell is owned by the expanding toolbar search surface',
  )
  assert.doesNotMatch(
    blankViewSource,
    /&::before\s*\{/m,
    'BlankView should not paint its own pseudo-element shell after the search overlay is reverted',
  )
})

test('RG-027: focusing the toolbar search alone does not force-open the expanded glass panel', () => {
  assert.match(
    toolbarSearchInputSource,
    /const syncVisibleByQuery = \(\) => \{[\s\S]*visibleList\.value = isFocused && !!searchText\.value\.trim\(\)/m,
    'The expanded search shell should only open when the user has an actual query, not on focus alone',
  )
  assert.match(
    toolbarSearchInputSource,
    /case 'focus':[\s\S]*isFocused = true[\s\S]*syncVisibleByQuery\(\)/m,
    'Focus handling should preserve the compact shell when the input is still empty',
  )
})

test('RG-028: the clear action replaces the clipped global focus ring with an internal focus treatment', () => {
  assert.match(
    searchInputSource,
    /\.clearBtn\s*\{[\s\S]*?&:focus-visible\s*\{[\s\S]*?outline:\s*none\s*!important;/m,
    'The global button focus ring is clipped by the search capsule and otherwise appears as a theme-color divider',
  )
})
