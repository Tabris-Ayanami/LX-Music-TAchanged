import { getPlayInfo } from '@renderer/utils/ipc'
import { log } from '@common/utils'
import { getListMusics, getUserLists, registerAction } from '@renderer/store/list/action'


import useInitUserApi from './useInitUserApi'
import { play, playList } from '@renderer/core/player'
import { onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { playMusicInfo } from '@renderer/store/player/state'
import { initDislikeInfo, registerRemoteDislikeAction } from '@renderer/core/dislikeList'

let musicSdkPromise: Promise<any> | null = null
const getMusicSdk = async() => {
  musicSdkPromise ||= import('@renderer/utils/musicSdk').then(({ default: music }) => music)
  return musicSdkPromise
}
const music = {
  async init() {
    return (await getMusicSdk()).init()
  },
}

const initMusicSdk = () => {
  void music.init().catch((err: any) => {
    log.error(err)
  })
}

const initPrevPlayInfo = async() => {
  const info = await getPlayInfo()
  window.lx.restorePlayInfo = null
  if (!info?.listId || info.index < 0) return
  const list = await getListMusics(info.listId)
  if (!list[info.index]) return
  window.lx.restorePlayInfo = info
  playList(info.listId, info.index)

  if (appSetting['player.startupAutoPlay']) {
    const musicInfo = playMusicInfo.musicInfo
    if (!musicInfo) return
    setTimeout(() => {
      if (musicInfo.id == playMusicInfo.musicInfo?.id) play()
    })
  }
}

export default () => {
  const initUserApi = useInitUserApi()

  let unregister: null | (() => void) = null
  let unregisterDislikeEvent: null | (() => void) = null

  onBeforeUnmount(() => {
    if (unregister) unregister()
    if (unregisterDislikeEvent) unregisterDislikeEvent()
  })

  return async() => {
    const initUserApiTask = initUserApi().catch((err: any) => {
      log.error(err)
    })

    unregister = registerAction((ids) => {
      window.app_event.myListUpdate(ids)
    })
    unregisterDislikeEvent = registerRemoteDislikeAction()

    const userListsTask = getUserLists().then(lists => {
      window.lxData.userLists = lists
    }) // 获取用户列表
    const dislikeInfoTask = initDislikeInfo() // 获取不喜欢列表

    await initUserApiTask
    if (appSetting['common.apiSource'] != 'temp') initMusicSdk() // 初始化非默认音乐 API

    await userListsTask
    await dislikeInfoTask
    await initPrevPlayInfo().catch(err => {
      log.error(err)
    }) // 初始化上次的歌曲播放信息
  }
}
