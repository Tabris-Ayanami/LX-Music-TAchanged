import { createUserList, getListMusics, getUserLists, addListMusics, overwriteListMusics, setFetchingListStatus } from '@renderer/store/list/action'
import { userLists } from '@renderer/store/list/state'
import { playMusicInfo } from '@renderer/store/player/state'
import { playMusicsInDefaultList, queueNextInDefaultList } from './playDefaultList'
import { readdir } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

export const LOCAL_MUSIC_LIST_ID = 'userlist_local_music'
export const LOCAL_MUSIC_LIST_NAME = '本地音乐'
export const LOCAL_MUSIC_LIBRARY_FOLDERS_KEY = 'lx_local_music_library_folders'

const LOCAL_MEDIA_EXTS = new Set(['.mp3', '.flac', '.ogg', '.oga', '.wav', '.m4a'])
const LOCAL_MUSIC_IMPORT_BATCH_SIZE = 200

interface LocalDirEntry {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
}

export interface LocalMusicGroupItem {
  index: number
  track: LX.Music.MusicInfoLocal
}

export interface LocalMusicGroup {
  key: string
  name: string
  singer: string
  count: number
  cover: string
  firstIndex: number
  initial: string
  items: LocalMusicGroupItem[]
  sourceTrack: LX.Music.MusicInfoLocal
  subtitle: string
}

const groupCoverCache = new Map<string, string>()
const GROUP_COVER_CACHE_LIMIT = 500
const albumGroupCache = new WeakMap<LX.Music.MusicInfoLocal[], LocalMusicGroup[]>()
const artistGroupCache = new WeakMap<LX.Music.MusicInfoLocal[], LocalMusicGroup[]>()
let localTrackCache: LX.Music.MusicInfoLocal[] = []
let ensureLocalMusicListPromise: Promise<LX.List.UserListInfo> | null = null

const getText = (value: string | null | undefined, fallback: string) => {
  const text = value?.trim()
  if (!text) return fallback
  return text
}

const getGroupCacheKey = (type: 'albums' | 'artists', key: string) => `${type}:${key}`

export const getCachedLocalGroupCover = (type: 'albums' | 'artists', key: string) => {
  return groupCoverCache.get(getGroupCacheKey(type, key)) ?? ''
}

export const setCachedLocalGroupCover = (type: 'albums' | 'artists', key: string, cover: string) => {
  if (!cover) return
  if (groupCoverCache.size >= GROUP_COVER_CACHE_LIMIT) groupCoverCache.delete(groupCoverCache.keys().next().value!)
  groupCoverCache.set(getGroupCacheKey(type, key), cover)
}

export const getCachedLocalTracks = () => localTrackCache

export const setCachedLocalTracks = (tracks: LX.Music.MusicInfoLocal[]) => {
  localTrackCache = tracks
}

const normalizeLibraryFolder = (folderPath: string) => normalize(folderPath.trim())

const normalizeComparablePath = (path: string) => normalize(path).toLowerCase()

const dedupePaths = (paths: string[]) => {
  const map = new Map<string, string>()
  for (const path of paths) {
    const normalizedPath = normalizeLibraryFolder(path)
    if (!normalizedPath) continue
    map.set(normalizeComparablePath(normalizedPath), normalizedPath)
  }
  return Array.from(map.values())
}

const dedupeMusicInfos = (musicInfos: LX.Music.MusicInfo[]) => {
  const map = new Map<string, LX.Music.MusicInfo>()
  for (const musicInfo of musicInfos) {
    if (!musicInfo?.id) continue
    map.set(musicInfo.id, musicInfo)
  }
  return Array.from(map.values())
}

const isFileUnderFolder = (filePath: string, folderPath: string) => {
  const normalizedFilePath = normalizeComparablePath(filePath)
  const normalizedFolderPath = normalizeComparablePath(folderPath)
  const folderPrefix = normalizedFolderPath.endsWith(sep) ? normalizedFolderPath : `${normalizedFolderPath}${sep}`
  return normalizedFilePath == normalizedFolderPath || normalizedFilePath.startsWith(folderPrefix)
}

const isTrackInFolders = (track: LX.Music.MusicInfo, folders: string[]) => {
  if (track.source != 'local') return false
  return folders.some(folder => isFileUnderFolder(track.meta.filePath, folder))
}

export const getLocalMusicLibraryFolders = () => {
  try {
    const folders = JSON.parse(window.localStorage.getItem(LOCAL_MUSIC_LIBRARY_FOLDERS_KEY) ?? '[]')
    if (!Array.isArray(folders)) return []
    return dedupePaths(folders.filter((path): path is string => typeof path == 'string'))
  } catch {
    return []
  }
}

