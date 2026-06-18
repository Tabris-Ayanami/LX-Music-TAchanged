import { createImageProxyUrl, createProxyUrl } from './proxy'
import { BILI_USER_AGENT, getAccountInfo, normalizeBiliUrl, requestJson } from './request'
import type { BiliCommentInfo, BiliCommentItem, BiliCommentParams, BiliMusicQualityInfo, BiliMusicUrlResult, BiliSearchParams, BiliSearchResult, BiliSongListDetail, BiliSongListDetailParams, BiliTrack, BiliTrackParams } from './types'

const decodeHtml = (text: unknown) => String(text ?? '')
  .replace(/&quot;/g, '"')
  .replace(/&#039;|&apos;/g, '\'')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')

const stripHighlight = (text: unknown) => decodeHtml(text).replace(/<\/?em\b[^>]*>/g, '')

const parseDuration = (duration: unknown): number | null => {
  if (typeof duration == 'number') return duration
  if (typeof duration != 'string') return null
  const nums = duration.split(':').map(n => parseInt(n))
  if (nums.some(n => Number.isNaN(n))) return null
  return nums.reduce((sum, num) => sum * 60 + num, 0)
}

const formatTrack = (view: any, page: any): BiliTrack => {
  const pageIndex = Number(page?.page || 1)
  const pageTitle = String(page?.part || view.title || '')
  const multiPage = (view.pages?.length || 0) > 1
  const videoTitle = stripHighlight(view.title)
  return {
    id: `${view.bvid}_${page.cid}`,
    bvid: view.bvid,
    aid: view.aid,
    cid: Number(page.cid),
    title: multiPage ? `${videoTitle} - P${pageIndex} ${pageTitle}` : videoTitle,
    videoTitle,
    author: stripHighlight(view.owner?.name || view.author || ''),
    ownerMid: view.owner?.mid,
    cover: normalizeBiliUrl(page?.first_frame || view.pic || ''),
    duration: parseDuration(page?.duration),
    page: pageIndex,
    pageTitle,
    pageCount: view.pages?.length || 1,
  }
}

const formatSearchItem = (item: any): BiliTrack => {
  const videoTitle = stripHighlight(item.title)
  const duration = parseDuration(item.duration)
  return {
    id: `${item.bvid}_0`,
    bvid: item.bvid,
    aid: item.aid,
    cid: 0,
    title: videoTitle,
    videoTitle,
    author: stripHighlight(item.author),
    ownerMid: item.mid,
    cover: normalizeBiliUrl(item.pic ?? ''),
    duration,
    page: 1,
    pageTitle: videoTitle,
    pageCount: 1,
  }
}

const getView = async(bvid: string) => {
  return requestJson<any>('/x/web-interface/view', { bvid })
}

const getViewDetail = async(bvid: string) => {
  return requestJson<any>('/x/web-interface/view/detail', { bvid })
}

const getTrackViewAndPage = async(params: BiliTrackParams) => {
  const view = await getView(params.bvid)
  const targetCid = params.cid == null ? null : Number(params.cid)
  const targetPage = params.page == null ? null : Number(params.page)
  const page = view.pages?.find((p: any) => targetCid ? Number(p.cid) == targetCid : Number(p.page) == targetPage) || view.pages?.[0]
  if (!page?.cid) throw new Error('B站视频缺少分P CID')
  return { view, page }
}

const uniqueTexts = (texts: Array<string | undefined | null>) => {
  const set = new Set<string>()
  for (const text of texts) {
    const value = String(text ?? '').trim()
    if (value) set.add(value)
  }
  return [...set]
}

const getDiscoveredMusicTitles = async(bvid: string) => {
  const detail = await getViewDetail(bvid).catch(() => null)
  const tags = Array.isArray(detail?.Tags) ? detail.Tags : []
  return uniqueTexts(tags
    .filter((tag: any) => tag?.music_id && tag?.tag_name)
    .map((tag: any) => tag.tag_name))
}

export const getSongListDetail = async(params: BiliSongListDetailParams): Promise<BiliSongListDetail> => {
  const page = params.page ?? 1
  const limit = params.limit ?? 1000
  const view = await getView(params.bvid)
  const pages = view.pages || [{ cid: view.cid, page: 1, part: view.title, duration: view.duration, first_frame: view.pic }]
  const start = (page - 1) * limit
  const list = pages.slice(start, start + limit).map((p: any) => formatTrack(view, p))
  return {
    list,
    page,
    limit,
    total: pages.length,
    source: 'bili',
    info: {
      play_count: String(view.stat?.view ?? ''),
      name: stripHighlight(view.title),
      img: normalizeBiliUrl(view.pic || ''),
      desc: view.desc || '',
      author: stripHighlight(view.owner?.name || ''),
    },
  }
}

const getAudioUrl = (audio: any) => audio?.baseUrl || audio?.base_url || audio?.url || audio?.backupUrl?.[0] || audio?.backup_url?.[0]

const getAudioQualityScore = (audio: any) => Number(audio?.bandwidth || audio?.codecid || audio?.id || 0)

const getPlayInfo = async(params: BiliTrackParams) => {
  const { page } = await getTrackViewAndPage(params)
  return requestJson<any>('/x/player/wbi/playurl', {
    bvid: params.bvid,
    cid: Number(page.cid),
    qn: 80,
    fnval: 4048,
    fnver: 0,
    fourk: 1,
  }, true)
}

const getBestAudio = (playInfo: any, type: LX.Quality) => {
  if ((type == 'flac' || type == 'flac24bit') && playInfo?.dash?.flac?.audio) return playInfo.dash.flac.audio
  const audioList = playInfo?.dash?.audio || []
  if (audioList.length) {
    const sorted = [...audioList].filter(getAudioUrl).sort((a, b) => getAudioQualityScore(b) - getAudioQualityScore(a))
    if (type == 'flac24bit') {
      const audio = sorted.find(audio => Number(audio.id) == 30251)
      if (!audio) throw new Error('当前 B 站视频没有 Hi-Res 音频')
      return audio
    }
    if (type == '320k') {
      const audio = sorted.find(audio => Number(audio.id) == 30250) ||
        sorted.find(audio => Number(audio.bandwidth) >= 300000)
      if (!audio) throw new Error('当前 B 站视频没有 320K 音频')
      return audio
    }
    if (type == '128k') {
      return sorted.find(audio => Number(audio.id) == 30232) ||
        sorted.find(audio => Number(audio.bandwidth) <= 160000) ||
        sorted[sorted.length - 1]
    }
    if (type == '192k') {
      return sorted.find(audio => Number(audio.id) == 30280) || sorted[0]
    }
    return sorted[0]
  }
  if (playInfo?.durl?.[0]?.url) return playInfo.durl[0]
  return null
}

const getQualitysFromPlayInfo = (playInfo: any): BiliMusicQualityInfo => {
  const audioList = (playInfo?.dash?.audio || []).filter(getAudioUrl)
  const audioIds = audioList.map((audio: any) => Number(audio.id)).filter((id: number) => Number.isFinite(id))
  const hasFlac = !!playInfo?.dash?.flac?.audio
  return {
    audioIds,
    hasFlac,
    qualitys: {
      flac24bit: hasFlac || audioList.some((audio: any) => Number(audio.id) == 30251),
      '320k': audioList.some((audio: any) => Number(audio.id) == 30250 || Number(audio.bandwidth) >= 300000),
      '192k': audioList.some((audio: any) => Number(audio.id) == 30280 || Number(audio.bandwidth) >= 180000),
      '128k': audioList.some((audio: any) => Number(audio.id) == 30232) || audioList.length > 0 || !!playInfo?.durl?.[0]?.url,
    },
  }
}

export const getMusicQualitys = async(params: BiliTrackParams): Promise<BiliMusicQualityInfo> => {
  return getQualitysFromPlayInfo(await getPlayInfo(params))
}

export const search = async(params: BiliSearchParams): Promise<BiliSearchResult> => {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const searchParams = {
    keyword: params.keyword,
    search_type: 'video',
    page,
  }
  const data = await requestJson<any>('/x/web-interface/wbi/search/type', searchParams, true)
    .catch(async() => requestJson<any>('/x/web-interface/wbi/search/type', searchParams))
  const rawList = Array.isArray(data.result) ? data.result.filter((item: any) => item?.bvid) : []
  const views = await Promise.all(rawList.slice(0, Math.min(rawList.length, limit)).map(async(item: any) => {
    try {
      return {
        item,
        view: await getView(item.bvid),
      }
    } catch {
      return {
        item,
        view: null,
      }
    }
  }))
  const list = views
    .filter(Boolean)
    .flatMap(({ item, view }: any) => {
      if (!view) return [formatSearchItem(item)]
      return (view.pages || [{ cid: view.cid, page: 1, part: view.title, duration: view.duration, first_frame: view.pic }]).map((p: any) => formatTrack(view, p))
    })
    .slice(0, limit)

  return {
    list,
    page,
    allPage: data.numPages || Math.ceil((data.numResults || list.length) / limit) || 1,
    total: data.numResults || list.length,
    limit,
  }
}

export const getMusicUrl = async(params: BiliTrackParams, type: LX.Quality = '128k'): Promise<BiliMusicUrlResult> => {
  const playInfo = await getPlayInfo(params)
  const audio = getBestAudio(playInfo, type)
  const rawUrl = getAudioUrl(audio)
  if (!rawUrl) throw new Error('未找到可用的 B 站音频流')
  const expiresAt = Date.now() + 110 * 60 * 1000
  const url = await createProxyUrl(rawUrl, expiresAt)
  return { type, url, rawUrl, expiresAt }
}

const dateFormat2 = (time: number): string => {
  const differ = Math.trunc((Date.now() - time) / 1000)
  if (differ < 60) return `${Math.max(differ, 0)}秒前`
  if (differ < 3600) return `${Math.trunc(differ / 60)}分钟前`
  if (differ < 86400) return `${Math.trunc(differ / 3600)}小时前`
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getCommentOid = async(params: BiliCommentParams) => {
  if (params.aid) return params.aid
  const view = await getView(params.bvid)
  if (!view?.aid) throw new Error('获取 B站评论 oid 失败')
  return Number(view.aid)
}

const proxyOptionalImage = async(url?: string) => {
  const normalized = normalizeBiliUrl(url ?? '')
  return normalized ? createImageProxyUrl(normalized) : ''
}

const mapBiliComment = async(item: any): Promise<BiliCommentItem> => {
  const member = item.member || {}
  const content = item.content || {}
  const pictures = Array.isArray(content.pictures) ? content.pictures : []
  const replyList = Array.isArray(item.replies) ? item.replies.slice(0, 3) : []
  return {
    id: item.rpid_str || item.rpid,
    text: content.message || '',
    time: item.ctime ? item.ctime * 1000 : '',
    timeStr: item.ctime ? dateFormat2(item.ctime * 1000) : '',
    location: item.reply_control?.location?.replace(/^IP属地：/, ''),
    userName: member.uname || '',
    avatar: await proxyOptionalImage(member.avatar),
    userId: member.mid,
    likedCount: item.like ?? null,
    images: await Promise.all(pictures.map(async(pic: any) => proxyOptionalImage(pic.img_src))),
    reply: await Promise.all(replyList.map(mapBiliComment)),
  }
}

export const getComment = async(params: BiliCommentParams): Promise<BiliCommentInfo> => {
  const page = Number(params.page ?? 1)
  const limit = Number(params.limit ?? 20)
  const oid = await getCommentOid(params)
  const data = await requestJson<any>('/x/v2/reply', {
    type: 1,
    oid,
    pn: page,
    ps: limit,
    sort: params.sort === 'hot' ? 2 : 0,
  })
  const rawList = params.sort === 'hot'
    ? (Array.isArray(data.hots) && data.hots.length ? data.hots : data.replies)
    : data.replies
  const comments = await Promise.all((rawList || []).map(mapBiliComment))
  const total = Number(data.page?.count || comments.length || 0)
  return {
    source: 'bili',
    comments,
    total,
    page,
    limit,
    maxPage: Math.ceil(total / limit) || 1,
  }
}

export const getPic = async(params: BiliTrackParams) => {
  const { view, page } = await getTrackViewAndPage(params)
  const picUrl = normalizeBiliUrl(page.first_frame || view.pic || '')
  return picUrl ? createImageProxyUrl(picUrl) : ''
}

const secondsToLrcTime = (seconds: number) => {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const minute = Math.floor(ms / 60000)
  const second = Math.floor((ms % 60000) / 1000)
  const centisecond = Math.floor((ms % 1000) / 10)
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(centisecond).padStart(2, '0')}`
}

export const getLyric = async(params: BiliTrackParams): Promise<LX.Music.LyricInfo> => {
  const { view, page } = await getTrackViewAndPage(params)
  const playerInfo = await requestJson<any>('/x/player/wbi/v2', {
    bvid: params.bvid,
    cid: Number(page.cid),
    qn: 80,
    fnval: 4048,
    fnver: 0,
    fourk: 1,
  }, true)
  const subtitle = playerInfo?.subtitle?.subtitles?.[0]
  const subtitleUrl = subtitle?.subtitle_url || subtitle?.subtitle_url_v2
  if (subtitleUrl) {
    const subtitleData = await requestJson<any>(normalizeBiliUrl(subtitleUrl))
    const body = Array.isArray(subtitleData.body) ? subtitleData.body : []
    const lyric = body
      .map((item: any) => {
        const text = String(item.content || '').replace(/^[♪♫]+|[♪♫]+$/g, '').trim()
        return text ? `[${secondsToLrcTime(Number(item.from || 0))}]${text}` : ''
      })
      .filter(Boolean)
      .join('\n')
    if (lyric) return { lyric }
  }

  const pageDuration = Number(page.duration)
  return getExternalLyricCandidates({
    titles: [
      ...await getDiscoveredMusicTitles(params.bvid),
      params.title,
      page.part,
      view.title,
    ],
    artist: params.artist,
    duration: params.duration ?? (Number.isFinite(pageDuration) && pageDuration > 0 ? pageDuration : null),
  })
}

export { getAccountInfo }

const stripSongDecorations = (text: string) => text
  .replace(/【[^】]*】/g, ' ')
  .replace(/\[[^\]]*]/g, ' ')
  .replace(/\([^)]*\)/g, ' ')
  .replace(/[｜|].*$/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const durationMatched = (target: number | null | undefined, candidateSeconds?: number, candidateMs?: number) => {
  if (!target) return true
  const candidate = candidateSeconds ?? (candidateMs ? Math.round(candidateMs / 1000) : undefined)
  if (!candidate) return true
  return Math.abs(target - candidate) < 8
}

const fetchJson = async<T>(url: string, headers?: Record<string, string>) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': BILI_USER_AGENT,
      ...headers,
    },
  })
  if (!response.ok) throw new Error(`歌词接口 HTTP ${response.status}`)
  return response.json() as Promise<T>
}

const getLrclibLyric = async(title: string, artist: string, duration: number | null | undefined) => {
  const url = new URL('https://lrclib.net/api/search')
  url.searchParams.set('q', [title, artist].filter(Boolean).join(' '))
  const list = await fetchJson<Array<{
    syncedLyrics?: string
    plainLyrics?: string
    trackName?: string
    artistName?: string
    duration?: number
  }>>(url.toString())
  const item = list.find(song => song.syncedLyrics && durationMatched(duration, song.duration)) ?? list.find(song => song.syncedLyrics)
  return item?.syncedLyrics?.trim() ?? ''
}

const getNeteaseLyric = async(title: string, artist: string, duration: number | null | undefined) => {
  const searchUrl = new URL('https://interface.music.163.com/api/search/get')
  searchUrl.searchParams.set('s', [title, artist].filter(Boolean).join(' '))
  searchUrl.searchParams.set('type', '1')
  searchUrl.searchParams.set('limit', '8')
  searchUrl.searchParams.set('offset', '0')
  const searchData = await fetchJson<any>(searchUrl.toString(), {
    Referer: 'https://music.163.com/',
    Origin: 'https://music.163.com',
  })
  const songs = searchData?.result?.songs || []
  const song = songs.find((item: any) => durationMatched(duration, undefined, item.duration)) || songs[0]
  if (!song?.id) return { lyric: '' }

  const lyricUrl = new URL('https://interface.music.163.com/api/song/lyric')
  lyricUrl.searchParams.set('id', String(song.id))
  lyricUrl.searchParams.set('tv', '-1')
  lyricUrl.searchParams.set('lv', '-1')
  lyricUrl.searchParams.set('rv', '-1')
  lyricUrl.searchParams.set('kv', '-1')
  lyricUrl.searchParams.set('_nmclfl', '1')
  const lyricData = await fetchJson<any>(lyricUrl.toString(), {
    Referer: 'https://music.163.com/',
    Origin: 'https://music.163.com',
  })

  return {
    lyric: lyricData?.lrc?.lyric?.trim() || lyricData?.klyric?.lyric?.trim() || '',
    tlyric: lyricData?.tlyric?.lyric?.trim() || undefined,
  }
}

const getExternalLyric = async({ title, artist, duration }: {
  title: string
  artist?: string
  duration?: number | null
}): Promise<LX.Music.LyricInfo> => {
  const cleanedTitle = stripSongDecorations(title)
  const cleanedArtist = stripSongDecorations(artist ?? '')
  const tasks = [
    getLrclibLyric(cleanedTitle, cleanedArtist, duration).then(lyric => ({ lyric })).catch(() => ({ lyric: '' })),
    getNeteaseLyric(cleanedTitle, cleanedArtist, duration).catch(() => ({ lyric: '' })),
  ]
  const results = await Promise.all(tasks)
  return results.find(item => item.lyric) ?? { lyric: '' }
}

const getExternalLyricCandidates = async({ titles, artist, duration }: {
  titles: Array<string | undefined | null>
  artist?: string
  duration?: number | null
}): Promise<LX.Music.LyricInfo> => {
  for (const title of uniqueTexts(titles)) {
    const result = await getExternalLyric({ title, artist, duration })
    if (result.lyric) return result
  }
  return { lyric: '' }
}
