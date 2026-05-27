const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const localDetailPath = path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'Detail.vue')
const localIndexPath = path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'index.vue')
const localDetailSource = fs.readFileSync(localDetailPath, 'utf8')
const localIndexSource = fs.readFileSync(localIndexPath, 'utf8')

test('RG-031: local album and artist pages share the artwork header while keeping readable light lists', () => {
  assert.match(
    localDetailSource,
    /<div :class="\$style\.coverGlow" \/>/m,
    'Local detail pages should keep cover blur only in the header shell',
  )
  assert.match(
    localDetailSource,
    /background: var\(--color-content-background\);/m,
    'Local detail lists should keep the app light content background for readability',
  )
  assert.match(
    localDetailSource,
    /viewBox="0 0 1024 1024"[\s\S]*xlink:href="#icon-play"/m,
    'Local detail play action should use the same icon-only play button as online song lists',
  )
  assert.match(
    localIndexSource,
    /\.gridShell \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/m,
    'The local album wall should render five columns on desktop-sized layouts',
  )
  assert.doesNotMatch(
    localIndexSource,
    /@media \(max-width: 1600px\)[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/m,
    'The local album wall should not drop to four columns at the common desktop width',
  )
})
