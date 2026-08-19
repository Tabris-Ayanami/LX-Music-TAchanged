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
    /\$style\.goo,[\s\S]*\[\$style\.collapsed\]: !expanded[\s\S]*@click="handleMainClick"/m,
    'The goo shell should keep the existing host as the interaction owner',
  )
  assert.match(
    searchInputSource,
    /\.goo:not\(\.collapsed\) \{[\s\S]*\.input \{[\s\S]*pointer-events: auto;[\s\S]*\}/m,
    'The input should become interactive only after the compact shell expands',
  )
  assert.match(
    searchInputSource,
    /\.list \{[\s\S]*position: absolute;[\s\S]*z-index: 10;/m,
    'Suggestion lists should render above the goo layer so hover and click selection remain usable',
  )
  assert.doesNotMatch(
    toolbarSource,
    /\.actions \{[\s\S]*overflow: hidden;[\s\S]*> \* \{/m,
    'Toolbar actions should remain a simple control group and not clip optimized button effects',
  )
})
