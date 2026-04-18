const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const useDataInitPath = path.join(rootDir, 'src', 'renderer', 'core', 'useApp', 'useDataInit.ts')
const searchMusicActionPath = path.join(rootDir, 'src', 'renderer', 'store', 'search', 'music', 'action.ts')
const searchSongListActionPath = path.join(rootDir, 'src', 'renderer', 'store', 'search', 'songlist', 'action.ts')

const useDataInitSource = fs.readFileSync(useDataInitPath, 'utf8')
const searchMusicActionSource = fs.readFileSync(searchMusicActionPath, 'utf8')
const searchSongListActionSource = fs.readFileSync(searchSongListActionPath, 'utf8')

test('RG-012: startup and search failures stay inside their own error states', () => {
  assert.match(
    useDataInitSource,
    /void music\.init\(\)\.catch\(err => \{[\s\S]*log\.error\(err\)/m,
    'Application startup should log music SDK init failures instead of letting them escape as unhandled rejections',
  )
  assert.match(
    searchMusicActionSource,
    /listInfo!\.noItemLabel = window\.i18n\.t\('list__load_failed'\)[\s\S]*return \[\]/m,
    'Music search failures should resolve to an empty list after updating the load-failed label',
  )
  assert.match(
    searchSongListActionSource,
    /listInfo\.noItemLabel = window\.i18n\.t\('list__load_failed'\)[\s\S]*return \[\]/m,
    'Song-list search failures should resolve to an empty list after updating the load-failed label',
  )
})
