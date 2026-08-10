import type { LyricsCandidate, LyricsQuery } from './types'

const VERSION_WORDS = /\b(live|remaster(?:ed)?|instrumental|karaoke|acoustic|mono|stereo|radio edit|extended|mix|version|ver\.?|伴奏|纯音乐|现场|重制)\b/giu
const BRACKETS = /[（【［]/g
const BRACKETS_CLOSE = /[）】］]/g

export const normalizeText = (text: string) => text
  .normalize('NFKC')
  .replace(BRACKETS, '(')
  .replace(BRACKETS_CLOSE, ')')
  .replace(/[’'`]/g, '')
  .replace(/[\s\p{P}\p{S}]+/gu, ' ')
  .trim()
  .toLocaleLowerCase()

const bigrams = (value: string) => {
  const text = normalizeText(value).replace(/\s/g, '')
  if (text.length < 2) return text ? [text] : []
  return Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2))
}

const dice = (left: string, right: string) => {
  if (normalizeText(left) == normalizeText(right)) return 1
  const a = bigrams(left)
  const b = bigrams(right)
  if (!a.length || !b.length) return 0
  const counts = new Map<string, number>()
  for (const value of a) counts.set(value, (counts.get(value) ?? 0) + 1)
  let matches = 0
  for (const value of b) {
    const count = counts.get(value) ?? 0
    if (!count) continue
    matches++
    counts.set(value, count - 1)
  }
  return (2 * matches) / (a.length + b.length)
}

const splitArtists = (value: string) => normalizeText(value)
  .replace(/\b(?:feat(?:uring)?|ft)\.?\b/g, '/')
  .split(/[、,，;/&＋+]|\s+x\s+/)
  .map(item => item.trim())
  .filter(Boolean)

const artistScore = (left: string, right: string) => {
  const a = splitArtists(left)
  const b = splitArtists(right)
  if (!a.length || !b.length) return 0.55
  const scores = a.map(artist => Math.max(...b.map(candidate => dice(artist, candidate))))
  return scores.reduce((sum, score) => sum + score, 0) / Math.max(a.length, b.length)
}

const titleScore = (left: string, right: string) => {
  const normalizedLeft = normalizeText(left)
  const normalizedRight = normalizeText(right)
  const base = dice(normalizedLeft, normalizedRight)
  const leftVersions = Array.from(normalizedLeft.matchAll(VERSION_WORDS), match => match[0]).sort()
  const rightVersions = Array.from(normalizedRight.matchAll(VERSION_WORDS), match => match[0]).sort()
  const core = dice(normalizedLeft.replace(VERSION_WORDS, ''), normalizedRight.replace(VERSION_WORDS, ''))
  const versionPenalty = leftVersions.join('|') == rightVersions.join('|') ? 0 : 0.18
  return Math.max(base, core - versionPenalty)
}

const durationScore = (left: number, right: number) => {
  if (!left || !right) return 0.55
  const difference = Math.abs(left - right)
  if (difference <= 2) return 1
  if (difference <= 5) return 0.9
  if (difference <= 10) return 0.7
  if (difference <= 20) return 0.35
  return Math.max(0, 1 - difference / Math.max(left, right, 1) * 3)
}

export const scoreCandidate = (query: LyricsQuery, candidate: LyricsCandidate) => Math.round(Math.max(0, Math.min(100,
  titleScore(query.title, candidate.title) * 45 +
  artistScore(query.artist, candidate.artist) * 25 +
  durationScore(query.duration, candidate.duration) * 22 +
  (query.album && candidate.album ? dice(query.album, candidate.album) : 0.55) * 8,
)))

export const rankCandidates = (query: LyricsQuery, candidates: LyricsCandidate[]) => candidates
  .map(candidate => ({ ...candidate, score: scoreCandidate(query, candidate) }))
  .sort((a, b) => b.score - a.score || a.sourceLabel.localeCompare(b.sourceLabel))

export const canAutoApply = (candidates: LyricsCandidate[]) => {
  const first = candidates[0]
  if (!first) return false
  const second = candidates[1]
  return first.score >= 92 || (first.score >= 82 && (!second || first.score - second.score >= 8))
}
