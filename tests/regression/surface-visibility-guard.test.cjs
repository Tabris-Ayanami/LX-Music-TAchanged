const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')

const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8')

test('RG-014: selection, menu, and modal surfaces stay opaque enough to avoid overlapping underlying content', () => {
  const selectionSource = read('src', 'renderer', 'components', 'base', 'Selection.vue')
  const menuSource = read('src', 'renderer', 'components', 'base', 'Menu.vue')
  const modalSource = read('src', 'renderer', 'components', 'material', 'Modal.vue')

  assert.match(
    selectionSource,
    /z-index:\s*12;/,
    'Selection should elevate the active control above neighboring fields while its popup is open',
  )
  assert.match(
    selectionSource,
    /linear-gradient\(\s*180deg,\s*color-mix\(in srgb, var\(--color-primary\) 16%, rgba\(255, 255, 255, 0\.995\)\),\s*color-mix\(in srgb, var\(--color-primary\) 24%, rgba\(255, 255, 255, 0\.99\)\)\s*\)/m,
    'Selection popup should use an opaque theme-tinted surface instead of a translucent content background',
  )
  assert.match(
    selectionSource,
    /background-color:\s*color-mix\(in srgb, var\(--color-primary\) 10%, rgba\(255, 255, 255, 0\.985\)\);/m,
    'Selection items should have their own surface so neighboring controls do not bleed through',
  )
  assert.match(
    selectionSource,
    /clearHideTimer\(\)/m,
    'Selection should clear deferred hide timers when the popup is reopened or unmounted',
  )

  for (const [name, source] of [['menu', menuSource], ['modal', modalSource]]) {
    assert.match(
      source,
      /linear-gradient\(\s*180deg,\s*color-mix\(in srgb, var\(--color-primary\) 16%, rgba\(255, 255, 255, 0\.995\)\),\s*color-mix\(in srgb, var\(--color-primary\) 24%, rgba\(255, 255, 255, 0\.99\)\)\s*\)/m,
      `${name} surfaces should stay opaque enough to avoid overlapping underlying content`,
    )
    assert.match(
      source,
      /isolation:\s*isolate;/m,
      `${name} surfaces should isolate their own paint layer from the background`,
    )
  }
})

test('RG-015: list hover states stay explicit in every affected list view', () => {
  const files = [
    ['src', 'renderer', 'views', 'List', 'MusicList', 'index.vue'],
    ['src', 'renderer', 'components', 'material', 'OnlineList', 'index.vue'],
    ['src', 'renderer', 'views', 'Download', 'index.vue'],
  ]

  for (const parts of files) {
    const source = read(...parts)
    const label = parts.slice(-3).join('/')
    assert.match(
      source,
      /:global\(\.list-item\)[\s\S]*&:hover\s*\{[\s\S]*background-color:\s*color-mix\(in srgb, var\(--color-primary\) 34%, rgba\(255, 255, 255, 0\.94\)\) !important;/m,
      `${label} should keep a direct, visible hover surface on list rows`,
    )
    assert.match(
      source,
      /&\.active\s*\{[\s\S]*background-color:\s*color-mix\(in srgb, var\(--color-primary\) 44%, rgba\(255, 255, 255, 0\.92\)\) !important;/m,
      `${label} should keep a stronger active surface than the hover state`,
    )
  }
})
