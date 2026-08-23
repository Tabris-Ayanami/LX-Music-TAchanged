const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..', '..')
const source = fs.readFileSync(path.join(root, 'src', 'renderer', 'utils', 'compositions', 'useLyric.js'), 'utf8')

test('lyric drag listeners are absent from the mounted idle path', () => {
  const mountedBody = source.match(/onMounted\(\(\) => \{([\s\S]*?)\n {2}\}\)/m)?.[1] ?? ''
  assert.doesNotMatch(mountedBody, /document\.addEventListener/)
  assert.match(mountedBody, /initLrc\(lyric\.lines, null\)/)
})

test('lyric drag listeners attach on pointer start and detach on pointer end', () => {
  assert.match(source, /handleLyricMouseDown[\s\S]*addEventListener\('mousemove', handleMouseMsMove\)[\s\S]*addEventListener\('mouseup', handleMouseMsUp\)/m)
  assert.match(source, /handleLyricTouchStart[\s\S]*addEventListener\('touchmove', handleTouchMove\)[\s\S]*addEventListener\('touchend', handleMouseMsUp\)/m)
  for (const [event, handler] of [
    ['mousemove', 'handleMouseMsMove'],
    ['mouseup', 'handleMouseMsUp'],
    ['touchmove', 'handleTouchMove'],
    ['touchend', 'handleMouseMsUp'],
  ]) {
    assert.equal((source.match(new RegExp(`document\\.addEventListener\\('${event}', ${handler}\\)`, 'g')) ?? []).length, 1)
    assert.equal((source.match(new RegExp(`document\\.removeEventListener\\('${event}', ${handler}\\)`, 'g')) ?? []).length, 2)
  }
})
