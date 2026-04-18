import { ref, nextTick, onBeforeUnmount } from '@common/utils/vueTools'
import { onDeactivated } from 'vue'

export default ({ selectedList, props }) => {
  const isShowListAdd = ref(false)
  const isShowListAddMultiple = ref(false)
  const selectedAddMusicInfo = ref(null)
  let showTaskId = 0

  const handleShowMusicAddModal = (index, single) => {
    const taskId = ++showTaskId
    if (selectedList.value.length && !single) {
      isShowListAddMultiple.value = true
    } else {
      selectedAddMusicInfo.value = props.list[index]
      nextTick(() => {
        if (taskId != showTaskId) return
        isShowListAdd.value = true
      })
    }
  }

  const closeListAddModal = () => {
    showTaskId++
    isShowListAdd.value = false
    isShowListAddMultiple.value = false
    selectedAddMusicInfo.value = null
  }

  onDeactivated(closeListAddModal)
  onBeforeUnmount(closeListAddModal)

  return {
    isShowListAdd,
    isShowListAddMultiple,
    selectedAddMusicInfo,
    handleShowMusicAddModal,
    closeListAddModal,
  }
}
