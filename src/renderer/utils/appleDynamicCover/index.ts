/**
 * Apple Music 动态封面（Animated Artwork）服务
 *
 * 通过 Apple Music 网页版公开接口获取专辑动态封面（editorialVideo）的 HLS 视频地址：
 * 1. 用 amp-api 搜索歌曲/专辑，得到专辑 id
 * 2. 请求 albums/{id}?extend=editorialVideo 拿到 motionDetailSquare 等动态封面 m3u8
 * 3. 解析 master 列表，优先选择 H.264(AVC) 变体，保证 Electron/Chromium 可硬解播放
 *
 * 参考实现：github.com/bunnykek/Apple-Music-Animated-Artwork-Fetcher
 */

import { httpFetch } from '@renderer/utils/request'
import { getAppleMusicWebToken, clearCachedToken } from './token'
import { pickBestVariant, resolveVariantMediaUrl } from './hls'

/** httpFetch 是 JS 实现，这里补一个最小类型声明 */
const httpFetchTyped: (url: string, options?: Record<string, any>) => { promise: Promise<any> } = httpFetch as any

/** 尝试的国家/地区 storefront，按可用性排序 */
const STOREFRONTS = ['cn', 'hk', 'tw', 'us', 'gb', 'jp', 'de', 'fr']

/** 封面类型，编辑视频里 motion 字段的 key 顺序（优先 1:1 方形，符合专辑封面展示） */
const MOTION_KEYS = ['motionDetailSquare', 'motionSquareVideo1x1', 'motionDetailTall']

const AMP_API_BASE = 'https://amp-api.music.apple.com/v1/catalog'

export interface DynamicCoverResult {
  /** 可直接交给 <video> 播放的视频地址（media playlist 或 master playlist） */
  videoUrl: string
  /** 该动态封面的预览帧（可作 poster） */
  posterUrl: string | null
  /** 专辑 id */
  albumId: string
  /** 命中的 storefront */
  storefront: string
}

interface SearchSong {
  id: string
  resourceType: 'song' | 'album'
  storefront: string
  name: string
  artistName: string
  albumName: string
  albumId: string | null
}

let requestQueue: Promise<unknown> = Promise.resolve()
/** 简单的请求串行化，避免并发时被风控 */
const queueRequest = async<T,>(task: () => Promise<T>): Promise<T> => {
  const result = requestQueue.then(task, task)
  requestQueue = result.catch(() => {})
  return result
}

const fetchJson = async(url: string, token: string): Promise<any> => new Promise((resolve, reject) => {
  const { promise } = httpFetchTyped(url, {
    method: 'get',
    headers: {
      authorization: `Bearer ${token}`,
      origin: 'https://music.apple.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      accept: 'application/json',
    },
  })
  promise
    .then(resp => {
      const { statusCode } = resp
      if (statusCode == 401 || statusCode == 403) {
        clearCachedToken()
        reject(new Error(`apple api auth failed: ${statusCode}`))
        return
      }
      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`apple api error ${statusCode}`))
        return
      }
      resolve(resp.body)
    })
    .catch(reject)
})

const fetchText = async(url: string): Promise<string> => new Promise((resolve, reject) => {
  const { promise } = httpFetchTyped(url, {
    method: 'get',
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36' },
  })
  promise
    .then(resp => {
      const { statusCode } = resp
      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`hls fetch error ${statusCode}`))
        return
      }
      resolve(resp.raw?.toString?.() ?? resp.body)
    })
    .catch(reject)
})

