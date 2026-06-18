const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const biliSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'utils', 'musicSdk', 'bili', 'index.js'), 'utf8')

test('RG-042: Bilibili song-list covers use the first track proxy image', () => {
  assert.match(
    biliSource,
    /const getTrackPic = async\(item\) => \{[\s\S]*getBiliPic\(\{[\s\S]*bvid: item\.bvid,[\s\S]*cid: item\.cid,[\s\S]*page: item\.page,[\s\S]*\}\)\.catch\(\(\) => item\.cover \|\| ''\)/m,
    'Bilibili song-list covers should resolve through the image proxy using track params',
  )
  assert.match(
    biliSource,
    /const list = await Promise\.all\(\[...map\.values\(\)]\.slice\(0, limit\)\.map\(async item => \(\{[\s\S]*img: await getTrackPic\(item\),/m,
    'Bilibili list cards should use the first track proxy image instead of raw cover URLs',
  )
  assert.match(
    biliSource,
    /const cover = await getTrackPic\(result\.list\[0\]\)[\s\S]*img: cover \|\| list\[0\]\?\.img \|\| result\.info\.img/m,
    'Bilibili detail headers should prefer the first track proxy image',
  )
})
