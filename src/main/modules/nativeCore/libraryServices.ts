import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { formatPlayTime } from '@common/utils/common'
import { readMetadataForLibrary } from './mediaServices'
import { getNativeCoreSupervisor } from './supervisor'

const LOCAL_MEDIA_EXTS = new Set(['.mp3', '.flac', '.ogg', '.oga', '.wav', '.m4a'])

const scanWithElectron = async(folders: string[]) => {
  const files: string[] = []
  const pending = [...folders]
  while (pending.length) {
    const folder = pending.pop()!
    let entries
    try {
      entries = await readdir(folder, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      continue
    }
    for (const entry of entries) {
      const filePath = path.join(folder, entry.name)
      if (entry.isDirectory()) pending.push(filePath)
      else if (entry.isFile() && LOCAL_MEDIA_EXTS.has(path.extname(entry.name).toLowerCase())) files.push(filePath)
    }
  }
  return Array.from(new Map(files.map(filePath => [path.normalize(filePath).toLowerCase(), path.normalize(filePath)])).values())
}

export const scanLocalMusicFiles = async(folders: string[]) => {
  try {
    return await getNativeCoreSupervisor().call<string[]>('library.scan', { folders })
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'library_native_fallback',
      component: 'native-core',
      message: error instanceof Error ? error.message : String(error),
    }))
    return scanWithElectron(folders)
  }
}

const createLocalMusicInfo = async(filePath: string): Promise<LX.Music.MusicInfoLocal | null> => {
  try {
    const metadata = await readMetadataForLibrary(filePath)
    const extension = path.extname(filePath)
    const title = (metadata.title || path.basename(filePath, extension)).trim()
    return {
      id: filePath,
      name: title,
      singer: metadata.artists.map(artist => artist.trim()).filter(Boolean).join('、'),
      source: 'local',
      interval: metadata.duration ? formatPlayTime(metadata.duration) : '',
      meta: {
        albumName: metadata.album.trim(),
        filePath,
        songId: filePath,
        picUrl: '',
        ext: extension.replace(/^\./, ''),
      },
    }
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', event: 'library_metadata_failed', component: 'native-core', filePath, message: error instanceof Error ? error.message : String(error) }))
    return null
  }
}

export const createLocalMusicInfos = async(filePaths: string[]) => {
  const concurrency = Math.min(4, Math.max(filePaths.length, 1))
  const results: Array<LX.Music.MusicInfoLocal | null> = Array(filePaths.length).fill(null)
  let nextIndex = 0
  const runWorker = async() => {
    while (nextIndex < filePaths.length) {
      const index = nextIndex++
      results[index] = await createLocalMusicInfo(filePaths[index])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runWorker))
  return results.filter((musicInfo): musicInfo is LX.Music.MusicInfoLocal => musicInfo != null)
}
