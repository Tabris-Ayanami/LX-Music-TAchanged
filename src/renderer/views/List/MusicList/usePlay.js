import { addTempPlayList } from '@renderer/store/player/action'
import { playList } from '@renderer/core/player'
import { playMusicInDefaultList } from '@renderer/utils/playDefaultList'

const RAPID_PLAY_GUARD_MS = 450

export default ({ props, selectedList, list, removeAllSelect }) => {
  let clickTime = 0
  let clickIndex = -1
  let lastPlayKey = ''
  let lastPlayAt = 0

  const handlePlayMusic = async(index) => {
    const musicInfo = list.value[index]
    if (!musicInfo) return
    const now = window.performance.now()
    const playKey = `${props.listId}:${musicInfo.id}`
    if (playKey == lastPlayKey && now - lastPlayAt < RAPID_PLAY_GUARD_MS) return
    lastPlayKey = playKey
    lastPlayAt = now

    if (props.playMode == 'single-temp') {
      await playMusicInDefaultList(musicInfo)
      return
    }
    playList(props.listId, index)
  }

  const handlePlayMusicLater = (index, single) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: props.listId, musicInfo: s })))
      removeAllSelect()
    } else {
      addTempPlayList([{ listId: props.listId, musicInfo: list.value[index] }])
    }
  }

  const doubleClickPlay = index => {
    if (
      window.performance.now() - clickTime > 400 ||
      clickIndex !== index
    ) {
      clickTime = window.performance.now()
      clickIndex = index
      return
    }
    handlePlayMusic(index).catch(() => {})
    clickTime = 0
    clickIndex = -1
  }

  return {
    handlePlayMusic,
    handlePlayMusicLater,
    doubleClickPlay,
  }
}
