import { copyFile, chmod, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { extname, parse } from 'node:path'
import { randomUUID } from 'node:crypto'
import { decodeKrc } from '@common/utils/lyricUtils/kg'

import type { TagInput, TagLib as TagLibClass } from 'taglib-wasm'
import type * as TagLibSimpleModule from 'taglib-wasm/simple'

type TagLibSimple = typeof TagLibSimpleModule

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.oga', '.opus', '.wav', '.ape', '.wv', '.aiff', '.aif', '.tta', '.wma',
])

let tagLibPromise: Promise<TagLibSimple> | null = null
let tagLibFullPromise: Promise<InstanceType<typeof TagLibClass>> | null = null

const loadTagLib = async() => {
  tagLibPromise ??= import(/* webpackIgnore: true */ 'taglib-wasm/simple')
  return tagLibPromise
}

const loadFullTagLib = async() => {
  tagLibFullPromise ??= import(/* webpackIgnore: true */ 'taglib-wasm').then(async({ TagLib }) => TagLib.initialize())
  return tagLibFullPromise
}

const first = (value?: string[]) => value?.[0] ?? ''

const toDataUrl = (data: Uint8Array | undefined, mimeType = 'image/jpeg') => {
  return data?.length ? `data:${mimeType};base64,${Buffer.from(data).toString('base64')}` : ''
}

const assertSupportedFile = async(filePath: string) => {
  if (!filePath || !SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())) throw new Error('不支持的音频格式')
  const info = await stat(filePath)
  if (!info.isFile() || info.size < 32) throw new Error('音频文件不存在或无效')
  return info
}

export const readLocalMetadata = async(filePath: string): Promise<LX.LocalMusic.Metadata> => {
  await assertSupportedFile(filePath)
  const taglib = await loadTagLib()
  const [metadata, cover, pictures] = await Promise.all([
    taglib.readMetadata(filePath),
    taglib.readCoverArt(filePath),
    taglib.readPictureMetadata(filePath),
  ])
  const { tags, properties } = metadata
  return {
    filePath,
    format: properties?.containerFormat ?? extname(filePath).slice(1).toUpperCase(),
    title: first(tags.title),
    artists: tags.artist ?? [],
    album: first(tags.album),
    albumArtists: tags.albumArtist ?? [],
    trackNumber: tags.track ?? 0,
    totalTracks: tags.totalTracks ?? 0,
    discNumber: tags.discNumber ?? 0,
    totalDiscs: tags.totalDiscs ?? 0,
    year: tags.year ?? 0,
    genre: tags.genre ?? [],
    comment: first(tags.comment),
    composer: tags.composer ?? [],
    coverDataUrl: toDataUrl(cover, pictures[0]?.mimeType),
    duration: properties?.duration ?? 0,
    bitrate: properties?.bitrate ?? 0,
    sampleRate: properties?.sampleRate ?? 0,
  }
}

const parseCover = (dataUrl: string) => {
  const matched = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/i.exec(dataUrl)
  if (!matched) throw new Error('封面数据无效')
  const data = Buffer.from(matched[2], 'base64')
  if (!data.length || data.length > 30 * 1024 * 1024) throw new Error('封面大小无效')
  return { mimeType: matched[1], data }
}

const normalizeTextList = (values: string[]) => values.map(value => value.trim()).filter(Boolean)

const verifyTags = (actual: LX.LocalMusic.Metadata, expected: LX.LocalMusic.MetadataWriteRequest['metadata']) => {
  const checks: Array<[string, unknown, unknown]> = [
    ['标题', actual.title, expected.title],
    ['艺术家', actual.artists.join('\u0000'), normalizeTextList(expected.artists).join('\u0000')],
    ['专辑', actual.album, expected.album],
    ['专辑艺术家', actual.albumArtists.join('\u0000'), normalizeTextList(expected.albumArtists).join('\u0000')],
    ['Track Number', actual.trackNumber, expected.trackNumber],
    ['Disc Number', actual.discNumber, expected.discNumber],
    ['年份', actual.year, expected.year],
    ['Genre', actual.genre.join('\u0000'), normalizeTextList(expected.genre).join('\u0000')],
    ['Comment', actual.comment, expected.comment],
  ]
  const failed = checks.find(([, actualValue, expectedValue]) => actualValue !== expectedValue)
  if (failed) throw new Error(`${failed[0]}写入后校验失败`)
}

