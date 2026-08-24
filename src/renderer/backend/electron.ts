import * as legacyIpc from '@renderer/utils/ipc'
import * as webPlayer from '@renderer/plugins/player'
import {
  BACKEND_INTERFACE_VERSION,
  createBackendJob,
  normalizeBackendError,
  throwIfAborted,
  type BackendApi,
  type BackendCapability,
  type LibraryQuery,
  type Page,
  type PlayerEventName,
} from './contracts'

const call = async<T>(executor: () => Promise<T> | T, signal?: AbortSignal): Promise<T> => {
  try {
    throwIfAborted(signal)
    const result = await executor()
    throwIfAborted(signal)
    return result
  } catch (error) {
    throw normalizeBackendError(error, signal?.aborted ? 'aborted' : 'internal')
  }
}

const capabilities = new Set<BackendCapability>([
  'player.web-audio',
  'library.legacy-electron',
  'metadata.legacy-electron',
  'metadata.native-shadow',
  'metadata.native',
  'artwork.legacy-electron',
  'artwork.native-variants',
  'download.legacy-electron',
  'download.native-ffmpeg',
  'download.native-http',
  'source.javascript',
  'settings.electron',
  'platform.electron',
])

const playerEvents: Record<PlayerEventName, (listener: () => void) => () => void> = {
  playing: webPlayer.onPlaying,
  pause: webPlayer.onPause,
  ended: webPlayer.onEnded,
  error: webPlayer.onError,
  loadeddata: webPlayer.onLoadeddata,
  loadstart: webPlayer.onLoadstart,
  canplay: webPlayer.onCanplay,
  emptied: webPlayer.onEmptied,
  timeupdate: webPlayer.onTimeupdate,
  durationchange: webPlayer.onDurationchange,
  waiting: webPlayer.onWaiting,
  visibilitychange: webPlayer.onVisibilityChange,
}

const queryPage = <T>(items: T[], query: LibraryQuery): Page<T> => {
  const offset = Math.max(0, query.offset)
  const limit = Math.max(1, query.limit)
  const pageItems = items.slice(offset, offset + limit)
  return {
    items: pageItems,
    offset,
    total: items.length,
    nextOffset: offset + pageItems.length < items.length ? offset + pageItems.length : null,
  }
}

export class ElectronBackendAdapter implements BackendApi {
  readonly descriptor = {
    interfaceVersion: BACKEND_INTERFACE_VERSION,
    implementation: 'electron' as const,
    implementationVersion: 'stage0',
    capabilities,
  }

  readonly player: BackendApi['player'] = {
    initialize: webPlayer.createAudio,
    load: ({ source, transition }) => { webPlayer.setResource(source, transition) },
    prepare: ({ source }) => webPlayer.prepareNext(source),
    startPreparedTransition: options => webPlayer.startPreparedTransition(options?.overlapSec),
    cancelPrepared: reason => webPlayer.cancelPrepared(reason),
    getTransitionTelemetry: webPlayer.getTransitionTelemetry,
    play: webPlayer.setPlay,
    pause: webPlayer.setPause,
    stop: webPlayer.setStop,
    next: async(automatic) => call(async() => (await import('@renderer/core/player')).playNext(automatic)),
    previous: async(automatic) => call(async() => (await import('@renderer/core/player')).playPrev(automatic)),
    isEmpty: webPlayer.isEmpty,
    setLoop: webPlayer.setLoopPlay,
    getPosition: webPlayer.getCurrentTime,
    getDuration: webPlayer.getDuration,
    getPlaybackRate: webPlayer.getPlaybackRate,
    getErrorCode: webPlayer.getErrorCode,
    seek: webPlayer.setCurrentTime,
    setVolume: webPlayer.setVolume,
    setMuted: webPlayer.setMute,
    setPlaybackRate: webPlayer.setPlaybackRate,
    setPreservesPitch: webPlayer.setPreservesPitch,
    setOutputDevice: async deviceId => call(() => webPlayer.setMediaDeviceId(deviceId)),
    setPitch: webPlayer.setPitchShifter,
    on: (event, listener) => playerEvents[event](listener),
    publishShellStatus: legacyIpc.sendPlayerStatus,
    onShellAction: listener => legacyIpc.onPlayerAction(({ params }) => { listener(params) }),
    savePlaybackState: legacyIpc.savePlayInfo,
  }

