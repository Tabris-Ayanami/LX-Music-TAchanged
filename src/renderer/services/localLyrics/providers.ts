import musicSdk from '@renderer/utils/musicSdk'
import type { LyricsCandidate, LyricsProvider, LyricsQuery, LyricsSource, RichLyrics } from './types'

const parseInterval = (value: unknown) => {
  if (typeof value == 'number') return value
  if (typeof value != 'string') return 0
  return value.split(':').reduce((total, part) => total * 60 + (Number(part) || 0), 0)
}

const lyricType = (lyrics: Partial<LX.Music.LyricInfo>) => [
  lyrics.lxlyric ? '逐字' : lyrics.lyric ? '逐行' : '纯文本',
  lyrics.tlyric ? '翻译' : '',
  lyrics.rlyric ? '罗马音' : '',
].filter(Boolean).join(' / ')

class LxSdkProvider implements LyricsProvider {
  constructor(
    readonly id: LyricsSource,
    readonly label: string,
    private readonly sdkSource: 'tx' | 'wy' | 'kg',
  ) {}

  async search(query: LyricsQuery): Promise<LyricsCandidate[]> {
    const sdk = (musicSdk as any)[this.sdkSource]
    const result = await sdk.musicSearch.search(`${query.title} ${query.artist}`.trim(), 1, 20)
    return (result?.list ?? []).map((item: any): LyricsCandidate => ({
      id: `${this.id}:${item.songmid ?? item.hash ?? item.songId}`,
      title: String(item.name ?? ''),
      artist: String(item.singer ?? ''),
      album: String(item.albumName ?? ''),
      duration: parseInterval(item._interval ?? item.interval),
      source: this.id,
      sourceLabel: this.label,
      score: 0,
      lyricType: this.id == 'qq' ? '逐字 / 翻译 / 罗马音（视曲目）' : this.id == 'netease' ? '逐字 / 翻译 / 罗马音（视曲目）' : '逐字 / 翻译（视曲目）',
      raw: item,
    }))
  }

  async getLyrics(candidate: LyricsCandidate): Promise<RichLyrics> {
    const sdk = (musicSdk as any)[this.sdkSource]
    const request = sdk.getLyric(candidate.raw)
    const lyrics: LX.Music.LyricInfo = await (request?.promise ?? request)
    if (!lyrics?.lyric) throw new Error(`${this.label}未返回有效歌词`)
    candidate.lyricType = lyricType(lyrics)
    return {
      source: this.id,
      lyric: lyrics.lyric,
      translatedLyric: lyrics.tlyric ?? '',
      romanizedLyric: lyrics.rlyric ?? '',
      wordByWordLyric: lyrics.lxlyric ?? '',
    }
  }
}

interface LrcLibItem {
  id: number
  trackName: string
  artistName: string
  albumName: string
  duration: number
  instrumental: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

class LrcLibProvider implements LyricsProvider {
  readonly id = 'lrclib' as const
  readonly label = 'LRCLIB'

  async search(query: LyricsQuery): Promise<LyricsCandidate[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => { controller.abort() }, 12_000)
    try {
      const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${query.title} ${query.artist}`)}`, {
        headers: { 'Lrclib-Client': 'LX-TA/2.0.1 (https://github.com/Tabris-Ayanami/LX-Music-TAchanged)' },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`LRCLIB 请求失败 (${response.status})`)
      const items = await response.json() as LrcLibItem[]
      return items.slice(0, 20).map(item => ({
        id: `${this.id}:${item.id}`,
        title: item.trackName,
        artist: item.artistName,
        album: item.albumName ?? '',
        duration: item.duration ?? 0,
        source: this.id,
        sourceLabel: this.label,
        score: 0,
        lyricType: item.syncedLyrics ? '逐行' : item.plainLyrics ? '纯文本' : '无歌词',
        raw: item,
      }))
    } finally {
      clearTimeout(timeout)
    }
  }

  async getLyrics(candidate: LyricsCandidate): Promise<RichLyrics> {
    const item = candidate.raw as LrcLibItem
    const lyric = item.syncedLyrics ? item.syncedLyrics : item.plainLyrics ?? ''
    if (!lyric) throw new Error('LRCLIB 未返回有效歌词')
    return { source: this.id, lyric }
  }
}

export const lyricsProviders: LyricsProvider[] = [
  new LxSdkProvider('qq', 'QQ 音乐', 'tx'),
  new LxSdkProvider('netease', '网易云音乐', 'wy'),
  new LxSdkProvider('kugou', '酷狗音乐', 'kg'),
  new LrcLibProvider(),
]
