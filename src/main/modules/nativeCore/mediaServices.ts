import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import {
  readLocalEmbeddedLyrics,
  readLocalCoverFile,
  readLocalMetadata,
  writeLocalMetadata,
} from '@main/modules/localMusicTools/metadata'
import { getNativeCoreSupervisor } from './supervisor'

interface NativeMetadata extends LX.LocalMusic.Metadata {
  embeddedLyrics: string
  artworkPresent: boolean
}

interface NativeArtworkResult {
  id: string
  cachePath: string
  mimeType: string
  width: number
  height: number
  byteLength: number
  sourceFingerprint: string
}

interface ShadowDifference {
  field: string
  legacy: unknown
  native: unknown
  classification: 'implementation_difference' | 'legacy_behavior' | 'format_specific_behavior' | 'actual_bug'
}

const compactMetadata = (value: NativeMetadata): LX.LocalMusic.Metadata => ({
  filePath: value.filePath,
  format: value.format,
  title: value.title,
  artists: value.artists,
  album: value.album,
  albumArtists: value.albumArtists,
  trackNumber: value.trackNumber,
  totalTracks: value.totalTracks,
  discNumber: value.discNumber,
  totalDiscs: value.totalDiscs,
  year: value.year,
  genre: value.genre,
  comment: value.comment,
  composer: value.composer,
  coverDataUrl: value.coverDataUrl,
  duration: value.duration,
  bitrate: value.bitrate,
  sampleRate: value.sampleRate,
})

const comparable = (value: unknown) => Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : value
const same = (field: string, left: unknown, right: unknown) => {
  if (field == 'duration') return Math.abs(Number(left) - Number(right)) <= 0.05
  if (field == 'bitrate') return Math.abs(Number(left) - Number(right)) <= 2
  return JSON.stringify(comparable(left)) == JSON.stringify(comparable(right))
}

const classify = (field: string, extension: string, legacy: unknown, native: unknown): ShadowDifference['classification'] => {
  if (['format', 'coverDataUrl', 'artworkPresent'].includes(field)) return 'legacy_behavior'
  if (field == 'duration' && Number(legacy) > 0 && Number(native) == 0) return 'actual_bug'
  if (field == 'duration' && Number(legacy) > 0 && Number(native) > 0 && Number.isInteger(Number(legacy))) return 'legacy_behavior'
  if (['totalTracks', 'totalDiscs'].includes(field) && Number(legacy) == 0 && Number(native) > 0) return 'legacy_behavior'
  if (['title', 'artists', 'album', 'albumArtists', 'genre', 'year', 'comment', 'composer', 'embeddedLyrics'].includes(field)) {
    const legacyHasValue = Array.isArray(legacy) ? legacy.length > 0 : legacy != null && legacy !== '' && legacy !== 0
    const nativeHasValue = Array.isArray(native) ? native.length > 0 : native != null && native !== '' && native !== 0
    if (legacyHasValue && !nativeHasValue) return 'actual_bug'
  }
  if (['wma', 'tta', 'aac', 'aiff', 'aif', 'oga', 'ogg', 'wv'].includes(extension)) return 'format_specific_behavior'
  return 'implementation_difference'
}