const albumSearch = async(term: string, token: string): Promise<SearchSong[]> => {
  const storefronts = STOREFRONTS
  for (const storefront of storefronts) {
    try {
      const url = `${AMP_API_BASE}/${storefront}/search?term=${encodeURIComponent(term)}&types=albums,songs&limit=10`
      const data = await fetchJson(url, token)
      const results = data?.results ?? {}
      const albums: Array<{ id: string, attributes: any }> = results.albums?.data ?? []
      const songs: Array<{ id: string, attributes: any, relationships?: any }> = results.songs?.data ?? []

      const albumMap = new Map<string, string>()
      for (const album of albums) albumMap.set(album.id, album.attributes?.name ?? '')

      const list: SearchSong[] = []
      for (const song of songs) {
        const attrs = song.attributes ?? {}
        const albumId = song.relationships?.albums?.data?.[0]?.id ?? null
        list.push({
          id: song.id,
          resourceType: 'song',
          storefront,
          name: attrs.name ?? '',
          artistName: attrs.artistName ?? '',
          albumName: attrs.albumName ?? albumMap.get(albumId) ?? '',
          albumId,
        })
      }
      // 直接补上专辑搜索结果，命中率更高（部分歌曲的 editorialVideo 挂在专辑上）
      for (const album of albums) {
        const attrs = album.attributes ?? {}
        list.push({
          id: album.id,
          resourceType: 'album',
          storefront,
          name: attrs.name ?? '',
          artistName: attrs.artistName ?? '',
          albumName: attrs.name ?? '',
          albumId: album.id,
        })
      }
      if (list.length) return list
    } catch (err) {
      // 该 storefront 失败则尝试下一个
      console.warn('[appleDynamicCover] search failed', storefront, err)
    }
  }
  return []
}

/** 归一化文本用于比较（转小写、去掉装饰字符） */
const normalize = (text: string | undefined | null): string => String(text ?? '')
  .toLowerCase()
  .replace(/（.*?）|\(.*?\)|【.*?】|\[.*?]/g, '') // 去掉括号内容
  .replace(/[\u3010\u3011\u005b\u005d\uff08\uff09()]/g, '')
  .replace(/[\u200b\u00ad]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

/** 简单的编辑距离，用于比较标题相似度 */
const similarity = (a: string, b: string): number => {
  if (!a || !b) return 0
  if (a == b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (!maxLen) return 0
  // LCS 简易计算
  const prev = new Array<number>(b.length + 1).fill(0)
  const cur = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] == b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length] / maxLen
}

const pickBestSearch = (list: SearchSong[], query: { title: string, artist: string, album: string }): SearchSong | null => {
  if (!list.length) return null
  const title = normalize(query.title)
  const artist = normalize(query.artist)
  const album = normalize(query.album)

  let best: SearchSong | null = null
  let bestScore = 0
  for (const item of list) {
    let score = 0
    const itemTitle = normalize(item.name)
    const itemArtist = normalize(item.artistName)
    const itemAlbum = normalize(item.albumName)

    if (title && itemTitle) {
      if (itemTitle == title) score += 6
      else score += similarity(itemTitle, title) * 3
    }
    if (artist && itemArtist) {
      if (itemArtist == artist) score += 4
      else if (itemArtist.includes(artist) || artist.includes(itemArtist)) score += 3
      else score += similarity(itemArtist, artist) * 2
    }
    if (album && itemAlbum) {
      if (itemAlbum == album) score += 3
      else if (itemAlbum.includes(album) || album.includes(itemAlbum)) score += 2
      else score += similarity(itemAlbum, album)
    }
    // 优先能拿全专辑 id 的结果
    if (!item.albumId) score *= 0.8
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  return bestScore >= 2 ? best : (list.find(item => item.albumId) ?? null)
}

const resolveAlbumReference = async(match: SearchSong, token: string): Promise<{ albumId: string, storefront: string } | null> => {
  if (match.resourceType == 'album') return { albumId: match.id, storefront: match.storefront }
  if (match.albumId) return { albumId: match.albumId, storefront: match.storefront }

  try {
    const url = `${AMP_API_BASE}/${match.storefront}/songs/${match.id}?include=albums`
    const data = await fetchJson(url, token)
    const albumId = data?.data?.[0]?.relationships?.albums?.data?.[0]?.id
    return albumId ? { albumId, storefront: match.storefront } : null
  } catch (err) {
    console.warn('[appleDynamicCover] song album relationship failed', match.storefront, err)
    return null
  }
}

const getEditorialVideoUrl = async(albumId: string, preferredStorefront: string, token: string): Promise<{ videoUrl: string, posterUrl: string | null, storefront: string } | null> => {
  const storefronts = [preferredStorefront, ...STOREFRONTS.filter(storefront => storefront != preferredStorefront)]
  for (const storefront of storefronts) {
    try {
      const url = `${AMP_API_BASE}/${storefront}/albums/${albumId}?extend=editorialVideo`
      const data = await fetchJson(url, token)
      const attributes = data?.data?.[0]?.attributes
      const editorialVideo = attributes?.editorialVideo
      if (!editorialVideo) continue

      for (const key of MOTION_KEYS) {
        const motion = editorialVideo[key]
        const video = motion?.video
        if (!video) continue
        const poster = motion?.previewFrame?.url
          ? String(motion.previewFrame.url).replace(/\{w\}x\{h\}/, '600x600')
          : null
        return { videoUrl: video, posterUrl: poster, storefront }
      }
    } catch (err) {
      console.warn('[appleDynamicCover] album editorialVideo failed', storefront, err)
    }
  }
  return null
}

/**
 * 解析动态封面 HLS：优先 AVC 变体，返回最终可用于 <video> 播放的地址。
 * 若无法解析变体，原样返回 master 地址（Chromium 原生 HLS 也能自适应）。
 */
const resolvePlayableVideoUrl = async(masterUrl: string): Promise<string> => {
  try {
    const master = await fetchText(masterUrl)
    if (!master.includes('#EXT-X-STREAM-INF')) return masterUrl
    const variant = pickBestVariant(master, masterUrl)
    if (!variant) return masterUrl
    const mediaUrl = resolveVariantMediaUrl(variant, masterUrl)
    return mediaUrl
  } catch (err) {
    console.warn('[appleDynamicCover] resolve hls failed, use master directly', err)
    return masterUrl
  }
}

const cache = new Map<string, DynamicCoverResult>()
const pending = new Map<string, Promise<DynamicCoverResult | null>>()
const MAX_CACHE_SIZE = 50

const getCacheKey = (info: { name: string, singer: string, album: string }) => [
  info.name?.trim?.() || '',
  info.singer?.trim?.() || '',
  info.album?.trim?.() || '',
].join('|')

const cacheSet = (key: string, value: DynamicCoverResult | null) => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey != null) cache.delete(firstKey)
  }
  if (value) cache.set(key, value)
}

