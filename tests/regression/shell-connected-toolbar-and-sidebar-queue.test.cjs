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
    /\.searchSlot \{[\s\S]*width: 100%;[\s\S]*max-width: 300px;/m,
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
    /\.title \{[\s\S]*margin: 0;[\s\S]*height: 14px;[\s\S]*min-height: 14px;[\s\S]*transition: opacity \.28s ease;/m,
    'The LIST title should fade out while keeping its reserved height so the queue below does not jump',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /\.collapsed\s*\{[\s\S]*?\.title\s*\{[^}]*height:/m,
    'Collapsed LIST title should not change height when it disappears',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /\.collapsed\s*\{[\s\S]*?\.title\s*\{[^}]*margin:/m,
    'Collapsed LIST title should not change margin when it disappears',
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
    /\.list \{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*gap: 7px;[\s\S]*flex: 1 1 auto;[\s\S]*min-height: 0;[\s\S]*margin: 6px -4px 0;[\s\S]*padding: 0 4px;[\s\S]*overflow-y: auto;/m,
    'Sidebar queue list should reserve side paint space while staying independently scrollable with visible row spacing',
  )
  assert.match(
    nowPlayingSource,
    /\.active \{[\s\S]*&::before \{[\s\S]*opacity: 1;[\s\S]*transform: scale\(1\);/m,
    'The active queue row should keep the optimized pseudo-element highlight without changing layout',
  )
  assert.match(
    nowPlayingSource,
    /--sidebar-queue-row-height: 48px;[\s\S]*\.row \{[\s\S]*height: var\(--sidebar-queue-row-height\);[\s\S]*min-height: var\(--sidebar-queue-row-height\);[\s\S]*flex: 0 0 var\(--sidebar-queue-row-height\);[\s\S]*\.collapsed \{[\s\S]*\.row \{[\s\S]*width: var\(--sidebar-queue-rail\);[\s\S]*height: var\(--sidebar-queue-row-height\);[\s\S]*min-height: var\(--sidebar-queue-row-height\);[\s\S]*flex-basis: var\(--sidebar-queue-row-height\);[\s\S]*grid-template-columns: var\(--sidebar-queue-rail\) minmax\(0, 0\);[\s\S]*\.coverWrap \{[\s\S]*width: var\(--sidebar-queue-cover\);[\s\S]*height: var\(--sidebar-queue-cover\);/m,
    'Collapsed queue rows should keep an icon-only lane that matches the sidebar navigation rail',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /\.row \{[^}]*gap var\(--sidebar-motion-duration\)/m,
    'Queue row gap should stay fixed instead of animating during sidebar expansion',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /\.coverWrap \{[^}]*height var\(--sidebar-motion-duration\)/m,
    'Queue cover height should stay fixed instead of stretching during sidebar expansion',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /\.coverWrap \{[^}]*width var\(--sidebar-motion-duration\)/m,
    'Queue cover width should stay fixed instead of resizing during sidebar expansion',
  )
  assert.match(
    nowPlayingSource,
    /const queuePillInset = 2[\s\S]*const blockInset = queuePillInset[\s\S]*const measuredHeight = Math\.max\(0, rowEl\.offsetHeight - blockInset \* 2\)[\s\S]*const targetWidth = Math\.max\(0, getSidebarContentTargetWidth\(listEl\) - inlineInset \* 2\)[\s\S]*const width = isSidebarCollapsed\.value \? Math\.min\(targetWidth, measuredHeight\) : targetWidth[\s\S]*const height = measuredHeight[\s\S]*x: rowEl\.offsetLeft \+ inlineInset,[\s\S]*y: rowEl\.offsetTop \+ blockInset,/m,
    'Collapsed queue active pill should keep a 44px square target with side paint room and only extend rightward',
  )
  assert.match(
    nowPlayingSource,
    /getCssPxNumber\(el, '--sidebar-width', isSidebarCollapsed\.value \? 80 : 196\)[\s\S]*getCssPxNumber\(el, '--sidebar-panel-x', 16\) \* 2/m,
    'Queue active pill should read the CSS target width instead of measuring the animated intermediate row width',
  )
  assert.match(
    nowPlayingSource,
    /\.queuePill\.tracking \{[\s\S]*transform var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*width var\(--sidebar-motion-duration\) var\(--sidebar-motion-curve\),[\s\S]*box-shadow 220ms ease;/m,
    'Tracking state should keep queue pill width animation during collapse as well as expansion',
  )
  assert.match(
    nowPlayingSource,
    /const trackQueuePillDuringLayoutMotion = \(\) => \{[\s\S]*queuePillTracking\.value = true[\s\S]*if \(queuePillTrackTimer\) clearTimeout\(queuePillTrackTimer\)[\s\S]*queuePillTrackTimer = setTimeout\(\(\) => \{[\s\S]*queuePillTracking\.value = false[\s\S]*measureCurrentQueuePill\(\)[\s\S]*\}, sidebarMotionMs \+ 80\)/m,
    'Queue pill should animate to one target and only re-measure after the sidebar motion ends',
  )
  assert.match(
    nowPlayingSource,
    /--sidebar-queue-rail: 48px;[\s\S]*--sidebar-queue-cover: 36px;[\s\S]*inset 0 0 0 2px color-mix/m,
    'Collapsed queue selection should be visibly larger and thicker than the cover thumbnail',
  )
  assert.doesNotMatch(
    nowPlayingSource,
    /\.queuePill(?:\.floating)? \{[\s\S]*\n\s+0 \d+px \d+px color-mix/m,
    'Queue selected pill should not render a bottom outer shadow',
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