const createDiff = (filePath: string, legacy: LX.LocalMusic.Metadata, legacyLyrics: string, native: NativeMetadata) => {
  const extension = path.extname(filePath).slice(1).toLowerCase()
  const fields: Array<[string, unknown, unknown]> = [
    ['title', legacy.title, native.title],
    ['artists', legacy.artists, native.artists],
    ['album', legacy.album, native.album],
    ['albumArtists', legacy.albumArtists, native.albumArtists],
    ['genre', legacy.genre, native.genre],
    ['year', legacy.year, native.year],
    ['trackNumber', legacy.trackNumber, native.trackNumber],
    ['totalTracks', legacy.totalTracks, native.totalTracks],
    ['discNumber', legacy.discNumber, native.discNumber],
    ['totalDiscs', legacy.totalDiscs, native.totalDiscs],
    ['comment', legacy.comment, native.comment],
    ['composer', legacy.composer, native.composer],
    ['embeddedLyrics', legacyLyrics, native.embeddedLyrics],
    ['duration', legacy.duration, native.duration],
    ['bitrate', legacy.bitrate, native.bitrate],
    ['sampleRate', legacy.sampleRate, native.sampleRate],
    ['format', legacy.format, native.format],
    ['artworkPresent', !!legacy.coverDataUrl, native.artworkPresent],
  ]
  return fields.filter(([field, legacyValue, nativeValue]) => !same(field, legacyValue, nativeValue)).map(([field, legacyValue, nativeValue]) => ({
    field,
    legacy: field == 'coverDataUrl' ? !!legacyValue : legacyValue,
    native: field == 'coverDataUrl' ? !!nativeValue : nativeValue,
    classification: classify(field, extension, legacyValue, nativeValue),
  }))
}

const recordShadow = async(filePath: string, legacy: LX.LocalMusic.Metadata, nativeResult: Promise<NativeMetadata>) => {
  try {
    const [native, legacyLyrics] = await Promise.all([nativeResult, readLocalEmbeddedLyrics(filePath).catch(() => '')])
    const differences = createDiff(filePath, legacy, legacyLyrics, native)
    if (!differences.length) return
    const reportDir = path.join(global.lxDataPath, 'native-core')
    await mkdir(reportDir, { recursive: true })
    const fileId = createHash('sha256').update(filePath).digest('hex')
    await appendFile(path.join(reportDir, 'metadata-shadow-differences.jsonl'), `${JSON.stringify({
      timestamp: new Date().toISOString(), fileId, extension: path.extname(filePath).toLowerCase(), differences,
    })}\n`, 'utf8')
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'metadata_shadow_failed', component: 'native-core', message: error instanceof Error ? error.message : String(error) }))
  }
}

export const readMetadataWithBackend = async(filePath: string): Promise<LX.LocalMusic.Metadata> => {
  const mode = global.lx.appSetting['backend.metadata']
  if (mode == 'electron') return readLocalMetadata(filePath)
  const nativeResult = getNativeCoreSupervisor().call<NativeMetadata>('metadata.read', { filePath })
  // Shadow mode must attach a rejection handler before the legacy reader finishes;
  // otherwise a missing/crashed sidecar can briefly surface as an unhandled rejection.
  void nativeResult.catch(() => undefined)
  if (mode == 'native-shadow') {
    const legacy = await readLocalMetadata(filePath)
    void recordShadow(filePath, legacy, nativeResult)
    return legacy
  }
  try {
    const native = await nativeResult
    const artwork = native.artworkPresent ? await getArtworkVariant({ filePath, size: 512 }).catch(() => null) : null
    native.coverDataUrl = artwork?.url ?? ''
    return compactMetadata(native)
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'metadata_native_fallback', component: 'native-core', message: error instanceof Error ? error.message : String(error) }))
    return readLocalMetadata(filePath)
  }
}

export const writeMetadataWithBackend = async(request: LX.LocalMusic.MetadataWriteRequest): Promise<LX.LocalMusic.Metadata> => {
  if (global.lx.appSetting['backend.metadataWrite'] != 'native') {
    const legacyRequest = request.coverChanged && request.coverSourcePath
      ? { ...request, metadata: { ...request.metadata, coverDataUrl: await readLocalCoverFile(request.coverSourcePath) } }
      : request
    return writeLocalMetadata(legacyRequest)
  }
  // Once native write owns a request, do not issue a second legacy write after an error.
  const result = await getNativeCoreSupervisor().call<NativeMetadata>('metadata.write', request)
  return compactMetadata(result)
}

