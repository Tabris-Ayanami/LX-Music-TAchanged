const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const files = [
  path.join(rootDir, 'src', 'renderer', 'views', 'List', 'MusicList', 'useMusicDownload.js'),
  path.join(rootDir, 'src', 'renderer', 'views', 'List', 'MusicList', 'useMusicAdd.js'),
  path.join(rootDir, 'src', 'renderer', 'components', 'material', 'OnlineList', 'useMusicDownload.js'),
  path.join(rootDir, 'src', 'renderer', 'components', 'material', 'OnlineList', 'useMusicAdd.js'),
  path.join(rootDir, 'src', 'renderer', 'views', 'Download', 'useMusicAdd.js'),
]

test('RG-013: transient list popups are cancelled when a kept-alive view deactivates', () => {
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8')
    assert.match(
      source,
      /const close(?:Download|ListAdd)Modal = \(\) => \{/m,
      `${path.basename(filePath)} should expose a close helper for transient modal state`,
    )
    assert.match(
      source,
      /showTaskId\+\+/m,
      `${path.basename(filePath)} should invalidate queued nextTick opens when closing`,
    )
    assert.match(
      source,
      /onDeactivated\(close(?:Download|ListAdd)Modal\)/m,
      `${path.basename(filePath)} should close transient modals when the kept-alive view deactivates`,
    )
    assert.match(
      source,
      /onBeforeUnmount\(close(?:Download|ListAdd)Modal\)/m,
      `${path.basename(filePath)} should also close transient modals during unmount`,
    )
  }
})
