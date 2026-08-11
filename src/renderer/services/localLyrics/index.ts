import { saveLyric } from '@renderer/utils/ipc'
import { backend } from '@renderer/backend'
import { setMusicInfo } from '@renderer/store/player/action'
import { playMusicInfo } from '@renderer/store/player/state'
import { rankCandidates } from './matching'
import { lyricsProviders } from './providers'
import type { LyricsCandidate, LyricsQuery, RichLyrics } from './types'

const getDuration = (track: LX.Music.MusicInfoLocal) => {
  if (!track.interval) return 0
  return track.interval.split(':').reduce((total, part) => total * 60 + (Number(part) || 0), 0)
}

export const getLyricsQuery = (track: LX.Music.MusicInfoLocal): LyricsQuery => ({
  title: track.name,
  artist: track.singer,
  album: track.meta.albumName,
  duration: getDuration(track),
})

export const searchLocalLyrics = async(track: LX.Music.MusicInfoLocal) => {
  const query = getLyricsQuery(track)
  const results = await Promise.allSettled(lyricsProviders.map(async provider => provider.search(query)))
  const candidates = results.flatMap(result => result.status == 'fulfilled' ? result.value : [])
  if (!candidates.length) {
    const failures = results.filter(result => result.status == 'rejected')
    throw new Error(failures.length == results.length ? '所有歌词源均请求失败，请稍后重试' : '没有搜索到匹配歌词')
  }
  return rankCandidates(query, candidates)
}

export const fetchCandidateLyrics = async(candidate: LyricsCandidate) => {
  const provider = lyricsProviders.find(provider => provider.id == candidate.source)
  if (!provider) throw new Error('歌词源不可用')
  return provider.getLyrics(candidate)
}

const buildEmbeddedLyric = (lyrics: RichLyrics) => {
  const richParts = [
    lyrics.lyric ? `lrc:${Buffer.from(lyrics.lyric).toString('base64')}` : '',
    lyrics.translatedLyric ? `tlrc:${Buffer.from(lyrics.translatedLyric).toString('base64')}` : '',
    lyrics.romanizedLyric ? `rlrc:${Buffer.from(lyrics.romanizedLyric).toString('base64')}` : '',
    lyrics.wordByWordLyric ? `awlrc:${Buffer.from(lyrics.wordByWordLyric).toString('base64')}` : '',
  ].filter(Boolean)
  return richParts.length ? `${lyrics.lyric.trim()}\n\n[awlrc:${richParts.join(',')}]\n` : lyrics.lyric
}

export const applyLocalLyrics = async(track: LX.Music.MusicInfoLocal, lyrics: RichLyrics) => {
  const lyricInfo: LX.Music.LyricInfo = {
    lyric: lyrics.lyric,
    tlyric: lyrics.translatedLyric ?? '',
    rlyric: lyrics.romanizedLyric ?? '',
    lxlyric: lyrics.wordByWordLyric ?? '',
  }
  await Promise.all([
    saveLyric(track, lyricInfo),
    backend.metadata.writeEmbeddedLyrics({ filePath: track.meta.filePath, lyric: buildEmbeddedLyric(lyrics) }),
  ])
  if (playMusicInfo.musicInfo?.id == track.id) {
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric ?? '',
      rlrc: lyricInfo.rlyric ?? '',
      lxlrc: lyricInfo.lxlyric ?? '',
      rawlrc: lyricInfo.lyric,
    })
    window.app_event.lyricUpdated()
  }
  return lyricInfo
}

export type { LyricsCandidate, RichLyrics } from './types'
export { canAutoApply } from './matching'
