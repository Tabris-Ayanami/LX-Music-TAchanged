import { createUserList, getUserLists } from '@renderer/store/list/action'
import { userLists } from '@renderer/store/list/state'
import { playMusicInfo } from '@renderer/store/player/state'
import { appendToDefaultList, playMusicsInDefaultList } from './playDefaultList'

export const LOCAL_MUSIC_LIST_ID = 'userlist_local_music'
export const LOCAL_MUSIC_LIST_NAME = '本地音乐'

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
  groupCoverCache.set(getGroupCacheKey(type, key), cover)
}

export const getCachedLocalTracks = () => localTrackCache

export const setCachedLocalTracks = (tracks: LX.Music.MusicInfoLocal[]) => {
  localTrackCache = tracks
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
    await appendToDefaultList(tracks)
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
