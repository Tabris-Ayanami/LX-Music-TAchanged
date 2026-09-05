'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const searchInputPath = path.join(root, 'src', 'renderer', 'components', 'material', 'SearchInput.vue')
const globalLessPath = path.join(root, 'src', 'renderer', 'assets', 'styles', 'index.less')
const searchInputSource = fs.readFileSync(searchInputPath, 'utf8')
const globalLessSource = fs.readFileSync(globalLessPath, 'utf8')

test('collapsed search icon anchors to the right semicircle center without a circular frame', () => {
  // default pill: 170px wide, radius 25 -> right semicircle center at 145px;
  // 46px button natural left edge is 170, so the icon center lands on 145 with -48px.
  assert.match(
    searchInputSource,
    /\.searchBtn\s*\{[\s\S]*?transform:\s*translateX\(-48px\);/m,
    'The collapsed icon should translate so its center matches the pill right semicircle center',
  )
  assert.match(
    searchInputSource,
    /\.gooLayerButton\s*\{[\s\S]*?transform:\s*translateX\(-48px\) scale\(\.4\);/m,
    'The gooey ball should start from the same right-anchored position as the collapsed icon',
  )
  // Compact toolbar geometry uses the 30px icon lane and its shared goo offset.
  assert.match(
    searchInputSource,
    /\.searchBtn\s*\{[\s\S]*?width:\s*30px;[\s\S]*?transform:\s*translateX\(-31\.5px\);/m,
    'The small toolbar icon should anchor to the small pill right semicircle center',
  )
  assert.match(
    searchInputSource,
    /\.gooLayerButton\s*\{[\s\S]*?width:\s*30px;[\s\S]*?transform:\s*translateX\(-31\.5px\) scale\(\.4\);/m,
    'The small gooey ball should start from the same collapsed position',
  )
})

test('dark mode searchBtn glow is scoped to the expanded state so it cannot overlap the pill', () => {
  assert.match(
    searchInputSource,
    /:global\(\.themeShellDark\)\s*\{[\s\S]*?\.goo:not\(\.collapsed\) \.searchBtn\s*\{[\s\S]*?box-shadow:/m,
    'The dark-mode circular glow must only render once the capsule is expanded',
  )
  assert.doesNotMatch(
    searchInputSource,
    /:global\(\.themeShellDark\)\s*\{[\s\S]*?\n\s*\.searchBtn\s*\{[\s\S]*?box-shadow:/m,
    'The dark-mode block should not apply the glow to the collapsed search button',
  )
})

test('global focus-visible rule no longer forces a theme outline on tabindex elements', () => {
  assert.match(
    globalLessSource,
    /:where\(button, a\):focus-visible\s*\{/,
    'Buttons and links should keep an accessible focus ring',
  )
  assert.doesNotMatch(
    globalLessSource,
    /:where\(button, a, \[tabindex\]\):/,
    'The forced theme outline must not target generic tabindex elements (search input focus line)',
  )
})
