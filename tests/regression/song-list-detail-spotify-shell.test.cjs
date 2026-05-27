const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const detailPath = path.join(rootDir, 'src', 'renderer', 'views', 'songList', 'Detail', 'index.vue')
const onlineListPath = path.join(rootDir, 'src', 'renderer', 'components', 'material', 'OnlineList', 'index.vue')
const detailSource = fs.readFileSync(detailPath, 'utf8')
const onlineListSource = fs.readFileSync(onlineListPath, 'utf8')

test('RG-030: online song-list detail keeps the Spotify-style header driven by artwork and scroll state', () => {
  assert.match(
    detailSource,
    /const extractSongListColors = async\(pic: string\): Promise<SongListThemeColors>/m,
    'Song-list detail should derive its header colors from the cover instead of using a static flat header',
  )
  assert.match(
    detailSource,
    /if \(isUnmounted \|\| requestId != themeRequestId\) return/m,
    'Async cover sampling should ignore stale results after navigation or unmount',
  )
  assert.match(
    detailSource,
    /<div :class="\$style\.compactHeader">[\s\S]*xlink:href="#icon-play"[\s\S]*xlink:href="#icon-back"[\s\S]*<\/div>/m,
    'The collapsed header should keep only icon actions for play and back',
  )
  assert.match(
    detailSource,
    /xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/m,
    'Inline SVG buttons should declare the xlink namespace so sprite icons render in Vue templates',
  )
  assert.match(
    detailSource,
    /viewBox="0 0 1024 1024"[\s\S]*xlink:href="#icon-play"/m,
    'The play icon should use the sprite coordinate system instead of a cropped 24x24 viewBox',
  )
  assert.match(
    detailSource,
    /viewBox="0 0 512 512"[\s\S]*xlink:href="#icon-back"/m,
    'The back icon should use the sprite coordinate system instead of a cropped 24x24 viewBox',
  )
  assert.match(
    detailSource,
    /viewBox="0 0 444 392"[\s\S]*xlink:href="#icon-love"/m,
    'The love icon should use its actual path bounds so it is not rendered tiny in the corner',
  )
  assert.match(
    detailSource,
    /@click\.stop\.prevent="handlePlay"/m,
    'The header play action should receive the click directly without leaking through outer list interactions',
  )
  assert.match(
    detailSource,
    /background: var\(--color-primary\);/m,
    'The play button should use the app theme color instead of a hard-coded Spotify green',
  )
  assert.doesNotMatch(
    detailSource,
    /rgba\(14, 15, 17,/m,
    'The online song-list page should not switch the app to a black Spotify-style surface',
  )
  assert.doesNotMatch(
    detailSource,
    /\{\{ \$t\('(list__play|list__collect|back)'\) \}\}/m,
    'The detail header action buttons should not render visible text labels',
  )
  assert.match(
    onlineListSource,
    /emits: \['show-menu', 'play-list', 'togglePage', 'scroll'\]/m,
    'MaterialOnlineList should forward virtualized-list scroll events so the detail header can collapse',
  )
})
