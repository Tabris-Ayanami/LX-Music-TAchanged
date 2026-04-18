import { ref, nextTick, onBeforeUnmount } from '@common/utils/vueTools'
import { onDeactivated } from 'vue'

export default ({ selectedList, list }) => {
  const isShowListAdd = ref(false)
  const isMove = ref(false)
  const isMoveMultiple = ref(false)
  const isShowListAddMultiple = ref(false)
  const selectedAddMusicInfo = ref(null)
  let showTaskId = 0

  const handleShowMusicAddModal = (index, single) => {
    const taskId = ++showTaskId
    if (selectedList.value.length && !single) {
      isMoveMultiple.value = false
      isShowListAddMultiple.value = true
    } else {
      isMove.value = false
      selectedAddMusicInfo.value = list.value[index]
      nextTick(() => {
        if (taskId != showTaskId) return
        isShowListAdd.value = true
      })
    }
  }

  const handleShowMusicMoveModal = (index, single) => {
    const taskId = ++showTaskId
    if (selectedList.value.length && !single) {
      isMoveMultiple.value = true
      isShowListAddMultiple.value = true
    } else {
      isMove.value = true
      selectedAddMusicInfo.value = list.value[index]
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
    isMove.value = false
    isMoveMultiple.value = false
    selectedAddMusicInfo.value = null
  }

  onDeactivated(closeListAddModal)
  onBeforeUnmount(closeListAddModal)

  return {
    isShowListAdd,
    isMove,
    isMoveMultiple,
    isShowListAddMultiple,
    selectedAddMusicInfo,
    handleShowMusicAddModal,
    handleShowMusicMoveModal,
    closeListAddModal,
  }
}
