const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const playDetailPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'index.vue')
const playDetailSource = fs.readFileSync(playDetailPath, 'utf8')

test('RG-027: play-detail blurred background keeps the full artwork visible on wide windows', () => {
  assert.match(
    playDetailSource,
    /const toCssUrl = value => `url\("\$\{String\(value\)\.replace\([^)]*\\\\\\\\[^)]*\)\.replace\([^)]*\\\\"[^)]*\)\}"\)`/m,
    'CSS background URLs should be escaped before being reused across multiple background layers',
  )
  assert.match(
    playDetailSource,
    /backgroundImage: picUrl \? `\$\{picUrl\}, \$\{picUrl\}` : 'none'/m,
    'The detail background should render the artwork twice so one layer can preserve the full cover while another fills the frame',
  )
  assert.match(
    playDetailSource,
    /backgroundSize: 'contain, cover'/m,
    'The first blurred background layer should use contain to avoid cropping dark-edged square covers into a black field',
  )
})
