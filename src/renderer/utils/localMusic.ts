import { createUserList } from '@renderer/store/list/action'
import { userLists } from '@renderer/store/list/state'

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
let localTrackCache: LX.Music.MusicInfoLocal[] = []

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

export const ensureLocalMusicList = async() => {
  let list = userLists.find(item => item.id == LOCAL_MUSIC_LIST_ID)
  if (list) return list

  await createUserList({
    id: LOCAL_MUSIC_LIST_ID,
    name: LOCAL_MUSIC_LIST_NAME,
  })

  list = userLists.find(item => item.id == LOCAL_MUSIC_LIST_ID)
  return list ?? {
    id: LOCAL_MUSIC_LIST_ID,
    name: LOCAL_MUSIC_LIST_NAME,
  }
}

export const buildLocalAlbumGroups = (tracks: LX.Music.MusicInfoLocal[]): LocalMusicGroup[] => {
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

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

export const buildLocalArtistGroups = (tracks: LX.Music.MusicInfoLocal[]): LocalMusicGroup[] => {
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

  return Array.from(groups.values())
    .map(group => {
      const albumCount = new Set(group.items.map(item => getText(item.track.meta.albumName, '未命名专辑'))).size
      return {
        ...group,
        subtitle: `${albumCount} 张专辑`,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}
