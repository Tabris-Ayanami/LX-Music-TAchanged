import { addListMusics, setFetchingListStatus } from '@renderer/store/list/action'
import { showSelectDialog } from '@renderer/utils/ipc'
import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const LOCAL_MEDIA_EXTS = new Set(['.mp3', '.flac', '.ogg', '.oga', '.wav', '.m4a'])
interface LocalDirEntry {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
}

const handleAddMusics = async(listId: string, filePaths: string[], index: number = -1) => {
  // console.log(index + 1, index + 201)
  const paths = filePaths.slice(index + 1, index + 201)
  const musicInfos = await window.lx.worker.main.createLocalMusicInfos(paths)
  if (musicInfos.length) await addListMusics(listId, musicInfos)
  index += 200
  if (filePaths.length - 1 > index) await handleAddMusics(listId, filePaths, index)
}

const collectMusicFilesFromDir = async(dirPath: string): Promise<string[]> => {
  const result: string[] = []
  let entries: LocalDirEntry[]
  try {
    entries = await readdir(dirPath, { withFileTypes: true, encoding: 'utf8' }) as unknown as LocalDirEntry[]
  } catch {
    return result
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      result.push(...await collectMusicFilesFromDir(fullPath))
      continue
    }
    if (!entry.isFile()) continue
    if (!LOCAL_MEDIA_EXTS.has(extname(entry.name).toLowerCase())) continue
    result.push(fullPath)
  }

  return result
}

const handleImportLocalPaths = async(listInfo: LX.List.MyListInfo, filePaths: string[]) => {
  if (!filePaths.length) return
  const uniquePaths = [...new Set(filePaths)]
  setFetchingListStatus(listInfo.id, true)
  try {
    await handleAddMusics(listInfo.id, uniquePaths)
  } finally {
    setFetchingListStatus(listInfo.id, false)
  }
}

export const addLocalFile = async(listInfo: LX.List.MyListInfo) => {
  const { canceled, filePaths } = await showSelectDialog({
    title: window.i18n.t('lists__add_local_file_desc'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      // https://support.google.com/chromebook/answer/183093
      // 3gp, .avi, .mov, .m4v, .m4a, .mp3, .mkv, .ogm, .ogg, .oga, .webm, .wav
      { name: 'Media File', extensions: ['mp3', 'flac', 'ogg', 'oga', 'wav', 'm4a'] },
      // { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return

  await handleImportLocalPaths(listInfo, filePaths)
}

export const addLocalFolder = async(listInfo: LX.List.MyListInfo) => {
  const { canceled, filePaths } = await showSelectDialog({
    title: '选择要导入的文件夹',
    properties: ['openDirectory', 'multiSelections'],
  })
  if (canceled || !filePaths.length) return

  const nestedFiles = (await Promise.all(filePaths.map(async path => collectMusicFilesFromDir(path)))).flat()
  await handleImportLocalPaths(listInfo, nestedFiles)
}