  readonly library: BackendApi['library'] = {
    getOverview: async() => {
      return call(async() => {
        const [library, list] = await Promise.all([
          import('@renderer/utils/localMusic'),
          import('@renderer/store/list/action'),
        ])
        const listInfo = await library.ensureLocalMusicList()
        const tracks = (await list.getListMusics(listInfo.id)).filter((track): track is LX.Music.MusicInfoLocal => track.source == 'local')
        library.setCachedLocalTracks(tracks)
        return {
          listId: listInfo.id,
          folders: library.getLocalMusicLibraryFolders(),
          tracks,
          albumCount: library.buildLocalAlbumGroups(tracks).length,
          artistCount: library.buildLocalArtistGroups(tracks).length,
        }
      })
    },
    queryLocalTracks: async(query, signal) => {
      throwIfAborted(signal)
      const overview = await this.library.getOverview()
      throwIfAborted(signal)
      const text = query.text?.trim().toLocaleLowerCase()
      const items = text
        ? overview.tracks.filter(track => `${track.name}\n${track.singer}\n${track.meta.albumName}`.toLocaleLowerCase().includes(text))
        : overview.tracks
      return queryPage(items, query)
    },
    registerFolders: async(folders) => call(async() => (await import('@renderer/utils/localMusic')).addLocalMusicLibraryFolders(folders)),
    unregisterFolder: async(folder) => call(async() => (await import('@renderer/utils/localMusic')).removeLocalMusicLibraryFolder(folder)),
    startRescan: () => createBackendJob('library-scan', async(signal, report) => {
      throwIfAborted(signal)
      report({ completed: 0, total: null, message: 'Scanning local music library' })
      const result = await call(async() => (await import('@renderer/utils/localMusic')).rescanLocalMusicLibrary(), signal)
      throwIfAborted(signal)
      report({ completed: 1, total: 1, message: 'Local music library scan complete' })
      return result
    }),
    removeFolderTracks: async(folder) => call(async() => { await (await import('@renderer/utils/localMusic')).removeLocalMusicLibraryFolderTracks(folder) }),
  }

  readonly metadata: BackendApi['metadata'] = {
    read: async(filePath, signal) => call(() => legacyIpc.readLocalMetadata(filePath), signal),
    write: async(request, signal) => call(() => legacyIpc.writeLocalMetadata(request), signal),
    readEmbeddedLyrics: async(filePath, signal) => call(() => legacyIpc.readLocalEmbeddedLyrics(filePath), signal),
    writeEmbeddedLyrics: async(request, signal) => call(() => legacyIpc.writeLocalEmbeddedLyrics(request), signal),
  }

  readonly artwork: BackendApi['artwork'] = {
    readLocalFile: async(filePath, signal) => call(() => legacyIpc.readLocalCoverFile(filePath), signal),
    getLocalTrackArtwork: async(request, signal) => call(async() => {
      if (window.lxData.appSetting['backend.artwork'] == 'native') {
        try { return await legacyIpc.getLocalArtworkVariant(request) } catch {}
      }
      const value = await window.lx.worker.main.getMusicFilePic(request.filePath)
      if (!value) return null
      const url = /^(?:https?:|data:|blob:|file:)/i.test(value) ? value : `file:///${value.replaceAll('\\', '/')}`
      return { id: request.filePath, url, mimeType: '', width: request.size, height: request.size, byteLength: 0, sourceFingerprint: 'legacy' }
    }, signal),
    getExternalArtworkPreview: async(request, signal) => call(async() => {
      if (window.lxData.appSetting['backend.artwork'] == 'native') {
        try {
          const value = await legacyIpc.getLocalArtworkVariant({ filePath: request.mediaFilePath, externalArtworkPath: request.artworkFilePath, size: request.size })
          if (value) return value
        } catch {}
      }
      const url = await legacyIpc.readLocalCoverFile(request.artworkFilePath)
      return { id: request.artworkFilePath, url, mimeType: '', width: request.size, height: request.size, byteLength: 0, sourceFingerprint: 'legacy' }
    }, signal),
    invalidate: async(filePath, signal) => call(() => legacyIpc.invalidateLocalArtwork(filePath), signal),
  }

