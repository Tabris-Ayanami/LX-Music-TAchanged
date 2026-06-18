const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const downloadUtilsSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'worker', 'download', 'utils.ts'), 'utf8')
const downloadModalSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'common', 'DownloadModal.vue'), 'utf8')

test('RG-043: Bilibili download support does not break the shared download worker', () => {
  assert.doesNotMatch(
    downloadUtilsSource,
    /(?:import\s+ffmpeg\s+from\s+['"]@ffmpeg-installer\/ffmpeg['"]|import\('@ffmpeg-installer\/ffmpeg'\))/m,
    'The shared download worker should not let webpack parse the ffmpeg installer package',
  )
  assert.match(
    downloadUtilsSource,
    /__non_webpack_require__\('@ffmpeg-installer\/ffmpeg'\)/m,
    'ffmpeg should be loaded through runtime require only when a conversion is actually needed',
  )
  assert.match(
    downloadModalSource,
    /bvid: this\.info\.meta\?\.bvid \|\| this\.info\.bvid \|\| this\.info\.meta\?\.songId \|\| this\.info\.songmid/m,
    'Bilibili download params should read bvid from the normalized music meta first',
  )
  assert.match(
    downloadModalSource,
    /cid: this\.info\.meta\?\.cid \|\| this\.info\.cid[\s\S]*page: this\.info\.meta\?\.page \|\| this\.info\.page/m,
    'Bilibili download params should read cid/page from the normalized music meta first',
  )
})
