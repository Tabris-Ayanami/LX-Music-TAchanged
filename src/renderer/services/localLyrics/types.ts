export type LyricsSource = 'qq' | 'netease' | 'kugou' | 'lrclib'

export interface LyricsWord {
  start: number | null
  end: number | null
  text: string
}

export interface LyricsLine {
  start: number | null
  end: number | null
  words: LyricsWord[]
}

export interface RichLyrics {
  source: LyricsSource
  lyric: string
  translatedLyric?: string
  romanizedLyric?: string
  wordByWordLyric?: string
  lines?: LyricsLine[]
}

export interface LyricsCandidate {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  source: LyricsSource
  sourceLabel: string
  score: number
  lyricType: string
  raw: unknown
}

export interface LyricsQuery {
  title: string
  artist: string
  album: string
  duration: number
}

export interface LyricsProvider {
  readonly id: LyricsSource
  readonly label: string
  search: (query: LyricsQuery) => Promise<LyricsCandidate[]>
  getLyrics: (candidate: LyricsCandidate) => Promise<RichLyrics>
}
