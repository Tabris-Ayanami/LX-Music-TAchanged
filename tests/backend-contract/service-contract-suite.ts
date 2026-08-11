import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BACKEND_INTERFACE_VERSION,
  BackendError,
  type BackendApi,
} from '../../src/renderer/backend/contracts'

export interface BackendContractFixture {
  backend: BackendApi
  trackIds: [string, string, string]
  filterText: string
  filteredTrackId: string
  missingMetadataPath: string
  metadataWrite: LX.LocalMusic.MetadataWriteRequest
  cleanup?: () => Promise<void> | void
}

export type BackendContractFixtureFactory = () => Promise<BackendContractFixture> | BackendContractFixture

const withFixture = async(factory: BackendContractFixtureFactory, testBody: (fixture: BackendContractFixture) => Promise<void> | void) => {
  const fixture = await factory()
  try {
    await testBody(fixture)
  } finally {
    await fixture.cleanup?.()
  }
}

/**
 * Registers the backend-independent contract suite. A future Electron or native
 * adapter only needs to provide a fixture; the assertions stay transport-free.
 */
export const runBackendContractSuite = (name: string, factory: BackendContractFixtureFactory) => {
  test(`${name}: descriptor exposes a versioned business API`, async() => {
    await withFixture(factory, ({ backend }) => {
      assert.equal(backend.descriptor.interfaceVersion, BACKEND_INTERFACE_VERSION)
      assert.ok(['electron', 'fake', 'native'].includes(backend.descriptor.implementation))
    })
  })

  test(`${name}: settings returns copies, publishes patches, and unsubscribes`, async() => {
    await withFixture(factory, async({ backend }) => {
      const initial = await backend.settings.get()
      const patches: Array<Partial<LX.AppSetting>> = []
      const unsubscribe = backend.settings.onChanged(patch => patches.push(patch))
      await backend.settings.update({ 'common.langId': 'zh-cn' })
      unsubscribe()
      await backend.settings.update({ 'common.langId': 'zh-tw' })
      assert.equal((await backend.settings.get())['common.langId'], 'zh-tw')
      assert.deepEqual(patches, [{ 'common.langId': 'zh-cn' }])
      await backend.settings.update({ 'common.langId': initial['common.langId'] })
    })
  })

  test(`${name}: library supports paging, filtering, cancellation, and jobs`, async() => {
    await withFixture(factory, async({ backend, trackIds, filterText, filteredTrackId }) => {
      const first = await backend.library.queryLocalTracks({ offset: 0, limit: 2 })
      assert.deepEqual(first.items.map(item => item.id), trackIds.slice(0, 2))
      assert.equal(first.total, 3)
      assert.equal(first.nextOffset, 2)
      const filtered = await backend.library.queryLocalTracks({ offset: 0, limit: 10, text: filterText })
      assert.deepEqual(filtered.items.map(item => item.id), [filteredTrackId])
      const controller = new AbortController()
      controller.abort()
      await assert.rejects(backend.library.queryLocalTracks({ offset: 0, limit: 1 }, controller.signal), (error: unknown) => error instanceof BackendError && error.code == 'aborted')

      const job = backend.library.startRescan()
      assert.match(job.jobId, /^library-scan:/)
      const progress: number[] = []
      job.onProgress(event => progress.push(event.completed))
      const result = await job.result
      assert.equal(result.totalCount, 3)
      assert.deepEqual(progress, [0, 3])
    })
  })

  test(`${name}: player controls stay behind the service and listeners clean up`, async() => {
    await withFixture(factory, ({ backend }) => {
      let updates = 0
      const unsubscribe = backend.player.on('timeupdate', () => { updates++ })
      backend.player.load({ source: 'file:///contract-track.flac' })
      backend.player.seek(42)
      unsubscribe()
      backend.player.seek(84)
      assert.equal(backend.player.getPosition(), 84)
      assert.equal(updates, 1)
      assert.equal(backend.player.isEmpty(), false)
    })
  })

  test(`${name}: metadata reports stable errors and writes through one boundary`, async() => {
    await withFixture(factory, async({ backend, missingMetadataPath, metadataWrite }) => {
      await assert.rejects(backend.metadata.read(missingMetadataPath), (error: unknown) => error instanceof BackendError && error.code == 'not_found')
      const result = await backend.metadata.write(metadataWrite)
      assert.equal(result.title, metadataWrite.metadata.title)
      assert.equal((await backend.metadata.read(metadataWrite.filePath)).title, metadataWrite.metadata.title)
    })
  })
}
