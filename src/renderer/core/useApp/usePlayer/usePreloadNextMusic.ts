import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { onTimeupdate, getCurrentTime } from '@renderer/plugins/player'
import { playProgress } from '@renderer/store/player/playProgress'
import { musicInfo } from '@renderer/store/player/state'
// import { getList } from '@renderer/store/utils'
import { getNextPlayMusicInfo, resetRandomNextMusicInfo } from '@renderer/core/player'
import { getMusicUrl } from '@renderer/core/music'
import { appSetting } from '@renderer/store/setting'

let audio: HTMLAudioElement | null = null
let preloadTaskId = 0
const handlePreloadPlaying = () => {
  audio?.pause()
}
const initAudio = () => {
  if (audio) return audio
  audio = new Audio()
  audio.controls = false
  audio.preload = 'metadata'
  audio.crossOrigin = 'anonymous'
  audio.muted = true
  audio.volume = 0
  audio.autoplay = false
  audio.addEventListener('playing', handlePreloadPlaying)
  return audio
}
const releasePreloadAudio = (destroy = false) => {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  if (!destroy) return
  audio.removeEventListener('playing', handlePreloadPlaying)
  audio = null
}
const checkMusicUrl = async(url: string, taskId: number): Promise<boolean> => {
  const preloadAudio = initAudio()
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      clear()
      if (taskId == preloadTaskId) releasePreloadAudio(true)
      resolve(false)
    }, 8000)
    const clear = () => {
      window.clearTimeout(timeout)
      preloadAudio.removeEventListener('error', handleErr)
      preloadAudio.removeEventListener('loadedmetadata', handleLoaded)
    }
    const handleErr = () => {
      clear()
      if (preloadAudio.error?.code !== 1) {
        releasePreloadAudio(true)
        resolve(false)
      } else {
        resolve(true)
      }
    }
    const handleLoaded = () => {
      clear()
      resolve(true)
    }
    preloadAudio.addEventListener('error', handleErr)
    preloadAudio.addEventListener('loadedmetadata', handleLoaded)
    preloadAudio.src = url
    preloadAudio.load()
  })
}

const preloadMusicInfo = {
  isLoading: false,
  preProgress: 0,
  info: null as LX.Player.PlayMusicInfo | null,
}
const resetPreloadInfo = () => {
  preloadTaskId += 1
  preloadMusicInfo.preProgress = 0
  preloadMusicInfo.info = null
  preloadMusicInfo.isLoading = false
  releasePreloadAudio(true)
}
const preloadNextMusicUrl = async(curTime: number) => {
  if (preloadMusicInfo.isLoading || curTime - preloadMusicInfo.preProgress < 3) return
  preloadMusicInfo.isLoading = true
  const taskId = ++preloadTaskId
  console.log('preload next music url')
  const info = await getNextPlayMusicInfo()
  if (taskId != preloadTaskId) return
  if (info) {
    preloadMusicInfo.info = info
    const url = await getMusicUrl({ musicInfo: info.musicInfo }).catch(() => '')
    if (taskId != preloadTaskId) return
    if (url) {
      console.log('preload url', url)
      const result = await checkMusicUrl(url, taskId)
      if (taskId != preloadTaskId) return
      if (!result) {
        const url = await getMusicUrl({ musicInfo: info.musicInfo, isRefresh: true }).catch(() => '')
        if (taskId == preloadTaskId && url) void checkMusicUrl(url, taskId)
        console.log('preload url refresh', url)
      }
    }
  }
  if (taskId == preloadTaskId) preloadMusicInfo.isLoading = false
}

export default () => {
  const setProgress = (time: number) => {
    if (!musicInfo.id) return
    preloadMusicInfo.preProgress = time
  }

  const handleSetPlayInfo = () => {
    resetPreloadInfo()
  }

  watch(() => appSetting['player.togglePlayMethod'], () => {
    if (!preloadMusicInfo.info || preloadMusicInfo.info.isTempPlay) return
    resetRandomNextMusicInfo()
    preloadMusicInfo.info = null
    preloadMusicInfo.preProgress = playProgress.nowPlayTime
  })

  window.app_event.on('setProgress', setProgress)
  window.app_event.on('musicToggled', handleSetPlayInfo)

  const rOnTimeupdate = onTimeupdate(() => {
    const time = getCurrentTime()
    const duration = playProgress.maxPlayTime
    if (duration > 10 && duration - time < 10 && !preloadMusicInfo.info) {
      void preloadNextMusicUrl(time)
    }
  })


  onBeforeUnmount(() => {
    rOnTimeupdate()
    window.app_event.off('setProgress', setProgress)
    window.app_event.off('musicToggled', handleSetPlayInfo)
    releasePreloadAudio(true)
  })
}
