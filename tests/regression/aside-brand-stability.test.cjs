const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const asidePath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'index.vue')
const asideSource = fs.readFileSync(asidePath, 'utf8')

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
})
