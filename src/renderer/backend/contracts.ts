export const BACKEND_INTERFACE_VERSION = '0.1.0' as const

export type StableId = string
export type JobId = StableId
export type ChangeCursor = string
export type Unsubscribe = () => void

export type BackendCapability =
  | 'player.web-audio'
  | 'library.legacy-electron'
  | 'metadata.legacy-electron'
  | 'artwork.legacy-electron'
  | 'download.legacy-electron'
  | 'source.javascript'
  | 'settings.electron'
  | 'platform.electron'

export type BackendErrorCode =
  | 'aborted'
  | 'backend_unavailable'
  | 'invalid_argument'
  | 'not_found'
  | 'not_supported'
  | 'permission_denied'
  | 'io_error'
  | 'conflict'
  | 'internal'

export class BackendError extends Error {
  readonly code: BackendErrorCode
  readonly details?: Readonly<Record<string, unknown>>

  constructor(code: BackendErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message)
    this.name = 'BackendError'
    this.code = code
    this.details = details
  }
}

const backendErrorCodes = new Set<BackendErrorCode>([
  'aborted',
  'backend_unavailable',
  'invalid_argument',
  'not_found',
  'not_supported',
  'permission_denied',
  'io_error',
  'conflict',
  'internal',
])

const legacyErrorCodeMap: Readonly<Record<string, BackendErrorCode>> = {
  ABORT_ERR: 'aborted',
  EACCES: 'permission_denied',
  EEXIST: 'conflict',
  EINVAL: 'invalid_argument',
  ENOENT: 'not_found',
  ENOTSUP: 'not_supported',
  EPERM: 'permission_denied',
  ERR_NOT_SUPPORTED: 'not_supported',
}

export const normalizeBackendError = (error: unknown, fallbackCode: BackendErrorCode = 'internal'): BackendError => {
  if (error instanceof BackendError) return error
  const legacyCode = typeof error == 'object' && error != null && 'code' in error && typeof error.code == 'string' ? error.code : undefined
  const code = legacyCode && backendErrorCodes.has(legacyCode as BackendErrorCode)
    ? legacyCode as BackendErrorCode
    : legacyCode ? legacyErrorCodeMap[legacyCode] ?? fallbackCode : fallbackCode
  const message = error instanceof Error ? error.message : String(error)
  return new BackendError(code, message, legacyCode ? { legacyCode } : undefined)
}

export interface PageRequest {
  offset: number
  limit: number
}

export interface Page<T> {
  items: T[]
  offset: number
  total: number
  nextOffset: number | null
}

export interface JobProgress<T = unknown> {
  jobId: JobId
  completed: number
  total: number | null
  message?: string
  data?: T
}

export interface BackendJob<T> {
  jobId: JobId
  result: Promise<T>
  cancel: () => void
  onProgress: (listener: (progress: JobProgress) => void) => Unsubscribe
}