export interface AppleDynamicCoverQuery {
  name: string
  singer: string
  album: string
}

/**
 * 获取某首歌曲对应的 Apple Music 动态封面视频地址
 * @returns 解析失败或该专辑没有动态封面时返回 null
 */
export const getAppleDynamicCover = async(info: AppleDynamicCoverQuery): Promise<DynamicCoverResult | null> => {
  const key = getCacheKey(info)
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  const exist = pending.get(key)
  if (exist) return exist

  const task = (async(): Promise<DynamicCoverResult | null> => {
    try {
      const term = [info.name, info.singer, info.album].filter(Boolean).slice(0, 2).join(' ')
      if (!term) return null
      const token = await getAppleMusicWebToken()

      const searchList = await queueRequest(async() => albumSearch(term, token))
      if (!searchList.length) return null

      const best = pickBestSearch(searchList, {
        title: info.name,
        artist: info.singer,
        album: info.album,
      })
      if (!best) return null
      const albumRef = await queueRequest(async() => resolveAlbumReference(best, token))
      if (!albumRef) return null

      const result = await queueRequest(async() => getEditorialVideoUrl(albumRef.albumId, albumRef.storefront, token))
      if (!result) return null

      const videoUrl = await resolvePlayableVideoUrl(result.videoUrl)
      const finalResult: DynamicCoverResult = {
        videoUrl,
        posterUrl: result.posterUrl,
        albumId: albumRef.albumId,
        storefront: result.storefront,
      }
      cacheSet(key, finalResult)
      return finalResult
    } catch (err) {
      console.warn('[appleDynamicCover] get dynamic cover failed', err)
      return null
    }
  })()

  pending.set(key, task)
  return task.finally(() => {
    pending.delete(key)
  })
}

/** 清空缓存（切换语言或调试时可用） */
export const clearAppleDynamicCoverCache = () => {
  cache.clear()
  pending.clear()
}
