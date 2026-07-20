const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const controlPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Toolbar', 'ControlBtns.vue')
const playDetailControlPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'PlayDetail', 'ControlBtnsRightHeader.vue')
const iconsPath = path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Icons.vue')
const controlSource = fs.readFileSync(controlPath, 'utf8')
const playDetailControlSource = fs.readFileSync(playDetailControlPath, 'utf8')
const iconsSource = fs.readFileSync(iconsPath, 'utf8')

test('RG-051: titlebar controls stay available and toggle fullscreen in both main and player-detail views', () => {
  assert.match(
    controlSource,
    /\$style\.fullscreen[\s\S]*\$t\(isFullscreen \? 'fullscreen_exit' : 'fullscreen'\)[\s\S]*@click="toggleFullscreen"[\s\S]*isFullscreen \? '#icon-window-restore-2' : '#icon-window-maximize-2'/m,
    'The green main-titlebar control should expose the current fullscreen action and matching square icon',
  )
  assert.match(
    controlSource,
    /import \{ closeWindow, minWindow, setFullScreen \} from '@renderer\/utils\/ipc'[\s\S]*setFullScreen\(!isFullscreen\.value\)\.then\(fullscreen => \{[\s\S]*isFullscreen\.value = fullscreen/m,
    'The main-titlebar control should toggle fullscreen through the shared IPC and synchronize renderer state',
  )
  assert.doesNotMatch(
    controlSource,
    /v-show="!isFullscreen"/m,
    'The three main-titlebar controls should remain visible after entering fullscreen',
  )
  assert.doesNotMatch(
    controlSource,
    /showHideWindowToggle|#icon-window-tray|\$t\('to_tray'\)/m,
    'The titlebar control should no longer trigger or describe the tray action',
  )
  assert.match(
    playDetailControlSource,
    /\$style\.min[\s\S]*\$style\.fullscreenToggle[\s\S]*\$style\.close/m,
    'Player detail should place the square fullscreen control between minimize and close',
  )
  assert.match(
    playDetailControlSource,
    /isFullscreen \? '#icon-window-restore-2' : '#icon-window-maximize-2'[\s\S]*setFullScreen\(!isFullscreen\.value\)/m,
    'Player detail should use the same stateful fullscreen toggle and icon pair',
  )
  assert.doesNotMatch(
    playDetailControlSource,
    /\.close, \.min[\s\S]*display: none|\.fullscreenToggle[\s\S]*display: none/m,
    'Player-detail window controls should not disappear in fullscreen',
  )
  assert.match(
    iconsSource,
    /id="icon-window-maximize-2"[\s\S]*id="icon-window-restore-2"/m,
    'The shared icon sprite should provide square maximize and restore states',
  )

  const translations = [
    ['zh-cn', '全屏'],
    ['zh-tw', '全螢幕'],
    ['en-us', 'Fullscreen'],
  ]
  for (const [locale, expected] of translations) {
    const messages = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'lang', `${locale}.json`), 'utf8'))
    assert.equal(messages.fullscreen, expected, `${locale} should label the new fullscreen control`)
  }
})
