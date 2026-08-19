const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('compact search shell owns its size and supports keyboard expansion', () => {
  const source = read('src/renderer/components/material/SearchInput.vue')
  assert.match(source, /\$style\.smallContainer\]: small/)
  assert.match(source, /@keydown\.enter\.prevent="handleMainClick"/)
  assert.match(source, /@keydown\.space\.prevent="handleMainClick"/)
})

test('new motion surfaces provide a reduced-motion fallback', () => {
  for (const file of [
    'src/renderer/components/material/SearchInput.vue',
    'src/renderer/components/common/OriginChip.vue',
    'src/renderer/views/Discover/index.vue',
  ]) {
    assert.match(read(file), /prefers-reduced-motion:\s*reduce/, `${file} should respect reduced motion`)
  }
})

test('discover avoids nested interactive controls and restores reused images', () => {
  const source = read('src/renderer/views/Discover/index.vue')
  assert.doesNotMatch(source, /role="button" tabindex="0"[\s\S]{0,700}button\(:class="\$style\.npPlay"/)
  assert.match(source, /@load="imgLoad"/)
  assert.match(source, /const imgLoad = event => \{[\s\S]*visibility = ''/)
  assert.match(source, /dailyLoading/)
})

test('account settings only show implemented account integrations', () => {
  const source = read('src/renderer/views/Setting/components/SettingAccount.vue')
  assert.doesNotMatch(source, /account_placeholder/)
})
