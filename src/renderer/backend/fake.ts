import defaultSetting from '@renderer/defaultSetting'
import {
  BACKEND_INTERFACE_VERSION,
  BackendError,
  createBackendJob,
  throwIfAborted,
  type BackendApi,
  type BackendCapability,
  type LibraryQuery,
  type Page,
  type PlayerEventName,
} from './contracts'

export interface FakeBackendOptions {
  settings?: Partial<LX.AppSetting>
  tracks?: LX.Music.MusicInfoLocal[]
  folders?: string[]
  metadata?: Iterable<[string, LX.LocalMusic.Metadata]>
  artwork?: Iterable<[string, string]>
}

const page = <T>(items: T[], query: LibraryQuery): Page<T> => {
  const offset = Math.max(0, query.offset)
  const limit = Math.max(1, query.limit)
  const pageItems = items.slice(offset, offset + limit)
  return { items: pageItems, offset, total: items.length, nextOffset: offset + pageItems.length < items.length ? offset + pageItems.length : null }
}

export class FakeBackendAdapter implements BackendApi {
  readonly descriptor = {
    interfaceVersion: BACKEND_INTERFACE_VERSION,
    implementation: 'fake' as const,
    implementationVersion: 'stage0',
    capabilities: new Set<BackendCapability>(),
  }

  readonly calls: Array<{ service: keyof BackendApi, method: string, args: unknown[] }> = []
  private settingsValue: LX.AppSetting
  private readonly tracks: LX.Music.MusicInfoLocal[]
  private folders: string[]
  private readonly metadataValues: Map<string, LX.LocalMusic.Metadata>
  private readonly artworkValues: Map<string, string>
  private readonly playerListeners = new Map<PlayerEventName, Set<() => void>>()
  private readonly settingListeners = new Set<(patch: Partial<LX.AppSetting>) => void>()
  private downloadTasks: LX.Download.ListItem[] = []
  private position = 0
  private readonly duration = 0
  private playbackRate = 1
  private empty = true
  private playing = false
  private prepared = false

  constructor(options: FakeBackendOptions = {}) {
    this.settingsValue = options.settings ? { ...defaultSetting, ...options.settings } : { ...defaultSetting }
    this.tracks = [...(options.tracks ?? [])]
    this.folders = [...(options.folders ?? [])]
    this.metadataValues = new Map(options.metadata)
    this.artworkValues = new Map(options.artwork)
  }

  private record(service: keyof BackendApi, method: string, ...args: unknown[]) {
    this.calls.push({ service, method, args })
  }

  readonly player: BackendApi['player'] = {
    initialize: () => { this.record('player', 'initialize') },
    load: ({ source }) => { this.record('player', 'load', source); this.empty = !source; this.playing = false; this.prepared = false; this.position = 0 },
    prepare: async({ source }) => { this.record('player', 'prepare', source); this.prepared = !!source; return this.prepared },
    startPreparedTransition: () => { this.record('player', 'startPreparedTransition'); const started = this.prepared; if (started) { this.prepared = false; this.empty = false; this.playing = true } return started },
    cancelPrepared: reason => { this.record('player', 'cancelPrepared', reason); this.prepared = false },
    getTransitionTelemetry: () => ({ prepared: this.prepared, playing: this.playing, remainingSec: 0, rms: 0, silenceSec: 0 }),
    play: () => { this.record('player', 'play'); this.playing = true; this.emitPlayer('playing') },
    pause: () => { this.record('player', 'pause'); this.playing = false; this.emitPlayer('pause') },
    stop: () => { this.record('player', 'stop'); this.playing = false; this.empty = true; this.prepared = false; this.position = 0; this.emitPlayer('emptied') },
    next: async(automatic) => { this.record('player', 'next', automatic) },
    previous: async(automatic) => { this.record('player', 'previous', automatic) },
    isEmpty: () => this.empty,
    setLoop: enabled => { this.record('player', 'setLoop', enabled) },
    getPosition: () => this.position,
    getDuration: () => this.duration,
    getPlaybackRate: () => this.playbackRate,
    getErrorCode: () => undefined,
    seek: seconds => { this.record('player', 'seek', seconds); this.position = seconds; this.emitPlayer('timeupdate') },
    setVolume: volume => { this.record('player', 'setVolume', volume) },
    setMuted: muted => { this.record('player', 'setMuted', muted) },
    setPlaybackRate: rate => { this.record('player', 'setPlaybackRate', rate); this.playbackRate = rate },
    setPreservesPitch: enabled => { this.record('player', 'setPreservesPitch', enabled) },
    setOutputDevice: async deviceId => { this.record('player', 'setOutputDevice', deviceId) },
    setPitch: semitones => { this.record('player', 'setPitch', semitones) },
    on: (event, listener) => {
      let listeners = this.playerListeners.get(event)
      if (!listeners) this.playerListeners.set(event, listeners = new Set())
      listeners.add(listener)
      return () => { listeners?.delete(listener) }
    },
    publishShellStatus: status => { this.record('player', 'publishShellStatus', status) },
    onShellAction: () => () => {},
    savePlaybackState: state => { this.record('player', 'savePlaybackState', state) },
  }

