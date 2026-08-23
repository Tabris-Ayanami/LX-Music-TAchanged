const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..', '..')
const volumeSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'components', 'common', 'VolumeBtn.vue'), 'utf8')
const sliderSource = fs.readFileSync(path.join(root, 'src', 'renderer', 'components', 'base', 'SliderBar.vue'), 'utf8')

test('volume slider installs document listeners only while dragging', () => {
  assert.match(volumeSource, /handleSliderDown[\s\S]*document\.addEventListener\('mousemove', handleMouseMove\)/m)
  assert.match(volumeSource, /handleSliderDown[\s\S]*document\.addEventListener\('mouseup', handleMouseUp\)/m)
  assert.doesNotMatch(volumeSource, /\n(document\.addEventListener\('mousemove', handleMouseMove\)|document\.addEventListener\('mouseup', handleMouseUp\))\n\s*\n onBeforeUnmount/m)
  assert.match(volumeSource, /handleMouseUp[\s\S]*document\.removeEventListener\('mousemove', handleMouseMove\)/m)
})

test('generic slider installs document listeners only while dragging', () => {
  assert.match(sliderSource, /handleSliderMsDown[\s\S]*document\.addEventListener\('mousemove', handleSliderMsMove\)/m)
  assert.match(sliderSource, /handleSliderMsDown[\s\S]*document\.addEventListener\('mouseup', handleSliderMsUp\)/m)
  assert.equal((sliderSource.match(/document\.addEventListener\('mousemove', handleSliderMsMove\)/g) ?? []).length, 1)
  assert.equal((sliderSource.match(/document\.addEventListener\('mouseup', handleSliderMsUp\)/g) ?? []).length, 1)
  assert.match(sliderSource, /handleSliderMsUp[\s\S]*document\.removeEventListener\('mousemove', handleSliderMsMove\)/m)
})
