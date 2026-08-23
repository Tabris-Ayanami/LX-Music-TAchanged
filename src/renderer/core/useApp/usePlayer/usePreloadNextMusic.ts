import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { backend } from '@renderer/backend'
import { playProgress } from '@renderer/store/player/playProgress'
import { musicInfo } from '@renderer/store/player/state'
import { getNextPlayMusicInfo, playPreparedNext, resetRandomNextMusicInfo } from '@renderer/core/player'
import { getMusicUrl } from '@renderer/core/music'
import { appSetting } from '@renderer/store/setting'
import { chooseTransitionStart } from '@renderer/plugins/player/transition'

let preloadTaskId = 0
const preloadMusicInfo = {
  isLoading: false,
  ready: false,
  info: null as LX.Player.PlayMusicInfo | null,
}

const resetPreloadInfo = (cancelPlayer: boolean) => {
  preloadTaskId++
  preloadMusicInfo.isLoading = false
  preloadMusicInfo.ready = false
  preloadMusicInfo.info = null
  if (cancelPlayer) backend.player.cancelPrepared('preload-reset')
}

const preloadNextMusicUrl = async() => {
  if (!appSetting['player.isSmartTransition'] || preloadMusicInfo.isLoading || preloadMusicInfo.ready) return
  preloadMusicInfo.isLoading = true
  const taskId = ++preloadTaskId
  const info = await getNextPlayMusicInfo()
  if (taskId != preloadTaskId || !info) {
    preloadMusicInfo.isLoading = false
    return
  }

  let url = await getMusicUrl({ musicInfo: info.musicInfo }).catch(() => '')
  if (taskId != preloadTaskId || !url) {
    preloadMusicInfo.isLoading = false
    return
  }

  let ready = await backend.player.prepare({ source: url })
  if (!ready && taskId == preloadTaskId) {
    url = await getMusicUrl({ musicInfo: info.musicInfo, isRefresh: true }).catch(() => '')
    if (taskId == preloadTaskId && url) ready = await backend.player.prepare({ source: url })
  }
  if (taskId != preloadTaskId || !ready) {
    preloadMusicInfo.isLoading = false
    if (taskId == preloadTaskId) backend.player.cancelPrepared('preload-failed')
    return
  }

  preloadMusicInfo.info = info
  preloadMusicInfo.ready = true
  preloadMusicInfo.isLoading = false
}

export default () => {
  const handleSetProgress = () => {
    if (!musicInfo.id) return
    resetPreloadInfo(true)
  }

  const handleSetPlayInfo = () => {
    resetPreloadInfo(false)
  }

  const handleTransitionTick = () => {
    if (!appSetting['player.isSmartTransition']) return
    const telemetry = backend.player.getTransitionTelemetry()
    const duration = playProgress.maxPlayTime
    if (duration > 10 && telemetry.remainingSec <= 10 && !preloadMusicInfo.info) {
      void preloadNextMusicUrl()
      return
    }
    if (!preloadMusicInfo.ready || !preloadMusicInfo.info) return

    const decision = chooseTransitionStart({
      prepared: telemetry.prepared,
      playing: telemetry.playing,
      remainingSec: telemetry.remainingSec,
      silenceSec: telemetry.silenceSec,
    })
    if (!decision.shouldStart) return

    const info = preloadMusicInfo.info
    preloadMusicInfo.ready = false
    preloadMusicInfo.info = null
    if (!playPreparedNext(info, decision.overlapSec)) {
      resetPreloadInfo(true)
    }
  }

  watch(() => appSetting['player.togglePlayMethod'], () => {
    resetRandomNextMusicInfo()
    resetPreloadInfo(true)
  })

  watch(() => appSetting['player.isSmartTransition'], enabled => {
    if (!enabled) resetPreloadInfo(true)
  })

  window.app_event.on('setProgress', handleSetProgress)
  window.app_event.on('musicToggled', handleSetPlayInfo)
  const rOnTimeupdate = backend.player.on('timeupdate', handleTransitionTick)

  onBeforeUnmount(() => {
    rOnTimeupdate()
    window.app_event.off('setProgress', handleSetProgress)
    window.app_event.off('musicToggled', handleSetPlayInfo)
    resetPreloadInfo(true)
  })
}
