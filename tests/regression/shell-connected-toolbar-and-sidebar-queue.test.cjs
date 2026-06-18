const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const appSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'App.vue'), 'utf8')
const toolbarSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Toolbar', 'index.vue'), 'utf8')
const toolbarSearchSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Toolbar', 'SearchInput.vue'), 'utf8')
const searchInputSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'material', 'SearchInput.vue'), 'utf8')
const asideSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'index.vue'), 'utf8')
const navBarSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'NavBar.vue'), 'utf8')
const nowPlayingSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'layout', 'Aside', 'NowPlayingList.vue'), 'utf8')

test('RG-039: shell uses a connected glass toolbar and compact search field', () => {
  assert.match(
    appSource,
    /#toolbar \{[^}]*position: relative;[^}]*z-index: 5;[^}]*\}/m,
    'Toolbar should reserve its own row so pages are not covered by the glass layer',
  )
  assert.doesNotMatch(
    appSource,
    /#toolbar \{[^}]*position: absolute;[^}]*\}/m,
    'Toolbar should not be absolutely overlaid on top of every page',
  )
  assert.match(
    toolbarSource,
    /\.toolbar \{[\s\S]*min-height: 48px;[\s\S]*backdrop-filter: blur\(34px\) saturate\(170%\);/m,
    'Toolbar should be a shorter high-blur glass layer',
  )
  assert.match(
    toolbarSource,
    /\.searchSlot \{[\s\S]*flex: 0 1 360px;[\s\S]*max-width: 380px;/m,
    'Search should stay left aligned instead of spanning the whole toolbar',
  )
  assert.match(
    toolbarSearchSource,
    /<material-search-input[\s\S]* small /m,
    'Toolbar search should request the compact input variant',
  )
  assert.match(
    searchInputSource,
    /\.small \{[\s\S]*\.form \{[\s\S]*height: 38px;/m,
    'Compact input variant should reduce the field height',
  )
})

test('RG-040: sidebar local navigation and queue preview stay compact', () => {
  assert.match(
    asideSource,
    /<NavBar \/>\s*<NowPlayingList \/>/m,
    'Sidebar should render the playing queue preview below navigation',
  )
  assert.match(
    navBarSource,
    /\.menu \{[\s\S]*flex: 0 0 auto;/m,
    'Sidebar navigation should stop after My List so the playing preview starts directly below it',
  )
  assert.doesNotMatch(
    navBarSource,
    /label: '本地音乐'/m,
    'Local navigation should not keep the old aggregate 本地音乐 item',
  )
  assert.match(
    navBarSource,
    /key: 'localTracks'[\s\S]*label: '歌曲'[\s\S]*key: 'localAlbums'[\s\S]*label: '专辑'[\s\S]*key: 'localArtists'[\s\S]*label: '歌手'/m,
    'Local navigation should expose songs, albums, and artists as direct items',
  )
  assert.doesNotMatch(
    navBarSource,
    /title: 'LIST'/m,
    'My List should stay in the compact LOCAL section in the optimized sidebar',
  )
  assert.match(
    nowPlayingSource,
    /<p :class="\$style\.title" :aria-hidden="isSidebarCollapsed">LIST<\/p>/m,
    'Sidebar queue preview title should read List',
  )
  assert.match(
    nowPlayingSource,
    /v-for="item in queueList"/m,
    'Sidebar queue preview should render the full queue so earlier songs remain scrollable',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /queueList\.value\.slice\(startIndex\)/m,
    'Sidebar queue preview should not hide already played songs by slicing from the current index',
  )
  assert.match(
    nowPlayingSource,
    /:data-queue-index="item\.index"[\s\S]*querySelector\(`\[data-queue-index="\$\{currentIndex\}"\]`\)/m,
    'Sidebar queue preview should locate the active full-list row for scrolling',
  )
  assert.match(
    nowPlayingSource,
    /@wheel\.stop/m,
    'Sidebar queue preview should allow its own wheel scrolling without leaking into the nav scroll area',
  )
  assert.match(
    nowPlayingSource,
    /\.queue \{[\s\S]*flex: 1 1 auto;[\s\S]*display: flex;[\s\S]*flex-flow: column nowrap;/m,
    'Sidebar queue preview should stretch through the remaining sidebar height',
  )
  assert.match(
    nowPlayingSource,
    /\.list \{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*gap: 5px;[\s\S]*flex: 1 1 auto;[\s\S]*min-height: 0;[\s\S]*overflow-y: auto;/m,
    'Sidebar queue list should fill the stretched preview while staying independently scrollable with visible row spacing',
  )
  assert.match(
    nowPlayingSource,
    /\.active \{[\s\S]*&::before \{[\s\S]*opacity: 1;[\s\S]*transform: scale\(1\);/m,
    'The active queue row should keep the optimized pseudo-element highlight without changing layout',
  )
  assert.match(
    nowPlayingSource,
    /\.collapsed \{[\s\S]*\.list \{[\s\S]*gap: 7px;[\s\S]*\.row \{[\s\S]*width: var\(--sidebar-queue-rail\);[\s\S]*grid-template-columns: var\(--sidebar-queue-rail\) minmax\(0, 0\);[\s\S]*\.coverWrap \{[\s\S]*width: var\(--sidebar-queue-cover\);[\s\S]*height: var\(--sidebar-queue-cover\);/m,
    'Collapsed queue rows should keep an icon-only lane that matches the sidebar navigation rail',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /\.collapsed \{[\s\S]*max-height: 0;[\s\S]*opacity: 0;/m,
    'Collapsed sidebar should not hide the playing queue entirely',
  )
  assert.match(
    nowPlayingSource,
    /playList\(currentListId\.value, index\)[\s\S]*scrollToCurrentTop\('smooth'\)/m,
    'Clicking a preview row should play it and scroll the active full-list row into view',
  )
})
