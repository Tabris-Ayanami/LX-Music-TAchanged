const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const queueSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'components', 'PlayQueueBtn.vue'), 'utf8')
const volumeSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'common', 'VolumeBtn.vue'), 'utf8')
const lyricSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'LyricPlayer.vue'), 'utf8')
const detailSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'index.vue'), 'utf8')

test('RG-037: play queue actions stay editable and row removal appears only on hover', () => {
  assert.match(
    queueSource,
    /const canEditQueue = computed\(\(\) => !!currentListId\.value\)/m,
    'The play queue should allow clearing/removing from the active queue instead of only default/temp lists',
  )
  assert.match(
    queueSource,
    /\.itemRow \{[\s\S]*position: relative;[\s\S]*display: block;[\s\S]*&:hover \{[\s\S]*background:/m,
    'The row background should be drawn on the full row, including the remove-button lane',
  )
  assert.match(
    queueSource,
    /\.removeBtn \{[\s\S]*position: absolute;[\s\S]*opacity: 0;[\s\S]*\.itemRow:hover &,[\s\S]*\.itemRow:focus-within & \{[\s\S]*opacity: 1;/m,
    'The remove button should stay hidden until the row is hovered or focused',
  )
})

test('RG-038: floating-island volume control is a compact growing capsule', () => {
  assert.doesNotMatch(
    volumeSource,
    /material-popup-btn|player__volume_mute_label|Math\.trunc\(volume \* 100\)/m,
    'The floating-island volume control should not use the old popup, mute text, or percent label',
  )
  assert.match(
    volumeSource,
    /\.volumeShell \{[\s\S]*position: absolute;[\s\S]*bottom: 0;[\s\S]*height: var\(--volume-shell-size\);[\s\S]*z-index: 12;[\s\S]*&:hover,[\s\S]*&\.dragging \{[\s\S]*height: 142px;/m,
    'The volume shell should grow upward from the existing round button footprint without staying open after icon focus',
  )
  assert.doesNotMatch(
    volumeSource,
    /&:focus-within \{[\s\S]*height: 142px;/m,
    'Clicking the mute icon should not pin the volume capsule open through focus state',
  )
  assert.match(
    volumeSource,
    /\.btn \{[\s\S]*position: absolute;[\s\S]*bottom: 0;[\s\S]*svg \{[\s\S]*transition: opacity @transition-fast;/m,
    'The volume icon should stay anchored at the original round button position while only the capsule shell grows',
  )
  assert.match(
    volumeSource,
    /\.volumeShell > \.btn \{[\s\S]*height: var\(--volume-shell-size\);[\s\S]*max-height: var\(--volume-shell-size\);[\s\S]*bottom: 0;/m,
    'The volume button should override the floating-island utility button rule that would otherwise stretch nested buttons to 100% height',
  )
  assert.doesNotMatch(
    volumeSource,
    /&:hover svg \{[\s\S]*transform:/m,
    'Hovering the volume control should not move the speaker glyph',
  )
  assert.match(
    volumeSource,
    /const toggleMute = \(\) => \{[\s\S]*lastAudibleVolume[\s\S]*window\.app_event\.setVolumeIsMute\(false\)[\s\S]*window\.app_event\.setVolumeIsMute\(true\)/m,
    'Clicking the volume icon should toggle mute while preserving the last audible volume',
  )
})

test('RG-039: comment toggling does not animate or rescale lyrics', () => {
  assert.doesNotMatch(
    lyricSource,
    /isShowPlayComment\.value \? size \* 0\.82|watch\(\[isFullscreen, isShowPlayComment\]/m,
    'Opening comments should not rescale or re-scroll lyrics',
  )
  assert.match(
    detailSource,
    /\.comment \{[\s\S]*transition: opacity @transition-fast;/m,
    'The comment panel should avoid the old transform animation that made the lyric layout move',
  )
})
