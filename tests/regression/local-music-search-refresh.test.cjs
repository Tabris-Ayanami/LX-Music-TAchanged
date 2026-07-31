const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const localMusicSource = fs.readFileSync(
  path.join(rootDir, 'src', 'renderer', 'views', 'LocalMusic', 'index.vue'),
  'utf8',
)

test('RG-057: local search refreshes after library mutations without deep reactivity', () => {
  assert.match(
    localMusicSource,
    /const tracks = shallowRef<[^>]+>\(\[\]\)[\s\S]*const nextTracks = await getListMusics\(localListId\.value\)[\s\S]*tracks\.value = \[\.\.\.nextTracks\]/m,
    'The local page should keep shallow storage while replacing the array snapshot after a refresh',
  )
  assert.match(
    localMusicSource,
    /const handleListUpdate = \(ids: string\[\]\)[\s\S]*ids\.includes\(targetListId\)[\s\S]*refreshTracks\(\)/m,
    'Local-list change events should refresh the data used by the search index',
  )
  assert.match(
    localMusicSource,
    /onActivated\(\(\) => \{[\s\S]*activateListUpdateListener\(\)[\s\S]*refreshTracks\(\)[\s\S]*onDeactivated\(deactivateListUpdateListener\)/m,
    'A kept-alive local page should catch up on activation and avoid background list listeners while hidden',
  )
})
