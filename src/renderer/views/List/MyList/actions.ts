import { showSelectDialog } from '@renderer/utils/ipc'
import {
  LOCAL_MUSIC_LIST_ID,
  addLocalMusicLibraryFolders,
  collectLocalMusicFilesFromFolders,
  importLocalMusicFiles,
} from '@renderer/utils/localMusic'

const handleImportLocalPaths = async(listInfo: LX.List.MyListInfo, filePaths: string[]) => {
  if (!filePaths.length) return
  await importLocalMusicFiles(listInfo.id, filePaths)
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

  if (listInfo.id == LOCAL_MUSIC_LIST_ID) addLocalMusicLibraryFolders(filePaths)
  const nestedFiles = await collectLocalMusicFilesFromFolders(filePaths)
  await handleImportLocalPaths(listInfo, nestedFiles)
}
