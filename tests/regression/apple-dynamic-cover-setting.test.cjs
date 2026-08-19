'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('Apple dynamic artwork is enabled by default and controlled by one appearance switch', () => {
  const defaults = read('src/common/defaultSetting.ts')
  const types = read('src/common/types/app_setting.d.ts')
  const appearance = read('src/renderer/views/Setting/components/SettingAppearance.vue')

  assert.match(defaults, /'playDetail\.appleDynamicCover':\s*true/)
  assert.match(types, /'playDetail\.appleDynamicCover':\s*boolean/)
  assert.match(appearance, /base-switch[\s\S]*playDetail\.appleDynamicCover/m)
  assert.doesNotMatch(appearance, /updateSetting\(\{\s*'playDetail\.coverType'/m)
})

test('BaseSwitch exposes native switch semantics', () => {
  const source = read('src/renderer/components/base/Switch.vue')
  assert.match(source, /role="switch"/)
  assert.match(source, /:aria-checked="modelValue"/)
  assert.match(source, /emit\('update:modelValue', !props\.modelValue\)/)
  assert.match(source, /prefers-reduced-motion:\s*reduce/)
})
