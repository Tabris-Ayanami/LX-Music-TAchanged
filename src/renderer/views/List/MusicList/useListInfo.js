import { ref, shallowRef, watch, computed, onBeforeUnmount } from '@common/utils/vueTools'
import { playMusicInfo, playInfo } from '@renderer/store/player/state'
import { getListMusics, retainMusicListCache } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'


export default ({ props, onLoadedList }) => {
  const rightClickSelectedIndex = ref(-1)
  const selectedIndex = ref(-1)
  const dom_listContent = ref(null)
  const listRef = ref(null)

  const excludeListIds = computed(() => ([props.listId]))


  const list = shallowRef([])
  let releaseListCache = () => {}
  let loadRequestId = 0

  const useExternalMusicList = musicList => Array.isArray(musicList)

  watch(() => props.musicList, musicList => {
    if (!useExternalMusicList(musicList)) return
    loadRequestId++
    list.value = musicList
    onLoadedList()
  }, {
    immediate: true,
  })
  watch(() => props.listId, id => {
    const requestId = ++loadRequestId
    releaseListCache()
    releaseListCache = retainMusicListCache(id)
    if (useExternalMusicList(props.musicList)) return
    getListMusics(id).then(l => {
      if (requestId != loadRequestId || id != props.listId || useExternalMusicList(props.musicList)) return
      list.value = l
      onLoadedList()
    })
  }, {
    immediate: true,
  })

  const playerInfo = computed(() => ({
    isPlayList: playMusicInfo.listId == props.listId,
    playIndex: playInfo.playIndex,
  }))

  const setSelectedIndex = index => {
    selectedIndex.value = index
  }

  const isShowSource = computed(() => appSetting['list.isShowSource'])

  const handleMyListUpdate = (ids) => {
    if (!ids.includes(props.listId)) return
    if (useExternalMusicList(props.musicList)) return
    const requestId = ++loadRequestId
    getListMusics(props.listId).then(l => {
      if (requestId != loadRequestId || useExternalMusicList(props.musicList)) return
      list.value = list.value === l ? [...l] : l
    })
  }

  window.app_event.on('myListUpdate', handleMyListUpdate)

  onBeforeUnmount(() => {
    window.app_event.off('myListUpdate', handleMyListUpdate)
    releaseListCache()
  })

  return {
    rightClickSelectedIndex,
    selectedIndex,
    dom_listContent,
    listRef,
    list,
    playerInfo,
    setSelectedIndex,
    isShowSource,
    excludeListIds,
  }
}
