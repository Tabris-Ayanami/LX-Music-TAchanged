import { createFakeBackend } from '../../src/renderer/backend/fake'
import { runBackendContractSuite } from './service-contract-suite'

const createTrack = (id: string, name: string): LX.Music.MusicInfoLocal => ({
  id,
  name,
  singer: 'Artist',
  source: 'local',
  interval: '03:00',
  meta: { albumName: 'Album', filePath: `C:\\Music\\${name}.flac`, ext: 'flac' },
}) as LX.Music.MusicInfoLocal

runBackendContractSuite('FakeBackendAdapter', () => {
  const metadata = { filePath: 'track.flac', title: 'Track', artists: [] } as unknown as LX.LocalMusic.Metadata
  return {
    backend: createFakeBackend({
      settings: { 'common.langId': 'en-us' } as LX.AppSetting,
      tracks: [createTrack('1', 'Alpha'), createTrack('2', 'Beta'), createTrack('3', 'Gamma')],
    }),
    trackIds: ['1', '2', '3'],
    filterText: 'beta',
    filteredTrackId: '2',
    missingMetadataPath: 'missing.flac',
    metadataWrite: { filePath: 'track.flac', metadata, coverChanged: false },
  }
})
