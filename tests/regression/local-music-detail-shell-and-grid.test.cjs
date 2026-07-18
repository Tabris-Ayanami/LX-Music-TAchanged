const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const localDetailPath = path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'Detail.vue')
const localIndexPath = path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'index.vue')
const settingIndexPath = path.join(rootDir, 'src', 'renderer', 'views', 'Setting', 'index.vue')
const settingAppearancePath = path.join(rootDir, 'src', 'renderer', 'views', 'Setting', 'components', 'SettingAppearance.vue')
const settingLocalLibraryPath = path.join(rootDir, 'src', 'renderer', 'views', 'Setting', 'components', 'SettingLocalMusicLibrary.vue')
const defaultSettingPath = path.join(rootDir, 'src', 'common', 'defaultSetting.ts')
const migrateSettingPath = path.join(rootDir, 'src', 'common', 'utils', 'migrateSetting.ts')
const localMusicUtilsPath = path.join(rootDir, 'src', 'renderer', 'utils', 'localMusic.ts')
const spatialCanvasPath = path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'spatialCanvas.ts')
const localDetailSource = fs.readFileSync(localDetailPath, 'utf8')
const localIndexSource = fs.readFileSync(localIndexPath, 'utf8')
const settingIndexSource = fs.readFileSync(settingIndexPath, 'utf8')
const settingAppearanceSource = fs.readFileSync(settingAppearancePath, 'utf8')
const settingLocalLibrarySource = fs.readFileSync(settingLocalLibraryPath, 'utf8')
const defaultSettingSource = fs.readFileSync(defaultSettingPath, 'utf8')
const migrateSettingSource = fs.readFileSync(migrateSettingPath, 'utf8')
const localMusicUtilsSource = fs.readFileSync(localMusicUtilsPath, 'utf8')
const spatialCanvasSource = fs.readFileSync(spatialCanvasPath, 'utf8')

