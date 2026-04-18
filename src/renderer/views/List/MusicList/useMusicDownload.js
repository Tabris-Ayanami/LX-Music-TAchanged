import { ref, nextTick, onBeforeUnmount } from '@common/utils/vueTools'
import { onDeactivated } from 'vue'

export default ({ selectedList, list }) => {
  const isShowDownload = ref(false)
  const isShowDownloadMultiple = ref(false)
  const musicInfo = ref(null)
  let showTaskId = 0

  const handleShowDownloadModal = (index, single) => {
    const taskId = ++showTaskId
    if (selectedList.value.length && !single) {
      isShowDownloadMultiple.value = true
    } else {
      musicInfo.value = list.value[index]
      nextTick(() => {
        if (taskId != showTaskId) return
        isShowDownload.value = true
      })
    }
  }

  const closeDownloadModal = () => {
    showTaskId++
    isShowDownload.value = false
    isShowDownloadMultiple.value = false
    musicInfo.value = null
  }

  onDeactivated(closeDownloadModal)
  onBeforeUnmount(closeDownloadModal)

  return {
    isShowDownload,
    isShowDownloadMultiple,
    selectedDownloadMusicInfo: musicInfo,
    handleShowDownloadModal,
    closeDownloadModal,
  }
}