export const writeLocalMetadata = async(request: LX.LocalMusic.MetadataWriteRequest): Promise<LX.LocalMusic.Metadata> => {
  const originalInfo = await assertSupportedFile(request.filePath)
  const taglib = await loadTagLib()
  const parsedPath = parse(request.filePath)
  const token = `${process.pid}-${randomUUID()}`
  const tempPath = `${parsedPath.dir}\\.${parsedPath.name}.lxmeta-${token}${parsedPath.ext}`
  const backupPath = `${parsedPath.dir}\\.${parsedPath.name}.lxmeta-backup-${token}${parsedPath.ext}`
  let backupCreated = false

  try {
    await copyFile(request.filePath, tempPath)
    await chmod(tempPath, originalInfo.mode)
    const metadata = request.metadata
    const tags: Partial<TagInput> = {
      title: metadata.title.trim(),
      artist: normalizeTextList(metadata.artists),
      album: metadata.album.trim(),
      albumArtist: normalizeTextList(metadata.albumArtists),
      track: Math.max(0, metadata.trackNumber || 0),
      totalTracks: Math.max(0, metadata.totalTracks || 0),
      discNumber: Math.max(0, metadata.discNumber || 0),
      totalDiscs: Math.max(0, metadata.totalDiscs || 0),
      year: Math.max(0, metadata.year || 0),
      genre: normalizeTextList(metadata.genre),
      comment: metadata.comment.trim(),
      composer: normalizeTextList(metadata.composer),
    }
    await taglib.applyTagsToFile(tempPath, tags)

    if (request.coverChanged) {
      const cover = metadata.coverDataUrl ? parseCover(metadata.coverDataUrl) : null
      const changedFile = cover
        ? await taglib.applyCoverArt(tempPath, cover.data, cover.mimeType)
        : await taglib.clearPictures(tempPath)
      await writeFile(tempPath, changedFile)
    }

    const verified = await readLocalMetadata(tempPath)
    if (!verified.duration || (request.metadata.duration && Math.abs(verified.duration - request.metadata.duration) > 1.5)) {
      throw new Error('写入后音频时长校验失败')
    }
    verifyTags(verified, request.metadata)

    await rename(request.filePath, backupPath)
    backupCreated = true
    try {
      await rename(tempPath, request.filePath)
    } catch (error) {
      await rename(backupPath, request.filePath)
      backupCreated = false
      throw error
    }
    await rm(backupPath, { force: true })
    backupCreated = false
    return readLocalMetadata(request.filePath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => {})
    if (backupCreated) {
      const originalExists = await stat(request.filePath).then(() => true).catch(() => false)
      if (!originalExists) await rename(backupPath, request.filePath).catch(() => {})
    }
  }
}

export const readLocalEmbeddedLyrics = async(filePath: string) => {
  await assertSupportedFile(filePath)
  const taglib = await loadTagLib()
  const { tags } = await taglib.readMetadata(filePath)
  return tags.lyrics?.map(item => item.text.trim()).find(Boolean) ?? ''
}

const parseLyricText = (value: string): LX.Music.LyricInfo => {
  const verifyAwlrc = (text: string) => /(?:^|\s*)\[\d+:\d+(?:\.\d+)]<\d+,\d+>.+$/m.test(text)
  const verifyLrc = (text: string) => /(?:^|\s*)\[\d+:\d+(?:\.\d+)].+$/m.test(text)
  const lyricTags = {
    awlrc: { name: 'lxlyric', verify: verifyAwlrc },
    lrc: { name: 'lyric', verify: verifyLrc },
    tlrc: { name: 'tlyric', verify: verifyLrc },
    rlrc: { name: 'rlyric', verify: verifyLrc },
  } as const
  const tagRxp = /(?:^|\n\s*)\[awlrc:([^\]]+)]/i
  const lrcRxp = /^(lrc|awlrc|tlrc|rlrc):([^,]+)$/i
  let parsedInfo: Partial<LX.Music.LyricInfo> = {}
  const lyric = value.replace(tagRxp, (_match, content: string) => {
    for (const item of content.trim().split(',')) {
      const result = lrcRxp.exec(item.trim())
      if (!result) continue
      const target = lyricTags[result[1].toLowerCase() as keyof typeof lyricTags]
      if (!target) continue
      const data = Buffer.from(result[2], 'base64').toString('utf8').trim()
      if (target.verify(data)) parsedInfo[target.name] = data
    }
    return ''
  }).trim()
  return { lyric, ...parsedInfo }
}

