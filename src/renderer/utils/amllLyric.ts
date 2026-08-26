import type { LyricLine, LyricWord } from '@applemusic-like-lyrics/core'

const timeFieldExp = /^(?:\[[\d:.]+\])+/g
const timeExp = /\d{1,3}(:\d{1,3}){0,2}(?:\.\d{1,3})/g
const wordTagExp = /<(\d+),(\d+)>/g

interface LrcEntry {
  time: number
  text: string
  key: string
}

interface ParsedWordSegments {
  words: LyricWord[]
  hasWordTiming: boolean
}

interface AmllLyricConvertOptions {
  lrc: string | null
  tlrc: string | null
  rlrc: string | null
  lxlrc: string | null
  useLxlrc: boolean
  showTranslation: boolean
  showRoma: boolean
  swapTranslationAndRoma: boolean
}

const formatTimeLabel = (label: string) => label
  .replace(/^0+(\d+)/, '$1')
  .replace(/:0+(\d+)/g, ':$1')
  .replace(/\.0+(\d+)/, '.$1')

const parseTime = (label: string) => {
  const parts = label.split(':')
  if (parts.length > 3) return -1
  while (parts.length < 3) parts.unshift('0')
  if (parts[2].includes('.')) parts.splice(2, 1, ...parts[2].split('.'))
  return Number(parts[0]) * 60 * 60 * 1000 +
    Number(parts[1]) * 60 * 1000 +
    Number(parts[2]) * 1000 +
    Number(parts[3] ?? 0)
}

const parseLrcEntries = (source: string | null | undefined): Map<string, LrcEntry> => {
  const result = new Map<string, LrcEntry>()
  if (!source) return result

  for (const rawLine of source.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim()
    const timeField = timeFieldExp.exec(line)?.[0]
    if (!timeField) continue
    const text = line.replace(timeFieldExp, '').trim()
    if (!text || text == '//') continue

    const labels = timeField.match(timeExp)
    if (!labels) continue
    for (const label of labels) {
      const timeKey = formatTimeLabel(label)
      if (result.has(timeKey)) continue
      const time = parseTime(label)
      if (time < 0) continue
      result.set(timeKey, { time, text, key: timeKey })
    }
  }

  return result
}

const parseExtendedEntries = (source: string | null | undefined): Map<string, string[]> => {
  const result = new Map<string, string[]>()
  if (!source) return result

  for (const rawLine of source.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim()
    const timeField = timeFieldExp.exec(line)?.[0]
    if (!timeField) continue
    const text = line.replace(timeFieldExp, '').trim()
    if (!text || text == '//') continue

    const labels = timeField.match(timeExp)
    if (!labels) continue
    for (const label of labels) {
      const timeKey = formatTimeLabel(label)
      const values = result.get(timeKey) ?? []
      values.push(text)
      result.set(timeKey, values)
    }
  }

  return result
}

const parseWordSegments = (text: string, lineTime: number): ParsedWordSegments => {
  const matches = [...text.matchAll(wordTagExp)]
  if (!matches.length) {
    return {
      hasWordTiming: false,
      words: [{ word: text, startTime: lineTime, endTime: lineTime + 4000 }],
    }
  }

  const firstStart = Number(matches[0][1])
  const usesAbsoluteTime = lineTime > 1500 && firstStart > lineTime - 1200
  const words: LyricWord[] = []

  matches.forEach((match, index) => {
    let start = Number(match[1])
    const duration = Math.max(80, Number(match[2]))
    const textStart = match.index + match[0].length
    const textEnd = matches[index + 1]?.index ?? text.length
    const word = text.slice(textStart, textEnd)
    if (!word) return
    if (usesAbsoluteTime) start = Math.max(0, start - lineTime)
    words.push({
      word,
      startTime: lineTime + start,
      endTime: lineTime + start + duration,
    })
  })

  return {
    hasWordTiming: true,
    words: words.length ? words : [{ word: text, startTime: lineTime, endTime: lineTime + 4000 }],
  }
}

const joinExtended = (values: string[] | undefined) => values?.length ? values.join('\n') : ''

export const toAmllLyricLines = (options: AmllLyricConvertOptions): LyricLine[] => {
  const mainSource = options.useLxlrc && options.lxlrc ? options.lxlrc : options.lrc
  if (!mainSource) return []

  const mainEntries = parseLrcEntries(mainSource)
  const translationEntries = options.showTranslation
    ? parseExtendedEntries(options.tlrc)
    : new Map<string, string[]>()
  const romanEntries = options.showRoma
    ? parseExtendedEntries(options.rlrc)
    : new Map<string, string[]>()

  const lines = [...mainEntries.values()].sort((a, b) => a.time - b.time)
  return lines.map((entry, index) => {
    const nextTime = lines[index + 1]?.time
    const { words, hasWordTiming } = parseWordSegments(entry.text, entry.time)

    if (!hasWordTiming && words.length == 1) {
      const fallbackEnd = entry.time + 4000
      words[0].endTime = nextTime == null
        ? fallbackEnd
        : Math.max(nextTime, entry.time + 300)
    }

    const lineEnd = words.length ? words[words.length - 1].endTime : (nextTime ?? entry.time + 4000)
    let translatedLyric = joinExtended(translationEntries.get(entry.key))
    let romanLyric = joinExtended(romanEntries.get(entry.key))

    if (options.swapTranslationAndRoma) {
      const temp = translatedLyric
      translatedLyric = romanLyric
      romanLyric = temp
    }

    return {
      words,
      translatedLyric,
      romanLyric,
      startTime: entry.time,
      endTime: lineEnd,
      isBG: false,
      isDuet: false,
    }
  })
}