test('RG-031: local album and artist pages share the artwork header while keeping readable light lists', () => {
  assert.match(
    localDetailSource,
    /<div :class="\$style\.coverGlow" \/>/m,
    'Local detail pages should keep cover blur only in the header shell',
  )
  assert.match(
    localDetailSource,
    /background: var\(--color-content-background\);/m,
    'Local detail lists should keep the app light content background for readability',
  )
  assert.match(
    localDetailSource,
    /viewBox="0 0 1024 1024"[\s\S]*xlink:href="#icon-play"/m,
    'Local detail play action should use the same icon-only play button as online song lists',
  )
  assert.match(
    localIndexSource,
    /\.waterfallGrid \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/m,
    'The local artist wall should render five columns on desktop-sized layouts',
  )
  assert.doesNotMatch(
    localIndexSource,
    /@media \(max-width: 1600px\)[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/m,
    'The local album wall should not drop to four columns at the common desktop width',
  )
  assert.doesNotMatch(
    localIndexSource,
    /headerRow|播放全部|导入文件夹|导入文件/m,
    'The local library browsing page should not keep the old inline management header',
  )
  const searchRowBlock = localIndexSource.match(/\.searchRow \{[\s\S]*?\n\}/m)
  assert.ok(searchRowBlock, 'The local library page should keep a search row block')
  assert.doesNotMatch(searchRowBlock[0], /position: absolute;/m, 'The local library search row should participate in layout instead of covering album cards')
  assert.match(
    localIndexSource,
    /\.page \{[\s\S]*padding: 10px;[\s\S]*box-sizing: border-box;/m,
    'The local library page should not carry a page-specific toolbar offset',
  )
})

test('RG-041: local library management lives in settings', () => {
  assert.match(
    settingIndexSource,
    /import SettingLocalMusicLibrary from '\.\/components\/SettingLocalMusicLibrary\.vue'[\s\S]*SettingLocalMusicLibrary[\s\S]*\{ id: 'SettingLocalMusicLibrary', title: '本地音乐库' \}/m,
    'Settings should expose a dedicated local music library section',
  )
  assert.match(
    settingLocalLibrarySource,
    /歌曲总数[\s\S]*添加文件夹[\s\S]*重新扫描[\s\S]*添加的文件夹/m,
    'The local music library setting should show stats, folders, and scan actions',
  )
  assert.match(
    settingLocalLibrarySource,
    /showSelectDialog\(\{[\s\S]*properties: \['openDirectory', 'multiSelections'\][\s\S]*addLocalMusicLibraryFolders\(filePaths\)[\s\S]*await handleRescan\(\)/m,
    'Adding folders from settings should register folders and rescan the library',
  )
  assert.match(
    localMusicUtilsSource,
    /export const rescanLocalMusicLibrary = async\(\) => \{[\s\S]*getLocalMusicLibraryFolders\(\)[\s\S]*collectLocalMusicFilesFromFolders\(folders\)[\s\S]*overwriteListMusics/m,
    'Local library rescan should rebuild the local music list from the registered folders',
  )
  assert.match(
    localMusicUtilsSource,
    /export const removeLocalMusicLibraryFolderTracks = async\(folderPath: string\) => \{[\s\S]*!isFileUnderFolder\(track\.meta\.filePath, folderPath\)[\s\S]*overwriteListMusics/m,
    'Removing a registered folder should remove that folder’s tracks from the local music list',
  )
})

test('RG-049: local albums can use the persisted hierarchical planet view', () => {
  assert.match(
    settingIndexSource,
    /import SettingAppearance from '\.\/components\/SettingAppearance\.vue'[\s\S]*SettingAppearance[\s\S]*\{ id: 'SettingAppearance', title: '外观设置' \}/m,
    'Settings should expose a dedicated appearance section',
  )
  assert.match(
    settingAppearanceSource,
    /SettingBasic\(:appearance-only="true"\)[\s\S]*专辑页面视图[\s\S]*localMusic\.albumViewStyle[\s\S]*歌手页面视图[\s\S]*localMusic\.artistViewStyle/m,
    'Appearance settings should expose independent album and artist view controls',
  )
  assert.match(
    settingAppearanceSource,
    /const albumViewStyles[\s\S]*id: 'waterfall'[\s\S]*id: 'carousel'[\s\S]*id: 'planet'[\s\S]*const artistViewStyles[\s\S]*id: 'waterfall'[\s\S]*id: 'carousel'[\s\S]*id: 'planet'/m,
    'Album and artist settings should both offer waterfall, carousel, and planet views',
  )
  assert.match(
    defaultSettingSource,
    /'localMusic\.albumViewStyle': 'carousel'[\s\S]*'localMusic\.artistViewStyle': 'waterfall'/m,
    'Album and artist pages should preserve their previous default presentation',
  )
  assert.match(
    migrateSettingSource,
    /localMusic\.albumViewStyle[\s\S]*localMusic\.viewStyle[\s\S]*delete setting\['localMusic\.viewStyle'\]/m,
    'The previous shared local-music view preference should migrate to the album setting',
  )
  assert.match(
    localIndexSource,
    /albumViewStyle == 'waterfall'[\s\S]*albumViewStyle == 'carousel'[\s\S]*albumViewStyle == 'planet'[\s\S]*artistViewStyle == 'waterfall'[\s\S]*artistViewStyle == 'carousel'[\s\S]*artistViewStyle == 'planet'/m,
    'Both local album and artist pages should render all three configured view branches',
  )
  assert.match(
    localIndexSource,
    /carouselArtists[\s\S]*startSpatialDrag\('artists'[\s\S]*artistPlanetEntries[\s\S]*handlePlanetArtistClick/m,
    'Artist carousel and planet views should retain the existing artist-detail navigation',
  )
  assert.match(
    localIndexSource,
    /planetPortalSurface[\s\S]*songPlanetEntries[\s\S]*planetAlbumCluster[\s\S]*handlePlanetAlbumClick\(entry\.album, \$event\)/m,
    'The planet view should drill from album planets into song planets through the shared portal frame',
  )
  assert.match(
    localIndexSource,
    /event\.key != 'Escape'[\s\S]*closePlanetAlbum\(\)[\s\S]*@media \(prefers-reduced-motion: reduce\)/m,
    'Planet drill-down should support keyboard escape and reduced-motion preferences',
  )
  assert.match(
    localIndexSource,
    /@pointerdown="startSpatialDrag\('albums',[\s\S]*@pointermove="moveSpatialDrag\('albums',[\s\S]*@wheel\.prevent="handleSpatialWheel\('albums',[\s\S]*overflow: hidden;/m,
    'Album planets should live on a drag-driven two-dimensional canvas instead of a vertical scroll grid',
  )
  assert.match(
    localIndexSource,
    /@pointerdown="startSpatialDrag\('songs',[\s\S]*@pointermove="moveSpatialDrag\('songs',[\s\S]*@wheel\.prevent="handleSpatialWheel\('songs',[\s\S]*songPlanetEntries/m,
    'Song planets should use the same two-dimensional navigation model inside the album portal',
  )
  assert.doesNotMatch(
    localIndexSource,
    /handleSpatialKeydown|recenterSpatialCanvas|方向键移动|Home 回到中心|spatialHint/m,
    'Planet canvases should not capture application arrow shortcuts or keep the old operation hint',
  )
  assert.doesNotMatch(
    localIndexSource,
    /ALBUM_PLANET_SIZES|SONG_PLANET_SIZES|handlePlanetScroll|@scroll\.passive="handlePlanetScroll"/m,
    'Planet cards should not use random per-item sizes or vertical infinite-scroll loading',
  )
  assert.match(
    spatialCanvasSource,
    /buildSpatialHexLayout[\s\S]*resolveSpatialFrame[\s\S]*Math\.hypot\(x, y\)[\s\S]*inViewport/m,
    'The spatial canvas should use a centered hex layout with viewport-prioritized overscan',
  )
  assert.match(
    `${spatialCanvasSource}\n${localIndexSource}`,
    /buildSpatialIndex[\s\S]*querySpatialIndex[\s\S]*albumSpatialIndex[\s\S]*artistSpatialIndex[\s\S]*songSpatialIndex/m,
    'Spatial panning should query indexed viewport buckets instead of scanning the full library every frame',
  )
  assert.doesNotMatch(
    `${localIndexSource}\n${spatialCanvasSource}`,
    /clampSpatialPan|getSpatialPanBounds|clampPanForKind/m,
    'Planet panning should remain unbounded instead of clamping to the content extent',
  )
  assert.match(
    localIndexSource,
    /Math\.hypot\(deltaX, deltaY\) >= DRAG_THRESHOLD[\s\S]*setPointerCapture\(event\.pointerId\)/m,
    'Pointer capture should begin only after the drag threshold so a normal click can open an album',
  )
  assert.doesNotMatch(
    localIndexSource,
    /@dblclick="recenterSpatialCanvas/m,
    'Double-clicking the spatial canvas should not unexpectedly reset its position',
  )
  assert.match(
    localIndexSource,
    /MAX_MOUNTED_SPATIAL_PLANETS = 50[\s\S]*slice\(0, MAX_MOUNTED_SPATIAL_PLANETS\)[\s\S]*slice\(0, MAX_MOUNTED_SPATIAL_PLANETS\)/m,
    'The active album or song canvas should keep at most fifty mounted cards including overscan',
  )
  assert.match(
    localIndexSource,
    /selectedAlbum\.value && selectedAlbumDetailStyle\.value == 'planet'\) return \[\][\s\S]*Number\(b\.inViewport\) - Number\(a\.inViewport\)/m,
    'The hidden album canvas should release its cards while the active viewport prioritizes on-screen entries',
  )
  assert.match(
    localIndexSource,
    /loading="eager"/m,
    'Mounted spatial cards should request their artwork eagerly so the overscan buffer is ready before entering the viewport',
  )
  assert.match(
    localIndexSource,
    /albumPlanetPan\.value = pendingAlbumPan[\s\S]*getPendingSpatialPan[\s\S]*pendingAlbumPan \?\? albumPlanetPan\.value/m,
    'High-rate wheel updates should accumulate pending deltas without applying finite bounds',
  )
  assert.match(
    localIndexSource,
    /\.planetStage \{[\s\S]*?isolation: isolate;[\s\S]*?\n\}/m,
    'The album canvas should isolate its distance-based z-indexes below the expanded planet portal',
  )
  assert.match(
    localIndexSource,
    /edgeCueTop[\s\S]*edgeCueRight[\s\S]*edgeCueBottom[\s\S]*edgeCueLeft[\s\S]*--planet-surface-inset: 24px/m,
    'The expanded portal should use a wider frame with a subtle return cue at every edge',
  )
  assert.doesNotMatch(
    localIndexSource,
    /planetBackButton|返回专辑<\/span>/m,
    'The expanded portal should not keep the old top-left back button',
  )
  assert.match(
    localIndexSource,
    /planetOpenFrame = requestAnimationFrame\(\(\) => \{[\s\S]*planetOpenFrame = requestAnimationFrame/m,
    'Portal opening should commit its collapsed frame before expanding',
  )
  assert.doesNotMatch(
    localIndexSource,
    /returningAlbumKey|returningAlbumTimer|returningPlanet|planet-cover-drop|planet-arrive/m,
    'Closing the portal should restore the album canvas without a delayed cover rebound',
  )
})
