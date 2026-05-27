const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const searchInputPath = path.join(rootDir, 'src', 'renderer', 'components', 'material', 'SearchInput.vue')
const toolbarPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Toolbar', 'index.vue')

const searchInputSource = fs.readFileSync(searchInputPath, 'utf8')
const toolbarSource = fs.readFileSync(toolbarPath, 'utf8')

test('RG-019: glass search and toolbar surfaces keep live controls above the overlay', () => {
  assert.match(
    searchInputSource,
    /<div :class="\[\$style\.search,[\s\S]*>\s*<LiquidGlassLayer[\s\S]*variant="search"[\s\S]*:active="true"[\s\S]*:interactive="true"/m,
    'The search shell should mount the glass layer inside the existing host instead of replacing the input surface',
  )
  assert.match(
    searchInputSource,
    /\.form \{[\s\S]*position: relative;[\s\S]*z-index: 1;/m,
    'Search form controls should stay above the glass overlay so focus, typing, and action buttons remain usable',
  )
  assert.match(
    searchInputSource,
    /\.list \{[\s\S]*position: relative;[\s\S]*z-index: 1;/m,
    'Suggestion lists should render above the glass layer so hover and click selection continue to work when the panel expands',
  )
  assert.match(
    toolbarSource,
    /\.actions \{[\s\S]*position: relative;[\s\S]*overflow: hidden;[\s\S]*isolation: isolate;[\s\S]*> \* \{[\s\S]*z-index: 1;/m,
    'Toolbar actions should isolate the glass shell and keep the settings button plus window controls in the interactive foreground',
  )
})
