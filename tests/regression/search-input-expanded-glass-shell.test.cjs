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
    /:class="\[\$style\.search, \{\[\$style\.active\]: focus\}, \{\[\$style\.expanded\]: visibleList\}/m,
    'The search shell should track a dedicated expanded state when suggestion/history rows are visible',
  )
  assert.match(
    searchInputSource,
    /<LiquidGlassLayer[\s\S]*:active="true"[\s\S]*:blur-amount="visibleList \? 1\.9 : 1\.5"[\s\S]*:saturation="visibleList \? 220 : 206"[\s\S]*:over-light="visibleList"/m,
    'The search shell should stay visible in its compact glass state and only deepen blur while the expanded suggestion panel is open',
  )
  assert.match(
    searchInputSource,
    /\.list \{[\s\S]*&::before \{[\s\S]*backdrop-filter: blur\(32px\) saturate\(184%\);[\s\S]*opacity: 0;[\s\S]*\}\s*[\s\S]*ul \{[\s\S]*opacity: 0;[\s\S]*transform: translateY\(-10px\);/m,
    'The suggestion list should render its own blurred glass panel and stagger the content reveal behind the expanding shell',
  )
  assert.match(
    searchInputSource,
    /\.expanded \{[\s\S]*\.list \{[\s\S]*&::before \{[\s\S]*opacity: 1;[\s\S]*transform: scaleY\(1\);[\s\S]*\}[\s\S]*ul \{[\s\S]*opacity: 1;[\s\S]*transform: translateY\(0\);/m,
    'The expanded search state should animate the shell blur and content separately to avoid text appearing before the glass panel',
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
