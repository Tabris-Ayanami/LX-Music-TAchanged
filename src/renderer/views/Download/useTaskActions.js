import { useRouter } from '@common/utils/vueRouter'
import { openUrl } from '@common/utils/electron'
import { checkPath } from '@common/utils/nodejs'
// import { dialog } from '@renderer/plugins/Dialog'
// import { useI18n } from '@renderer/plugins/i18n'
// import { appSetting } from '@renderer/store/setting'
import { toOldMusicInfo } from '@renderer/utils/index'
import { startDownloadTasks, pauseDownloadTasks, removeDownloadTasks } from '@renderer/store/download/action'
import { openDirInExplorer } from '@renderer/utils/ipc'

let musicSdkPromise = null

const getMusicSdk = async() => {
  musicSdkPromise ||= import('@renderer/utils/musicSdk').then(({ default: musicSdk }) => musicSdk)
  return musicSdkPromise
}

export default ({ list, selectedList, removeAllSelect }) => {
  const router = useRouter()
  // const t = useI18n()

  const handleSearch = index => {
    const info = list.value[index].metadata.musicInfo
    router.push({
      path: '/search',
      query: {
        text: `${info.name} ${info.singer}`,
      },
    })
  }

  const handleOpenMusicDetail = async(index) => {
    const task = list.value[index]
    const mInfo = toOldMusicInfo(task.metadata.musicInfo)
    const musicSdk = await getMusicSdk()
    const url = musicSdk[mInfo.source]?.getMusicDetailPageUrl?.(mInfo)
    if (!url) return
    openUrl(url)
  }

  const handleStartTask = async(index, single) => {
    if (selectedList.value.length && !single) {
      startDownloadTasks([...selectedList.value])
      removeAllSelect()
    } else {
      startDownloadTasks([list.value[index]])
    }
  }

  const handlePauseTask = async(index, single) => {
    if (selectedList.value.length && !single) {
      pauseDownloadTasks([...selectedList.value])
      removeAllSelect()
    } else {
      pauseDownloadTasks([list.value[index]])
    }
  }

  const handleRemoveTask = async(index, single) => {
    if (selectedList.value.length && !single) {
      // const confirm = await (selectedList.value.length > 1
      //   ? dialog.confirm({
      //     message: t('lists__remove_music_tip', { len: selectedList.value.length }),
      //     confirmButtonText: t('lists__remove_tip_button'),
      //   })
      //   : Promise.resolve(true)
      // )
      // if (!confirm) return
      removeDownloadTasks(selectedList.value.map(m => m.id))
      removeAllSelect()
    } else {
      removeDownloadTasks([list.value[index].id])
    }
  }

  const handleOpenFile = async(index) => {
    const task = list.value[index]
    if (!checkPath(task.metadata.filePath)) return
    openDirInExplorer(task.metadata.filePath)
  }

  return {
    handleSearch,
    handleOpenMusicDetail,
    handleStartTask,
    handlePauseTask,
    handleRemoveTask,
    handleOpenFile,
  }
}