export const getArtworkVariant = async(request: LX.LocalMusic.ArtworkVariantRequest): Promise<LX.LocalMusic.ArtworkHandle | null> => {
  const result = await getNativeCoreSupervisor().call<NativeArtworkResult | null>('artwork.variant', request)
  if (!result) return null
  return {
    id: result.id,
    url: pathToFileURL(result.cachePath).href,
    mimeType: result.mimeType,
    width: result.width,
    height: result.height,
    byteLength: result.byteLength,
    sourceFingerprint: result.sourceFingerprint,
  }
}

interface NativeLibraryMetadata {
  filePath: string
  title: string
  artists: string[]
  album: string
  duration: number
}

/**
 * Read only the fields needed to build a local-library track. Unlike the
 * interactive metadata path this deliberately skips artwork materialization;
 * a library scan must not allocate a cover payload for every track.
 */
export const readMetadataForLibrary = async(filePath: string): Promise<LX.LocalMusic.Metadata> => {
  if (global.lx.appSetting['backend.metadata'] != 'native') return readLocalMetadata(filePath)
  try {
    const native = await getNativeCoreSupervisor().call<NativeMetadata>('metadata.read', { filePath })
    return compactMetadata({ ...native, coverDataUrl: '' })
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'library_metadata_native_fallback', component: 'native-core', message: error instanceof Error ? error.message : String(error) }))
    return readLocalMetadata(filePath)
  }
}

/**
 * Batch variant used by local-library scans. The native endpoint returns only
 * the five fields needed to build a row; malformed files are returned as null
 * and retain the legacy per-file fallback behavior.
 */
export const readMetadataForLibraryBatch = async(filePaths: string[]): Promise<Array<Pick<LX.LocalMusic.Metadata, 'title' | 'artists' | 'album' | 'duration'> | null>> => {
  if (!filePaths.length) return []
  if (global.lx.appSetting['backend.metadata'] != 'native') {
    return Promise.all(filePaths.map(filePath => readLocalMetadata(filePath).catch(() => null)))
  }
  try {
    const nativeResults = await getNativeCoreSupervisor().call<Array<NativeLibraryMetadata | null>>('metadata.read_library_batch', { filePaths })
    return Promise.all(filePaths.map(async(filePath, index) => {
      const native = nativeResults[index]
      if (native) return native
      const legacy = await readLocalMetadata(filePath).catch(() => null)
      return legacy ? { title: legacy.title, artists: legacy.artists, album: legacy.album, duration: legacy.duration } : null
    }))
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'library_metadata_batch_fallback', component: 'native-core', message: error instanceof Error ? error.message : String(error) }))
    return Promise.all(filePaths.map(filePath => readMetadataForLibrary(filePath).catch(() => null)))
  }
}

export const getLegacyArtworkPath = async(filePath: string): Promise<string> => {
  const parsed = path.parse(filePath)
  for (const extension of ['.jpg', '.png']) {
    const sidecar = path.join(parsed.dir, `${parsed.name}${extension}`)
    if (await stat(sidecar).then(info => info.isFile()).catch(() => false)) return sidecar
  }
  const metadata = await readLocalMetadata(filePath)
  const match = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/i.exec(metadata.coverDataUrl)
  if (!match) return ''
  const info = await stat(filePath)
  const extension = match[1].split('/')[1] || 'jpg'
  const cacheDir = path.join(global.lxDataPath, 'native-core', 'legacy-covers')
  const cachePath = path.join(cacheDir, `${createHash('sha1').update(`${filePath}:${info.mtimeMs}:${info.size}`).digest('hex')}.${extension}`)
  await mkdir(cacheDir, { recursive: true })
  if (!await stat(cachePath).then(() => true).catch(() => false)) await writeFile(cachePath, Buffer.from(match[2], 'base64'))
  return cachePath
}

export const invalidateArtwork = async(filePath: string) => {
  if (global.lx.appSetting['backend.artwork'] != 'native') return
  await getNativeCoreSupervisor().call('artwork.invalidate', { filePath })
}