  readonly library: BackendApi['library'] = {
    getOverview: async() => ({
      listId: 'fake-local-library',
      folders: [...this.folders],
      tracks: [...this.tracks],
      albumCount: new Set(this.tracks.map(track => track.meta.albumName)).size,
      artistCount: new Set(this.tracks.map(track => track.singer)).size,
    }),
    queryLocalTracks: async(query, signal) => {
      throwIfAborted(signal)
      const text = query.text?.trim().toLocaleLowerCase()
      const items = text ? this.tracks.filter(track => `${track.name}\n${track.singer}\n${track.meta.albumName}`.toLocaleLowerCase().includes(text)) : this.tracks
      return page(items, query)
    },
    registerFolders: async folders => (this.folders = Array.from(new Set([...this.folders, ...folders]))),
    unregisterFolder: async folder => (this.folders = this.folders.filter(item => item != folder)),
    startRescan: () => createBackendJob('library-scan', async(signal, report) => {
      throwIfAborted(signal)
      report({ completed: 0, total: this.tracks.length })
      await Promise.resolve()
      throwIfAborted(signal)
      report({ completed: this.tracks.length, total: this.tracks.length })
      return { folderCount: this.folders.length, scannedFileCount: this.tracks.length, totalCount: this.tracks.length }
    }),
    removeFolderTracks: async folder => { this.record('library', 'removeFolderTracks', folder) },
  }

  readonly metadata: BackendApi['metadata'] = {
    read: async(filePath, signal) => {
      throwIfAborted(signal)
      const value = this.metadataValues.get(filePath)
      if (!value) throw new BackendError('not_found', `No metadata for ${filePath}`)
      return structuredClone(value)
    },
    write: async(request, signal) => {
      throwIfAborted(signal)
      const previous = this.metadataValues.get(request.filePath)
      const value: LX.LocalMusic.Metadata = structuredClone({
        filePath: request.filePath,
        format: previous?.format ?? '',
        bitrate: previous?.bitrate ?? 0,
        sampleRate: previous?.sampleRate ?? 0,
        ...request.metadata,
      })
      this.metadataValues.set(request.filePath, value)
      return structuredClone(value)
    },
    readEmbeddedLyrics: async(filePath, signal) => { throwIfAborted(signal); return this.metadataValues.get(filePath)?.comment ?? '' },
    readLyrics: async(filePath, signal) => { throwIfAborted(signal); return null },
    writeEmbeddedLyrics: async(request, signal) => { throwIfAborted(signal); this.record('metadata', 'writeEmbeddedLyrics', request); return request.lyric },
  }

  readonly artwork: BackendApi['artwork'] = {
    readLocalFile: async(filePath, signal) => { throwIfAborted(signal); const value = this.artworkValues.get(filePath); if (!value) throw new BackendError('not_found', `No artwork for ${filePath}`); return value },
    getLocalTrackArtwork: async(request, signal) => {
      throwIfAborted(signal)
      const url = this.artworkValues.get(request.filePath)
      return url ? { id: request.filePath, url, mimeType: 'image/jpeg', width: request.size, height: request.size, byteLength: 0, sourceFingerprint: 'fake' } : null
    },
    getExternalArtworkPreview: async(request, signal) => {
      throwIfAborted(signal)
      const url = this.artworkValues.get(request.artworkFilePath)
      if (!url) throw new BackendError('not_found', `No artwork for ${request.artworkFilePath}`)
      return { id: request.artworkFilePath, url, mimeType: 'image/jpeg', width: request.size, height: request.size, byteLength: 0, sourceFingerprint: 'fake' }
    },
    invalidate: async(_filePath, signal) => { throwIfAborted(signal) },
  }

