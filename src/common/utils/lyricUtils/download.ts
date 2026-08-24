const timeFieldExp = /^(?:\[[\d:.]+\])+/g
const timeExp = /\d{1,3}(:\d{1,3}){0,2}(?:\.\d{1,3})/g
const formatTime = (value: string) => value.replace(/^0+(\d+)/, '$1').replace(/:0+(\d+)/g, ':$1').replace(/\.0+(\d+)/, '.$1')

const labels = (lyric: string) => {
  const set = new Set<string>()
  for (const line of lyric.split(/\r\n|\n|\r/)) {
    const field = timeFieldExp.exec(line.trim())
    if (!field || !line.replace(timeFieldExp, '').trim()) continue
    for (const value of field[0].match(timeExp) ?? []) set.add(formatTime(value))
  }
  return set
}

const filterExtended = (set: Set<string>, lyric: string) => lyric.split(/\r\n|\n|\r/).map(line => {
  const field = timeFieldExp.exec(line.trim())
  if (!field) return ''
  const text = line.replace(timeFieldExp, '').trim()
  if (!text) return ''
  const times = field[0].match(timeExp) ?? []
  const kept = times.filter(time => set.has(formatTime(time)))
  return kept.length ? `[${kept.join('][')}]${text}` : ''
}).filter(Boolean).join('\n')

const buildAwlrc = (data: LX.Music.LyricInfo) => {
  const values = [
    data.lyric && `lrc:${Buffer.from(data.lyric.trim(), 'utf8').toString('base64')}`,
    data.tlyric && `tlrc:${Buffer.from(data.tlyric.trim(), 'utf8').toString('base64')}`,
    data.rlyric && `rlrc:${Buffer.from(data.rlyric.trim(), 'utf8').toString('base64')}`,
    data.lxlyric && `awlrc:${Buffer.from(data.lxlyric.trim(), 'utf8').toString('base64')}`,
  ].filter(Boolean)
  return values.length ? `[awlrc:${values.join(',')}]` : ''
}

export const buildDownloadLyrics = (data: LX.Music.LyricInfo, downloadAwlrc: boolean, downloadTlrc: boolean, downloadRlrc: boolean) => {
  if (!data.tlyric && !data.rlyric && !data.lxlyric) return data.lyric
  const set = labels(data.lyric)
  let lyric = data.lyric
  if (downloadTlrc && data.tlyric) lyric = lyric.trim() + `\n\n${filterExtended(set, data.tlyric)}\n`
  if (downloadRlrc && data.rlyric) lyric = lyric.trim() + `\n\n${filterExtended(set, data.rlyric)}\n`
  if (downloadAwlrc) {
    const awlrc = buildAwlrc(data)
    if (awlrc) lyric = lyric.trim() + `\n\n${awlrc}\n`
  }
  return lyric
}