export const setLocalMusicLibraryFolders = (folders: string[]) => {
  const nextFolders = dedupePaths(folders)
  window.localStorage.setItem(LOCAL_MUSIC_LIBRARY_FOLDERS_KEY, JSON.stringify(nextFolders))
  return nextFolders
}

export const addLocalMusicLibraryFolders = (folders: string[]) => {
  return setLocalMusicLibraryFolders([
    ...getLocalMusicLibraryFolders(),
    ...folders,
  ])
}

export const removeLocalMusicLibraryFolder = (folderPath: string) => {
  const targetPath = normalizeComparablePath(folderPath)
  return setLocalMusicLibraryFolders(getLocalMusicLibraryFolders().filter(path => normalizeComparablePath(path) != targetPath))
}

export const collectLocalMusicFilesFromDir = async(dirPath: string): Promise<string[]> => {
  const result: string[] = []
  let entries: LocalDirEntry[]
  try {
    entries = await readdir(dirPath, { withFileTypes: true, encoding: 'utf8' }) as unknown as LocalDirEntry[]
  } catch {
    return result
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      result.push(...await collectLocalMusicFilesFromDir(fullPath))
      continue
    }
    if (!entry.isFile()) continue
    if (!LOCAL_MEDIA_EXTS.has(extname(entry.name).toLowerCase())) continue
    result.push(fullPath)
  }

  return result
}

export const collectLocalMusicFilesFromFolders = async(folders: string[]) => {
  return dedupePaths((await Promise.all(folders.map(async path => collectLocalMusicFilesFromDir(path)))).flat())
}

const createLocalMusicInfosByPaths = async(filePaths: string[], index: number = 0): Promise<LX.Music.MusicInfoLocal[]> => {
  const paths = filePaths.slice(index, index + LOCAL_MUSIC_IMPORT_BATCH_SIZE)
  if (!paths.length) return []

  const musicInfos = await window.lx.worker.main.createLocalMusicInfos(paths)
  if (filePaths.length <= index + LOCAL_MUSIC_IMPORT_BATCH_SIZE) return musicInfos
  return [
    ...musicInfos,
    ...await createLocalMusicInfosByPaths(filePaths, index + LOCAL_MUSIC_IMPORT_BATCH_SIZE),
  ]
}

export const importLocalMusicFiles = async(listId: string, filePaths: string[]) => {
  if (!filePaths.length) return 0
  setFetchingListStatus(listId, true)
  try {
    const uniquePaths = dedupePaths(filePaths)
    const musicInfos = await createLocalMusicInfosByPaths(uniquePaths)
    if (musicInfos.length) await addListMusics(listId, musicInfos)
    return musicInfos.length
  } finally {
    setFetchingListStatus(listId, false)
  }
}

export const rescanLocalMusicLibrary = async() => {
  const list = await ensureLocalMusicList()
  const folders = getLocalMusicLibraryFolders()
  setFetchingListStatus(list.id, true)
  try {
    const currentTracks = await getListMusics(list.id)
    const unmanagedTracks = currentTracks.filter(track => !isTrackInFolders(track, folders))
    const filePaths = await collectLocalMusicFilesFromFolders(folders)
    const scannedTracks = await createLocalMusicInfosByPaths(filePaths)
    const nextTracks = dedupeMusicInfos([
      ...unmanagedTracks,
      ...scannedTracks,
    ])
    await overwriteListMusics({
      listId: list.id,
      musicInfos: nextTracks,
    })
    setCachedLocalTracks(nextTracks.filter((track): track is LX.Music.MusicInfoLocal => track.source == 'local'))
    return {
      listId: list.id,
      folderCount: folders.length,
      scannedFileCount: filePaths.length,
      importedCount: scannedTracks.length,
      totalCount: nextTracks.length,
    }
  } finally {
    setFetchingListStatus(list.id, false)
  }
}

export const removeLocalMusicLibraryFolderTracks = async(folderPath: string) => {
  const list = await ensureLocalMusicList()
  setFetchingListStatus(list.id, true)
  try {
    const currentTracks = await getListMusics(list.id)
    const nextTracks = currentTracks.filter(track => {
      return track.source != 'local' || !isFileUnderFolder(track.meta.filePath, folderPath)
    })
    await overwriteListMusics({
      listId: list.id,
      musicInfos: nextTracks,
    })
    setCachedLocalTracks(nextTracks.filter((track): track is LX.Music.MusicInfoLocal => track.source == 'local'))
    return nextTracks.length
  } finally {
    setFetchingListStatus(list.id, false)
  }
}

const isDuplicateListError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE constraint failed') && message.includes('my_list.id')
}