  readonly download: BackendApi['download'] = {
    listPersistedTasks: async() => call(legacyIpc.downloadTasksGet),
    createPersistedTasks: async(list, location) => call(() => legacyIpc.downloadTasksCreate(list, location)),
    updatePersistedTasks: async list => call(() => legacyIpc.downloadTasksUpdate(list)),
    removePersistedTasks: async ids => call(() => legacyIpc.downloadTasksRemove(ids)),
    clearPersistedTasks: async() => call(legacyIpc.downloadListClear),
    convertAudio: async(request, signal) => call(() => legacyIpc.convertDownloadedAudio(request), signal),
    startNativeTask: async(request, signal) => call(() => legacyIpc.startNativeDownloadTask(request), signal),
    pauseNativeTask: async(taskId, signal) => call(() => legacyIpc.pauseNativeDownloadTask(taskId), signal),
    removeNativeTask: async(taskId, signal) => call(() => legacyIpc.removeNativeDownloadTask(taskId), signal),
    updateNativeTaskUrl: async(taskId, url, signal) => call(() => legacyIpc.updateNativeDownloadTaskUrl({ taskId, url }), signal),
    onNativeTaskAction: listener => legacyIpc.onNativeDownloadAction(({ params }) => { listener(params) }),
  }

  readonly source: BackendApi['source'] = {
    searchBilibili: async params => call(() => legacyIpc.biliSearch(params)),
    getBilibiliMusicUrl: async(track, quality) => call(() => legacyIpc.getBiliMusicUrl(track, quality)),
    getBilibiliVideoUrl: async track => call(() => legacyIpc.getBiliVideoUrl(track)),
    getBilibiliArtwork: async track => call(() => legacyIpc.getBiliPic(track)),
    getBilibiliQualities: async track => call(() => legacyIpc.getBiliMusicQualitys(track)),
    getBilibiliLyrics: async track => call(() => legacyIpc.getBiliLyric(track)),
    getBilibiliLyricSource: async request => call(() => legacyIpc.getBiliLyricSource(request)),
    getBilibiliLyricCandidates: async request => call(() => legacyIpc.getBiliLyricSourceCandidates(request)),
    getBilibiliComments: async request => call(() => legacyIpc.getBiliComment(request)),
    getBilibiliPlaylist: async request => call(() => legacyIpc.getBiliSongListDetail(request)),
    getUserSources: async() => call(legacyIpc.getUserApiList),
    selectUserSource: async source => call(() => legacyIpc.setUserApi(source)),
    requestUserSource: async request => call(() => legacyIpc.sendUserApiRequest(request)),
    cancelUserSourceRequest: legacyIpc.userApiRequestCancel,
  }

  readonly settings: BackendApi['settings'] = {
    get: async() => call(legacyIpc.getSetting),
    update: async patch => call(() => legacyIpc.updateSetting(patch)),
    onChanged: listener => legacyIpc.onSettingChanged(({ params }) => { listener(params) }),
  }

  readonly platform: BackendApi['platform'] = {
    quit: legacyIpc.quitApp,
    closeWindow: legacyIpc.closeWindow,
    minimizeWindow: legacyIpc.minWindow,
    maximizeWindow: legacyIpc.maxWindow,
    focusWindow: legacyIpc.focusWindow,
    setFullscreen: async enabled => call(() => legacyIpc.setFullScreen(enabled)),
    setWindowSize: legacyIpc.setWindowSize,
    setPowerSaveBlocker: legacyIpc.setPowerSaveBlocker,
    select: async request => call(() => legacyIpc.showSelectDialog(request)),
    revealInFileManager: legacyIpc.openDirInExplorer,
    openDevTools: legacyIpc.openDevTools,
  }
}

export const electronBackend = new ElectronBackendAdapter()
