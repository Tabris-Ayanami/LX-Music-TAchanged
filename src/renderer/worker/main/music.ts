import { getLocalMusicFileLyric, getLocalMusicFilePic } from '@renderer/utils/music'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { checkPath } from '@common/utils/nodejs'

const getTempDir = async(name = '') => {
  const tempDir = path.join(os.tmpdir(), 'lxmusic_temp', name)
  if (!await checkPath(tempDir)) {
    await fs.mkdir(tempDir, { recursive: true })
  }
  return tempDir
}

const getCoverCachePath = async(filePath: string, format: string) => {
  const stats = await fs.stat(filePath).catch(() => null)
  const ext = format.split('/')[1] || 'jpg'
  const hash = crypto
    .createHash('sha1')
    .update(`${filePath}:${stats?.mtimeMs ?? 0}:${stats?.size ?? 0}`)
    .digest('hex')
  return path.join(await getTempDir('covers'), `${hash}.${ext}`)
}

export const getMusicFilePic = async(filePath: string) => {
  const picture = await getLocalMusicFilePic(filePath)
  if (!picture) return ''
  if (typeof picture == 'string') return picture
  try {
    const cacheFile = await getCoverCachePath(filePath, picture.format)
    if (!await checkPath(cacheFile)) await fs.writeFile(cacheFile, picture.data)
    return cacheFile
  } catch (err) {
    console.log(err)
  }
  return `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`
}

export const parseLyric = (lrc: string): LX.Music.LyricInfo => {
  const verifyAwlrc = (lrc: string) => {
    return /(?:^|\s*)\[\d+:\d+(?:\.\d+)]<\d+,\d+>.+$/m.test(lrc)
  }
  const verifylrc = (lrc: string) => {
    return /(?:^|\s*)\[\d+:\d+(?:\.\d+)].+$/m.test(lrc)
  }
  const lrcTags = {
    awlrc: {
      name: 'lxlyric',
      verify: verifyAwlrc,
    },
    lrc: {
      name: 'lyric',
      verify: verifylrc,
    },
    tlrc: {
      name: 'tlyric',
      verify: verifylrc,
    },
    rlrc: {
      name: 'rlyric',
      verify: verifylrc,
    },
  } as const
  const tagRxp = /(?:^|\n\s*)\[awlrc:([^\]]+)]/i
  const lrcRxp = /^(lrc|awlrc|tlrc|rlrc):([^,]+)$/i
  const parse = (content: string) => {
    const lyricInfo: Partial<LX.Music.LyricInfo> = {}
    const lrcs = content.trim().split(',')
    for (const lrc of lrcs) {
      const result = lrcRxp.exec(lrc.trim())
      if (!result) continue
      const target = lrcTags[result[1].toLowerCase() as 'tlrc' | 'rlrc' | 'lrc' | 'awlrc']
      if (!target) continue
      const data = Buffer.from(result[2], 'base64').toString('utf-8').trim()
      if (target.verify(data)) lyricInfo[target.name] = data
    }
    return lyricInfo
  }
  let parsedInfo: Partial<LX.Music.LyricInfo> = {}
  let lyric = lrc.replace(tagRxp, (_: string, p1: string) => {
    parsedInfo = parse(p1)
    return ''
  }).trim()
  return { lyric, ...parsedInfo }
}


export const getMusicFileLyric = async(filePath: string): Promise<LX.Music.LyricInfo | null> => {
  const lyric = await getLocalMusicFileLyric(filePath)
  if (!lyric) return null
  return parseLyric(lyric.lyric)
}