const loadLocalMusicList = async(): Promise<LX.List.UserListInfo> => {
  let list = userLists.find(item => item.id == LOCAL_MUSIC_LIST_ID)
  if (list) return list

  try {
    await getUserLists()
  } catch {
    // Ignore transient list refresh failures and fall back to create/retry below.
  }

  list = userLists.find(item => item.id == LOCAL_MUSIC_LIST_ID)
  if (list) return list

  try {
    await createUserList({
      id: LOCAL_MUSIC_LIST_ID,
      name: LOCAL_MUSIC_LIST_NAME,
    })
  } catch (error) {
    if (!isDuplicateListError(error)) throw error
  }

  try {
    await getUserLists()
  } catch {
    // If the refresh fails here, return a fallback object so the page can keep working.
  }

  list = userLists.find(item => item.id == LOCAL_MUSIC_LIST_ID)
  return list ?? {
    id: LOCAL_MUSIC_LIST_ID,
    name: LOCAL_MUSIC_LIST_NAME,
    locationUpdateTime: null,
  }
}

export const ensureLocalMusicList = async() => {
  if (ensureLocalMusicListPromise) return ensureLocalMusicListPromise

  ensureLocalMusicListPromise = loadLocalMusicList().finally(() => {
    ensureLocalMusicListPromise = null
  })

  return ensureLocalMusicListPromise
}

const clampPlayIndex = (index: number, length: number) => {
  if (!length) return 0
  if (index < 0) return 0
  if (index >= length) return length - 1
  return index
}

export const playLocalTempTracks = async(
  _tempId: string,
  tracks: LX.Music.MusicInfo[],
  index: number = 0,
  options: {
    interrupt?: boolean
  } = {},
) => {
  if (!tracks.length) return
  const safeIndex = clampPlayIndex(index, tracks.length)
  if (options.interrupt === false && playMusicInfo.musicInfo) {
    await queueNextInDefaultList(tracks)
    return
  }
  await playMusicsInDefaultList(tracks, safeIndex)
}

export const playSingleLocalTrack = async(track: LX.Music.MusicInfoLocal) => {
  await playLocalTempTracks(`${LOCAL_MUSIC_LIST_ID}__single__${track.id}`, [track], 0)
}

export const buildLocalAlbumGroups = (tracks: LX.Music.MusicInfoLocal[]): LocalMusicGroup[] => {
  const cachedGroups = albumGroupCache.get(tracks)
  if (cachedGroups) return cachedGroups
  const groups = new Map<string, LocalMusicGroup>()

  tracks.forEach((track, index) => {
    const albumName = getText(track.meta.albumName, '未命名专辑')
    const singer = getText(track.singer, '未知音乐家')
    const key = `${albumName}__${singer}`
    const cachedCover = getCachedLocalGroupCover('albums', key)

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: albumName,
        singer,
        count: 0,
        cover: track.meta.picUrl ?? cachedCover,
        firstIndex: index,
        initial: albumName.slice(0, 1).toUpperCase(),
        items: [],
        sourceTrack: track,
        subtitle: singer,
      })
    }

    const group = groups.get(key)!
    group.count += 1
    group.items.push({
      index,
      track,
    })

    if (!group.cover && track.meta.picUrl) {
      group.cover = track.meta.picUrl
      setCachedLocalGroupCover('albums', key, track.meta.picUrl)
    }
  })

  const result = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  albumGroupCache.set(tracks, result)
  return result
}

export const buildLocalArtistGroups = (tracks: LX.Music.MusicInfoLocal[]): LocalMusicGroup[] => {
  const cachedGroups = artistGroupCache.get(tracks)
  if (cachedGroups) return cachedGroups
  const groups = new Map<string, LocalMusicGroup>()

  tracks.forEach((track, index) => {
    const name = getText(track.singer, '未知音乐家')
    const cachedCover = getCachedLocalGroupCover('artists', name)

    if (!groups.has(name)) {
      groups.set(name, {
        key: name,
        name,
        singer: name,
        count: 0,
        cover: track.meta.picUrl ?? cachedCover,
        firstIndex: index,
        initial: name.slice(0, 1).toUpperCase(),
        items: [],
        sourceTrack: track,
        subtitle: '',
      })
    }

    const group = groups.get(name)!
    group.count += 1
    group.items.push({
      index,
      track,
    })

    if (!group.cover && track.meta.picUrl) {
      group.cover = track.meta.picUrl
      setCachedLocalGroupCover('artists', name, track.meta.picUrl)
    }
  })

  const result = Array.from(groups.values())
    .map(group => {
      const albumCount = new Set(group.items.map(item => getText(item.track.meta.albumName, '未命名专辑'))).size
      return {
        ...group,
        subtitle: `${albumCount} 张专辑`,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  artistGroupCache.set(tracks, result)
  return result
}
