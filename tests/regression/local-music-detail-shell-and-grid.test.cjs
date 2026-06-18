const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const localDetailPath = path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'Detail.vue')
const localIndexPath = path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'index.vue')
const settingIndexPath = path.join(rootDir, 'src', 'renderer', 'views', 'Setting', 'index.vue')
const settingLocalLibraryPath = path.join(rootDir, 'src', 'renderer', 'views', 'Setting', 'components', 'SettingLocalMusicLibrary.vue')
const localMusicUtilsPath = path.join(rootDir, 'src', 'renderer', 'utils', 'localMusic.ts')
const localDetailSource = fs.readFileSync(localDetailPath, 'utf8')
const localIndexSource = fs.readFileSync(localIndexPath, 'utf8')
const settingIndexSource = fs.readFileSync(settingIndexPath, 'utf8')
const settingLocalLibrarySource = fs.readFileSync(settingLocalLibraryPath, 'utf8')
const localMusicUtilsSource = fs.readFileSync(localMusicUtilsPath, 'utf8')

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
    /\.artistShell \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/m,
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
