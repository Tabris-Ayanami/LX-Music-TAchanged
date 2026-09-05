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
    /var\(--shell-popover, var\(--shell-card-strong, var\(--color-main-background\)\)\)/m,
    'Selection popup should use the current shell surface instead of a transparent background',
  )
  assert.match(
    selectionSource,
    /background-color:\s*var\(--shell-list-hover, var\(--color-list-hover-background\)\);/m,
    'Selection items should use the themed hover surface above the opaque popup',
  )
  assert.match(
    selectionSource,
    /clearHideTimer\(\)/m,
    'Selection should clear deferred hide timers when the popup is reopened or unmounted',
  )

  for (const [name, source] of [['menu', menuSource], ['modal', modalSource]]) {
    assert.match(
      source,
      /var\(--shell-(?:popover|modal), var\(--shell-card-strong/m,
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
      /:global\(\.list-item\)[\s\S]*&:hover\s*\{[\s\S]*background-color:\s*var\(--shell-list-hover, var\(--color-list-hover-background\)\) !important;/m,
      `${label} should keep a direct, visible hover surface on list rows`,
    )
    assert.match(
      source,
      /&\.active\s*\{[\s\S]*background-color:\s*var\(--shell-list-active, var\(--color-list-active-background\)\) !important;/m,
      `${label} should keep a stronger active surface than the hover state`,
    )
  }
})
