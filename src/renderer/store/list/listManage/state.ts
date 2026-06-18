import { LIST_IDS } from '@common/constants'
import { markRaw, reactive } from '@common/utils/vueTools'

export const allMusicList: Map<string, LX.Music.MusicInfo[]> = markRaw(new Map())

const PINNED_LIST_IDS = new Set<string>([
  LIST_IDS.DEFAULT,
  LIST_IDS.LOVE,
  LIST_IDS.TEMP,
])
const MAX_UNRETAINED_LISTS = 5
const retainedListIds = new Map<string, number>()
const listAccessTimes = new Map<string, number>()

const isListPinned = (id: string) => PINNED_LIST_IDS.has(id) || (retainedListIds.get(id) ?? 0) > 0

export const touchMusicListCache = (id: string | null) => {
  if (!id) return
  listAccessTimes.set(id, Date.now())
}

export const trimMusicListCache = () => {
  const removableIds = Array.from(allMusicList.keys()).filter(id => !isListPinned(id))
  if (removableIds.length <= MAX_UNRETAINED_LISTS) return

  removableIds
    .sort((a, b) => (listAccessTimes.get(a) ?? 0) - (listAccessTimes.get(b) ?? 0))
    .slice(0, removableIds.length - MAX_UNRETAINED_LISTS)
    .forEach(id => {
      allMusicList.delete(id)
      listAccessTimes.delete(id)
    })
}

export const retainMusicListCache = (id: string | null) => {
  if (!id) return () => {}
  retainedListIds.set(id, (retainedListIds.get(id) ?? 0) + 1)
  touchMusicListCache(id)

  let released = false
  return () => {
    if (released) return
    released = true
    const count = (retainedListIds.get(id) ?? 0) - 1
    if (count > 0) retainedListIds.set(id, count)
    else retainedListIds.delete(id)
    trimMusicListCache()
  }
}

export const deleteMusicListCache = (id: string) => {
  allMusicList.delete(id)
  listAccessTimes.delete(id)
  retainedListIds.delete(id)
}

export const defaultList = markRaw<LX.List.MyDefaultListInfo>({
  id: LIST_IDS.DEFAULT,
  name: 'list__name_default',
  // name: '试听列表',
})

export const loveList = markRaw<LX.List.MyLoveListInfo>({
  id: LIST_IDS.LOVE,
  name: 'list__name_love',
  // name: '我的收藏',
})
export const tempList = markRaw<LX.List.MyTempListInfo>({
  id: LIST_IDS.TEMP,
  name: '临时列表',
  meta: {},
})

export const userLists: LX.List.UserListInfo[] = reactive([])
