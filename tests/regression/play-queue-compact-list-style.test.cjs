const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const queuePath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'components', 'PlayQueueBtn.vue')
const songListDetailPath = path.join(rootDir, 'src', 'renderer', 'views', 'songList', 'Detail', 'index.vue')
const queueSource = fs.readFileSync(queuePath, 'utf8')
const songListDetailSource = fs.readFileSync(songListDetailPath, 'utf8')

test('RG-035: play queue keeps a compact light list with artwork and item context menus', () => {
  assert.match(
    queueSource,
    /width: min\(388px, calc\(100vw - 28px\)\)/m,
    'The queue drawer should be narrower so it does not cover too much of the playlist page',
  )
  assert.match(
    queueSource,
    /\.detailDrawer \{[\s\S]*bottom: 86px;[\s\S]*height: min\(calc\(100vh - 128px\), 700px\);/m,
    'Detail-mode queue drawer should sit above the bottom-left queue button so the trigger remains usable for collapsing it',
  )
  assert.match(
    queueSource,
    /min-height: 62px/m,
    'Queue rows should stay compact enough to show more songs',
  )
  assert.match(
    queueSource,
    /<img v-if="item\.pic" :class="\$style\.cover" :src="item\.pic"/m,
    'Queue rows should render artwork thumbnails',
  )
  assert.match(
    queueSource,
    /const getMusicPic = musicInfo => \{[\s\S]*musicInfo\?\.pic \|\| musicInfo\?\.meta\?\.picUrl \|\| musicInfo\?\.img/m,
    'Queue thumbnails should fall back to the common metadata cover fields when pic is not prefilled',
  )
  assert.match(
    queueSource,
    /import \{ getPicPath \} from '@renderer\/core\/music'/m,
    'Queue should be able to resolve local embedded artwork on demand',
  )
  assert.match(
    queueSource,
    /const loadMissingLocalPics = \(\) => \{[\s\S]*item\.musicInfo\?\.source == 'local'[\s\S]*getPicPath\(\{[\s\S]*musicInfo: item\.musicInfo/m,
    'Queue should lazily load missing local cover art instead of only showing numeric placeholders',
  )
  assert.match(
    queueSource,
    /\.slice\(0, 80\)/m,
    'Lazy local cover loading should be bounded so opening a large queue does not parse every file at once',
  )
  assert.match(
    queueSource,
    /activeItem[\s\S]*playBadge[\s\S]*display: inline-flex/m,
    'The active queue row should indicate playback through the cover play badge',
  )
  assert.doesNotMatch(
    queueSource,
    /box-shadow: inset 3px 0 0 var\(--color-primary\)|linear-gradient\(90deg, color-mix\(in srgb, var\(--color-primary\)/m,
    'The active queue row should not use a theme-color block treatment',
  )
  assert.match(
    queueSource,
    /@contextmenu\.prevent="handleShowItemMenu\(\$event, item\)"/m,
    'Queue rows should expose a right-click context menu',
  )
  assert.match(
    queueSource,
    /<base-menu v-model="isShowItemMenu"/m,
    'The queue item context menu should use the shared menu surface',
  )
})

test('RG-036: song-list artwork header fades into the readable light list', () => {
  assert.match(
    songListDetailSource,
    /<div :class="\$style\.songListHeader">[\s\S]*<\/div>\s*<div :class="\$style\.list">/m,
    'The readable list should attach directly to the artwork header without an extra layout band',
  )
  assert.doesNotMatch(
    songListDetailSource,
    /coverGlow|headerTransition/m,
    'The song-list page should use one coherent header background system instead of stacked transition layers',
  )
  assert.match(
    songListDetailSource,
    /\.songListHeader \{[\s\S]*box-sizing: border-box;[\s\S]*height: 268px;[\s\S]*padding: 28px 30px 0;[\s\S]*background: var\(--color-content-background\);[\s\S]*isolation: isolate;[\s\S]*&::before \{[\s\S]*background-image: var\(--song-list-cover\)[\s\S]*mask-image: linear-gradient\([\s\S]*transparent 100%[\s\S]*&::after \{[\s\S]*transparent 76%[\s\S]*mask-image: linear-gradient\([\s\S]*transparent 100%/m,
    'The artwork header should attach to the toolbar without a fixed top spacer',
  )
  assert.match(
    songListDetailSource,
    /\.compact \{[\s\S]*\.compactHeader \{[\s\S]*height: 72px;[\s\S]*opacity: 1;[\s\S]*pointer-events: auto;/m,
    'Collapsed song-list headers should attach to the toolbar without a fixed top spacer',
  )
  assert.doesNotMatch(
    songListDetailSource,
    /--song-list-toolbar-overlap|padding-top: var\(--song-list-toolbar-overlap\)|calc\((?:72|268)px \+ var\(--song-list-toolbar-overlap\)\)/m,
    'Song-list headers should not keep the old toolbar-overlap spacer',
  )
  assert.match(
    songListDetailSource,
    /\.compactHeader \{[\s\S]*background: var\(--color-content-background\);[\s\S]*&::before \{[\s\S]*background-image: var\(--song-list-cover\)[\s\S]*filter: blur\(28px\) saturate\(150%\);/m,
    'Collapsed song-list headers should keep an artwork-derived blurred background',
  )
  assert.match(
    songListDetailSource,
    /\.list \{[\s\S]*background: var\(--color-content-background\);[\s\S]*:global\(\.thead\) \{[\s\S]*background: var\(--color-content-background\);/m,
    'The actual song list should keep a clean readable background',
  )
  assert.match(
    songListDetailSource,
    /\.compact \{[\s\S]*\.songListHeader \{[\s\S]*height: 0;[\s\S]*\.list \{[\s\S]*background: var\(--color-content-background\);/m,
    'Collapsed song-list headers should stop the artwork transition from affecting the list',
  )
})
