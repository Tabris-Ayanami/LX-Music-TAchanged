import { onBeforeUnmount, ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/leaderboard/action'
import { listDetailInfo } from '@renderer/store/leaderboard/state'
import { playSongListDetail } from '../action'

export default () => {
  const listRef = ref<any>(null)
  let scrollTimer: ReturnType<typeof setTimeout> | null = null

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.list, index)
  }

  const getList = (id: string, page: number) => {
    void getAndSetListDetail(id, page).then(() => {
      if (scrollTimer) clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        scrollTimer = null
        if (listRef.value) listRef.value.scrollToTop()
      })
    }).catch(err => {
      console.log(err)
    })
  }

  onBeforeUnmount(() => {
    if (!scrollTimer) return
    clearTimeout(scrollTimer)
    scrollTimer = null
  })

  return {
    listRef,
    listDetailInfo,
    getList,
    handlePlayList,
  }
}
