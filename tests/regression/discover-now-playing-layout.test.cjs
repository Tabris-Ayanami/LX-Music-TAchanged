'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'src/renderer/views/Discover/index.vue'), 'utf8')

test('Discover next-song expansion keeps artwork anchored on the right', () => {
  assert.match(source, /\.npTabNext\s+\.npCover\s*\{[\s\S]*?right:\s*0;/m)
  assert.match(source, /\.npTabNext\.expanded\s+\.npCover\s*\{[\s\S]*?right:\s*14px;/m)
  assert.match(source, /\.npTabNext\.expanded\s+\.npMeta\s*\{[\s\S]*?text-align:\s*right;/m)
  assert.match(source, /\.npTabNext\s+\.npPlay\s*\{[\s\S]*?left:\s*14px;/m)
})

test('Discover play-all centers its text without an invisible play-icon slot', () => {
  const label = source.match(/span\(:class="\$style\.playAllLabel"\)([\s\S]*?)\n\s*template\(v-if=/)?.[1] ?? ''
  const labelStyle = source.match(/\.playAllLabel\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.doesNotMatch(label, /svg|icon-play/)
  assert.match(label, /span \{\{ \$t\('discover__play_all'\) \}\}/)
  assert.doesNotMatch(labelStyle, /transform:\s*translateY/)
})
