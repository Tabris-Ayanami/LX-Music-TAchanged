import { getListDetail, getListDetailAll } from '@renderer/store/songList/action'
import { appendToDefaultList, playMusicsInDefaultList } from '@renderer/utils/playDefaultList'
import { playMusicInfo } from '@renderer/store/player/state'

const getListPlayIndex = (list: LX.Music.MusicInfoOnline[], index?: number) => {
  if (index == null) {
    index = 1
  } else {
    if (index < 1) index = 1
    else if (index > list.length) index = list.length
  }
  return index - 1
}

export default () => {
  const playSongListDetail = async(source: LX.OnlineSource, link: string, playIndex?: number) => {
    // console.log(source, link, playIndex)
    if (link == null) return
    let isPlayingList = false
    const id = decodeURIComponent(link)
    const shouldQueueOnly = playIndex == null && !!playMusicInfo.musicInfo
    let list = (await getListDetail(id, source, 1)).list
    if (playIndex == null || list.length > playIndex) {
      if (shouldQueueOnly) {
        await appendToDefaultList(list)
      } else {
        isPlayingList = true
        await playMusicsInDefaultList(list, getListPlayIndex(list, playIndex))
      }
    }
    list = await getListDetailAll(id, source)
    if (!list.length) return
    if (shouldQueueOnly || isPlayingList) await appendToDefaultList(list)
    else await playMusicsInDefaultList(list, getListPlayIndex(list, playIndex))
  }

  return async(source: LX.OnlineSource, link: string, playIndex?: number) => {
    try {
      await playSongListDetail(source, link, playIndex)
    } catch (err) {
      console.error(err)
      throw new Error('Get play list failed.')
    }
  }
}
