import { readdir } from 'node:fs/promises'
import path from 'node:path'
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
