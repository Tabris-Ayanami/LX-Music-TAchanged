import { onMounted, onBeforeUnmount, nextTick } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { setListPosition } from '@renderer/utils/data'

export default ({ props, listRef, list, handleRestoreScroll }) => {
  const route = useRoute()
  const router = useRouter()

  const getListController = async() => {
    if (listRef.value) return listRef.value
    await nextTick()
    return listRef.value
  }

  const saveListPosition = () => {
    setListPosition(props.listId, listRef.value?.getScrollTop() || 0)
  }

  const handleScrollList = async(index, isAnimation, callback = () => {}) => {
    const controller = await getListController()
    if (!controller) {
      callback()
      return
    }
    controller.scrollToIndex(index, -150, isAnimation, callback)
  }

  const restoreScroll = async(index, isAnimation) => {
    // console.log(index, isAnimation)
    if (!list.value.length) return
    if (index == null) return
    const controller = await getListController()
    if (!controller) return
    await handleScrollList(index, isAnimation)
  }

  onMounted(() => {
    handleRestoreScroll(route.query.scrollIndex, false)
    if (route.query.scrollIndex != null) {
      router.replace({
        path: '/list',
        query: {
          id: props.listId,
          updated: true,
        },
      })
    }
  })
  onBeforeUnmount(() => {
    saveListPosition()
  })

  return {
    saveListPosition,
    restoreScroll,
  }
}
