import { userLists } from '@renderer/store/list/state'
import { dialog } from '@renderer/plugins/Dialog'
import syncSourceList from '@renderer/store/list/syncSourceList'
import { getListDetailAll } from '@renderer/store/songList/action'
import { createUserList } from '@renderer/store/list/action'
import { toMD5 } from '@renderer/utils'
import { playMusicsInDefaultList, queueNextInDefaultList } from '@renderer/utils/playDefaultList'
import { playMusicInfo } from '@renderer/store/player/state'

const getListId = (id: string, source: LX.OnlineSource) => `${source}__${id}`
const pendingCollectListIds = new Set<string>()

const findCollectedSongList = (id: string, source: LX.OnlineSource, listId: string, userListId: string) => {
  return userLists.find(l => {
    if (l.id == userListId) return true
    if (l.source != source) return false
    return l.sourceListId == id || l.sourceListId == listId
  })
}

const handleCollectedSongList = async(targetList: LX.List.UserListInfo) => {
  const confirm = await dialog.confirm({
    message: window.i18n.t('duplicate_list_tip', { name: targetList.name }),
    cancelButtonText: window.i18n.t('lists__import_part_button_cancel'),
    confirmButtonText: window.i18n.t('confirm_button_text'),
  })
  if (!confirm) return
  void syncSourceList(targetList)
}

export const addSongListDetail = async(id: string, source: LX.OnlineSource, name?: string) => {
  // console.log(this.listDetail.info)
  // if (!this.listDetail.info.name) return
  const listId = getListId(id, source)
  const userListId = `${source}_${toMD5(listId)}`
  const targetList = findCollectedSongList(id, source, listId, userListId)
  if (targetList) {
    await handleCollectedSongList(targetList)
    return
  }

  if (pendingCollectListIds.has(userListId)) return
  pendingCollectListIds.add(userListId)
  try {
    const list = await getListDetailAll(id, source)
    const latestTargetList = findCollectedSongList(id, source, listId, userListId)
    if (latestTargetList) {
      await handleCollectedSongList(latestTargetList)
      return
    }
    await createUserList({
      name,
      id: userListId,
      list,
      source,
      sourceListId: id,
    })
  } finally {
    pendingCollectListIds.delete(userListId)
  }
}

export const playSongListDetail = async(id: string, source: LX.OnlineSource, list?: LX.Music.MusicInfoOnline[], index?: number) => {
  const shouldQueueOnly = index == null && !!playMusicInfo.musicInfo
  const fullList = await getListDetailAll(id, source)
  if (!fullList.length) return
  if (shouldQueueOnly) {
    await queueNextInDefaultList(fullList)
    return
  }
  await playMusicsInDefaultList(list?.length ? list : fullList, index ?? 0)
  await queueNextInDefaultList(fullList)
}