let nextJobId = 0
export const createBackendJob = <T>(
  kind: string,
  executor: (signal: AbortSignal, report: (progress: Omit<JobProgress, 'jobId'>) => void) => Promise<T>,
): BackendJob<T> => {
  const jobId = `${kind}:${Date.now().toString(36)}:${(++nextJobId).toString(36)}`
  const controller = new AbortController()
  const listeners = new Set<(progress: JobProgress) => void>()
  const report = (progress: Omit<JobProgress, 'jobId'>) => {
    const event = { jobId, ...progress }
    for (const listener of listeners) listener(event)
  }
  const result = Promise.resolve().then(async() => executor(controller.signal, report))
  return {
    jobId,
    result,
    cancel: () => { controller.abort() },
    onProgress: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}

export interface BackendDescriptor {
  interfaceVersion: typeof BACKEND_INTERFACE_VERSION
  implementation: 'electron' | 'fake' | 'native'
  implementationVersion: string
  capabilities: ReadonlySet<BackendCapability>
}

export type PlayerEventName =
  | 'playing'
  | 'pause'
  | 'ended'
  | 'error'
  | 'loadeddata'
  | 'loadstart'
  | 'canplay'
  | 'emptied'
  | 'timeupdate'
  | 'waiting'
  | 'visibilitychange'

export interface PlayerLoadRequest {
  source: string
}

export interface PlayerService {
  initialize: () => void
  load: (request: PlayerLoadRequest) => void
  play: () => void
  pause: () => void
  stop: () => void
  next: (automatic?: boolean) => Promise<void>
  previous: (automatic?: boolean) => Promise<void>
  isEmpty: () => boolean
  setLoop: (enabled: boolean) => void
  getPosition: () => number
  getDuration: () => number
  getPlaybackRate: () => number
  getErrorCode: () => number | undefined
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setPlaybackRate: (rate: number) => void
  setPreservesPitch: (enabled: boolean) => void
  setOutputDevice: (deviceId: string) => Promise<void>
  setPitch: (semitones: number) => void
  on: (event: PlayerEventName, listener: () => void) => Unsubscribe
  publishShellStatus: (status: Partial<LX.Player.Status>) => void
  onShellAction: (listener: (action: {
    action: LX.Player.StatusButtonActions
    data?: unknown
  }) => void) => Unsubscribe
  savePlaybackState: (state: LX.Player.SavedPlayInfo) => void
}

export interface LibraryQuery extends PageRequest {
  text?: string
}

export interface LibraryScanResult {
  folderCount: number
  scannedFileCount: number
  totalCount: number
}

export interface LibraryOverview {
  listId: StableId
  folders: string[]
  tracks: LX.Music.MusicInfoLocal[]
  albumCount: number
  artistCount: number
}

export interface LibraryService {
  getOverview: () => Promise<LibraryOverview>
  queryLocalTracks: (query: LibraryQuery, signal?: AbortSignal) => Promise<Page<LX.Music.MusicInfoLocal>>
  registerFolders: (folders: string[]) => Promise<string[]>
  unregisterFolder: (folder: string) => Promise<string[]>
  startRescan: () => BackendJob<LibraryScanResult>
  removeFolderTracks: (folder: string) => Promise<void>
}

export interface MetadataService {
  read: (filePath: string, signal?: AbortSignal) => Promise<LX.LocalMusic.Metadata>
  write: (request: LX.LocalMusic.MetadataWriteRequest, signal?: AbortSignal) => Promise<LX.LocalMusic.Metadata>
  readEmbeddedLyrics: (filePath: string, signal?: AbortSignal) => Promise<string>
  writeEmbeddedLyrics: (request: LX.LocalMusic.EmbeddedLyricsWriteRequest, signal?: AbortSignal) => Promise<string>
}

export interface ArtworkService {
  readLocalFile: (filePath: string, signal?: AbortSignal) => Promise<string>
  getLocalTrackArtwork: (filePath: string, signal?: AbortSignal) => Promise<string | null>
}

export interface DownloadService {
  listPersistedTasks: () => Promise<LX.Download.ListItem[]>
  createPersistedTasks: (list: LX.Download.ListItem[], location: LX.AddMusicLocationType) => Promise<void>
  updatePersistedTasks: (list: LX.Download.ListItem[]) => Promise<void>
  removePersistedTasks: (ids: string[]) => Promise<void>
  clearPersistedTasks: () => Promise<void>
}

export interface SourceService {
  searchBilibili: (params: LX.Bili.SearchParams) => Promise<LX.Bili.SearchResult>
  getBilibiliMusicUrl: (track: LX.Bili.TrackParams, quality: LX.Quality) => Promise<LX.Bili.MusicUrlResult>
  getBilibiliVideoUrl: (track: LX.Bili.TrackParams) => Promise<LX.Bili.VideoUrlResult>
  getBilibiliArtwork: (track: LX.Bili.TrackParams) => Promise<string>
  getBilibiliQualities: (track: LX.Bili.TrackParams) => Promise<LX.Bili.MusicQualityInfo>
  getBilibiliLyrics: (track: LX.Bili.TrackParams) => Promise<LX.Music.LyricInfo>
  getBilibiliLyricSource: (request: LX.Bili.LyricMatchParams) => Promise<LX.Music.LyricInfo>
  getBilibiliLyricCandidates: (request: LX.Bili.LyricMatchParams) => Promise<LX.Bili.LyricCandidate[]>
  getBilibiliComments: (request: LX.Bili.CommentParams) => Promise<LX.Bili.CommentInfo>
  getBilibiliPlaylist: (request: LX.Bili.SongListDetailParams) => Promise<LX.Bili.SongListDetail>
  getUserSources: () => Promise<LX.UserApi.UserApiInfo[]>
  selectUserSource: (source: LX.UserApi.UserApiSetApiParams) => Promise<void>
  requestUserSource: (request: LX.UserApi.UserApiRequestParams) => Promise<unknown>
  cancelUserSourceRequest: (request: LX.UserApi.UserApiRequestCancelParams) => void
}

export interface SettingsService {
  get: () => Promise<LX.AppSetting>
  update: (patch: Partial<LX.AppSetting>) => Promise<void>
  onChanged: (listener: (patch: Partial<LX.AppSetting>) => void) => Unsubscribe
}

export type OpenDialogProperty = 'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'

export interface OpenDialogRequest {
  title?: string
  properties?: OpenDialogProperty[]
  filters?: Array<{ name: string, extensions: string[] }>
}

export interface OpenDialogResult {
  canceled: boolean
  filePaths: string[]
}

export interface PlatformService {
  quit: () => void
  closeWindow: () => void
  minimizeWindow: () => void
  maximizeWindow: () => void
  focusWindow: () => void
  setFullscreen: (enabled: boolean) => Promise<boolean>
  setWindowSize: (width: number, height: number) => void
  setPowerSaveBlocker: (enabled: boolean) => void
  select: (request: OpenDialogRequest) => Promise<OpenDialogResult>
  revealInFileManager: (path: string) => void
  openDevTools: () => void
}

export interface BackendApi {
  descriptor: BackendDescriptor
  player: PlayerService
  library: LibraryService
  metadata: MetadataService
  artwork: ArtworkService
  download: DownloadService
  source: SourceService
  settings: SettingsService
  platform: PlatformService
}

export const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new BackendError('aborted', 'The operation was cancelled')
}