export const readLocalLyrics = async(filePath: string): Promise<LX.Music.LyricInfo | null> => {
  const parsedPath = parse(filePath)
  const lrcPath = `${parsedPath.dir}\\${parsedPath.name}.lrc`
  const lrcInfo = await stat(lrcPath).catch(() => null)
  if (lrcInfo?.isFile() && lrcInfo.size < 10 * 1024 * 1024) {
    const data = await readFile(lrcPath)
    const { detect } = await import('jschardet')
    const { confidence, encoding } = detect(data)
    if (confidence > 0.8 && encoding) {
      const iconv = (await import('iconv-lite')).default
      if (iconv.encodingExists(encoding)) {
        const lyric = iconv.decode(data, encoding)
        if (lyric) return parseLyricText(lyric)
      }
    }
  }
  const krcPath = `${parsedPath.dir}\\${parsedPath.name}.krc`
  const krcInfo = await stat(krcPath).catch(() => null)
  if (krcInfo?.isFile() && krcInfo.size < 10 * 1024 * 1024) {
    try { return await decodeKrc(await readFile(krcPath)) as LX.Music.LyricInfo } catch {}
  }
  const lyric = await readLocalEmbeddedLyrics(filePath).catch(() => '')
  return lyric ? parseLyricText(lyric) : null
}

export const writeLocalEmbeddedLyrics = async({ filePath, lyric }: LX.LocalMusic.EmbeddedLyricsWriteRequest) => {
  const originalInfo = await assertSupportedFile(filePath)
  const originalMetadata = await readLocalMetadata(filePath)
  if (!lyric.trim()) throw new Error('歌词内容为空')
  const parsedPath = parse(filePath)
  const token = `${process.pid}-${randomUUID()}`
  const tempPath = `${parsedPath.dir}\\.${parsedPath.name}.lxlyrics-${token}${parsedPath.ext}`
  const backupPath = `${parsedPath.dir}\\.${parsedPath.name}.lxlyrics-backup-${token}${parsedPath.ext}`
  let backupCreated = false
  try {
    await copyFile(filePath, tempPath)
    await chmod(tempPath, originalInfo.mode)
    const taglib = await loadFullTagLib()
    await taglib.edit(tempPath, file => { file.setLyrics([{ text: lyric.trim(), description: 'LX-TA synchronized lyrics' }]) })

    const [verifiedLyric, verifiedMetadata] = await Promise.all([
      readLocalEmbeddedLyrics(tempPath),
      readLocalMetadata(tempPath),
    ])
    if (verifiedLyric.trim() != lyric.trim()) throw new Error('歌词写入后校验失败')
    if (!verifiedMetadata.duration || Math.abs(verifiedMetadata.duration - originalMetadata.duration) > 1.5) {
      throw new Error('歌词写入后音频时长校验失败')
    }

    await rename(filePath, backupPath)
    backupCreated = true
    try {
      await rename(tempPath, filePath)
    } catch (error) {
      await rename(backupPath, filePath)
      backupCreated = false
      throw error
    }
    await rm(backupPath, { force: true })
    backupCreated = false
    return readLocalEmbeddedLyrics(filePath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => {})
    if (backupCreated) {
      const originalExists = await stat(filePath).then(() => true).catch(() => false)
      if (!originalExists) await rename(backupPath, filePath).catch(() => {})
    }
  }
}

export const readLocalCoverFile = async(filePath: string) => {
  const info = await stat(filePath)
  if (!info.isFile() || !info.size || info.size > 30 * 1024 * 1024) throw new Error('封面文件大小无效')
  const ext = extname(filePath).toLowerCase()
  const mimeType = ext == '.png' ? 'image/png' : ext == '.webp' ? 'image/webp' : ext == '.gif' ? 'image/gif' : ext == '.avif' ? 'image/avif' : 'image/jpeg'
  return toDataUrl(await readFile(filePath), mimeType)
}