  readonly download: BackendApi['download'] = {
    listPersistedTasks: async() => structuredClone(this.downloadTasks),
    createPersistedTasks: async list => { this.downloadTasks.push(...structuredClone(list)) },
    updatePersistedTasks: async list => { for (const item of list) { const index = this.downloadTasks.findIndex(task => task.id == item.id); if (index < 0) this.downloadTasks.push(structuredClone(item)); else this.downloadTasks[index] = structuredClone(item) } },
    removePersistedTasks: async ids => { const idSet = new Set(ids); this.downloadTasks = this.downloadTasks.filter(task => !idSet.has(task.id)) },
    clearPersistedTasks: async() => { this.downloadTasks = [] },
    convertAudio: async() => {},
    resolveFilePath: async(musicInfo, savePath) => { this.record('download', 'resolveFilePath', musicInfo, savePath); return musicInfo.metadata.filePath },
    startNativeTask: async() => {},
    pauseNativeTask: async() => {},
    removeNativeTask: async() => {},
    updateNativeTaskUrl: async() => {},
    writeMetadata: async() => {},
    writeLyrics: async() => {},
    onNativeTaskAction: () => () => {},
  }

  readonly source: BackendApi['source'] = {
    searchBilibili: async() => ({ list: [], total: 0 }) as unknown as LX.Bili.SearchResult,
    getBilibiliMusicUrl: async() => { throw new BackendError('not_found', 'No fake Bilibili URL') },
    getBilibiliVideoUrl: async() => { throw new BackendError('not_found', 'No fake Bilibili video URL') },
    getBilibiliArtwork: async() => '',
    getBilibiliQualities: async() => { throw new BackendError('not_found', 'No fake Bilibili qualities') },
    getBilibiliLyrics: async(): Promise<LX.Music.LyricInfo> => ({ lyric: '' }),
    getBilibiliLyricSource: async(): Promise<LX.Music.LyricInfo> => ({ lyric: '' }),
    getBilibiliLyricCandidates: async() => [],
    getBilibiliComments: async() => ({ list: [], total: 0 }) as unknown as LX.Bili.CommentInfo,
    getBilibiliPlaylist: async() => { throw new BackendError('not_found', 'No fake Bilibili playlist') },
    getUserSources: async() => [],
    selectUserSource: async source => { this.record('source', 'selectUserSource', source) },
    requestUserSource: async request => { this.record('source', 'requestUserSource', request); return null },
    cancelUserSourceRequest: request => { this.record('source', 'cancelUserSourceRequest', request) },
  }

  readonly settings: BackendApi['settings'] = {
    get: async() => ({ ...this.settingsValue }),
    update: async patch => {
      this.settingsValue = { ...this.settingsValue, ...patch }
      this.record('settings', 'update', patch)
      for (const listener of this.settingListeners) listener(patch)
    },
    onChanged: listener => { this.settingListeners.add(listener); return () => { this.settingListeners.delete(listener) } },
  }

  readonly platform: BackendApi['platform'] = {
    quit: () => { this.record('platform', 'quit') },
    closeWindow: () => { this.record('platform', 'closeWindow') },
    minimizeWindow: () => { this.record('platform', 'minimizeWindow') },
    maximizeWindow: () => { this.record('platform', 'maximizeWindow') },
    focusWindow: () => { this.record('platform', 'focusWindow') },
    setFullscreen: async enabled => { this.record('platform', 'setFullscreen', enabled); return enabled },
    setWindowSize: (width, height) => { this.record('platform', 'setWindowSize', width, height) },
    setPowerSaveBlocker: enabled => { this.record('platform', 'setPowerSaveBlocker', enabled) },
    select: async request => { this.record('platform', 'select', request); return { canceled: true, filePaths: [] } },
    revealInFileManager: path => { this.record('platform', 'revealInFileManager', path) },
    openDevTools: () => { this.record('platform', 'openDevTools') },
  }

  emitPlayer(event: PlayerEventName) {
    for (const listener of this.playerListeners.get(event) ?? []) listener()
  }
}

export const createFakeBackend = (options?: FakeBackendOptions) => new FakeBackendAdapter(options)
