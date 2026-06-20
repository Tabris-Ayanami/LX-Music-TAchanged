import { reactive } from '@common/utils/vueTools'

export interface Line {
  text: string
  time: number
  extendedLyrics: string[]
  dom_line: HTMLDivElement
}

export const lyric = reactive<{
  lines: Line[]
  text: string
  line: number
  offset: number // 歌词延迟
  tempOffset: number // 歌词临时延迟
}>({
  lines: [],
  text: '',
  line: 0,
  offset: 0, // 歌词延迟
  tempOffset: 0, // 歌词临时延迟
})

export const setLines = (lines: Line[]) => {
  if (!lines.length && !lyric.lines.length) return
  lyric.lines = lines
}
const normalizeLyricText = (text: unknown) => {
  if (typeof text == 'string') return text
  if (text == null) return ''
  if (typeof text == 'object' && 'text' in text) {
    const lineText = (text as { text?: unknown }).text
    return typeof lineText == 'string' ? lineText : lineText == null ? '' : String(lineText)
  }
  return String(text)
}
export const setText = (text: string | Line, line: number) => {
  lyric.text = normalizeLyricText(text)
  lyric.line = line
}
export const setOffset = (offset: number) => {
  lyric.offset = offset
}
export const setTempOffset = (offset: number) => {
  lyric.tempOffset = offset
}
