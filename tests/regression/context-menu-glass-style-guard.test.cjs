const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const baseMenuPath = path.join(rootDir, 'src', 'renderer', 'components', 'base', 'Menu.vue')
const lyricMenuPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'components', 'LyricMenu.vue')
const baseMenuSource = fs.readFileSync(baseMenuPath, 'utf8')
const lyricMenuSource = fs.readFileSync(lyricMenuPath, 'utf8')

test('RG-029: context menus use a readable macOS-style blurred glass shell', () => {
  for (const source of [baseMenuSource, lyricMenuSource]) {
    assert.match(
      source,
      /backdrop-filter: blur\(26px\) saturate\(180%\);/m,
      'Context menu shells should blur the background instead of becoming transparent over artwork or lyrics',
    )
    assert.match(
      source,
      /border: 1px solid rgba\(255, 255, 255, 0\.42\);/m,
      'Context menu shells should keep a visible glass border',
    )
    assert.match(
      source,
      /color-mix\(in srgb, var\(--color-primary\) 16%, rgba\(255, 255, 255, 0\.995\)\)/m,
      'Context menu shells should keep a high-opacity white material fill for readability over lyrics and artwork',
    )
  }
})
