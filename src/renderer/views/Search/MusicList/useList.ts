import { ref } from '@common/utils/vueTools'
import { addHistoryWord } from '@renderer/store/search/action'
import { playMusicInDefaultList } from '@renderer/utils/playDefaultList'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { search as searchMusic, listInfos, type ListInfo } from '@renderer/store/search/music'
import { assertApiSupport } from '@renderer/store/utils'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as ListInfo
    if (text.length) void addHistoryWord(text)
    void searchMusic(text, page, source).then((list: LX.Music.MusicInfo[]) => {
      if (list.length) {
        setTimeout(() => {
          if (listRef.value) listRef.value.scrollToTop()
        })
      }
    })
  }

  const handlePlayList = async(index: number) => {
    let targetSong = listInfo.value.list[index]

    if (!assertApiSupport(targetSong.source)) return

    await playMusicInDefaultList(targetSong)
  }

  return {
    listRef,
    listInfo,
    search,
    handlePlayList,
  }
}
