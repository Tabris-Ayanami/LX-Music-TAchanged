import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { formatPlayTime2, getRandom } from '@common/utils/common'
import { throttle } from '@common/utils'
import { backend } from '@renderer/backend'
import { playProgress, setNowPlayTime, setMaxplayTime } from '@renderer/store/player/playProgress'
import { musicInfo, playMusicInfo, playInfo } from '@renderer/store/player/state'
// import { getList } from '@renderer/store/utils'
import { appSetting } from '@renderer/store/setting'
import { playNext } from '@renderer/core/player'
import { updateListMusics } from '@renderer/store/list/action'
import { shouldPreserveOutgoingProgress } from '@renderer/plugins/player/transition'

const delaySavePlayInfo = throttle(backend.player.savePlaybackState, 2000)

export default () => {
  let restorePlayTime = 0
  const mediaBuffer: {
    timeout: NodeJS.Timeout | null
    playTime: number
  } = {
    timeout: null,
    playTime: 0,
  }

  // const updateMusicInfo = useCommit('list', 'updateMusicInfo')

  const startBuffering = () => {
    console.log('start t')
    if (mediaBuffer.timeout) return
    mediaBuffer.timeout = setTimeout(() => {
      mediaBuffer.timeout = null
      if (window.lx.isPlayedStop) return
      const currentTime = backend.player.getPosition()

      mediaBuffer.playTime ||= currentTime
      let skipTime = currentTime + getRandom(3, 6)
      if (skipTime > playProgress.maxPlayTime) skipTime = (playProgress.maxPlayTime - currentTime) / 2
      if (skipTime - mediaBuffer.playTime < 1 || playProgress.maxPlayTime - skipTime < 1) {
        mediaBuffer.playTime = 0
        if (appSetting['player.autoSkipOnError']) {
          console.warn('buffering end')
          void playNext(true)
        }
        return
      }
      startBuffering()
      backend.player.seek(skipTime)
      console.log(mediaBuffer.playTime)
      console.log(currentTime)
    }, 3000)
  }
  const clearBufferTimeout = () => {
    console.log('clear t')
    if (!mediaBuffer.timeout) return
    clearTimeout(mediaBuffer.timeout)
    mediaBuffer.timeout = null
    mediaBuffer.playTime = 0
  }

  const setProgress = (time: number, maxTime?: number) => {
    if (!musicInfo.id) return
    if (maxTime != null) setMaxplayTime(maxTime)
    console.log('setProgress', time, maxTime)
    if (time > 0) restorePlayTime = time
    if (mediaBuffer.playTime) {
      clearBufferTimeout()
      mediaBuffer.playTime = time
      startBuffering()
    }
    setNowPlayTime(time)
    backend.player.seek(time)

    // if (!isPlay) audio.play()
  }

  const handlePause = () => {
    clearBufferTimeout()
  }

  const handleStop = () => {
    setNowPlayTime(0)
    setMaxplayTime(0)
  }

  const handleError = () => {
    restorePlayTime ||= backend.player.getPosition() // 记录出错的播放时间
    console.log('handleError')
  }

  const updateDurationFromPlayer = () => {
    const duration = backend.player.getDuration()
    if (!Number.isFinite(duration) || duration <= 0) return false
    setMaxplayTime(duration)
    return true
  }

  const handleLoadeddata = () => {
    updateDurationFromPlayer()

    if (playMusicInfo.musicInfo && 'source' in playMusicInfo.musicInfo && !playMusicInfo.musicInfo.interval) {
      // console.log(formatPlayTime2(playProgress.maxPlayTime))

      if (playMusicInfo.listId) {
        void updateListMusics([{
          id: playMusicInfo.listId,
          musicInfo: {
            ...playMusicInfo.musicInfo,
            interval: formatPlayTime2(playProgress.maxPlayTime),
          },
        }])
      }
    }
  }

  const handlePlaying = () => {
    console.log('handlePlaying', mediaBuffer.playTime, restorePlayTime)
    clearBufferTimeout()
    if (mediaBuffer.playTime) {
      let playTime = mediaBuffer.playTime
      mediaBuffer.playTime = 0
      backend.player.seek(playTime)
    } else if (restorePlayTime) {
      backend.player.seek(restorePlayTime)
      restorePlayTime = 0
    }
  }
  const handleWating = () => {
    startBuffering()
  }

  const handleEmpied = () => {
    mediaBuffer.playTime = 0
    clearBufferTimeout()
  }

  const handleSetPlayInfo = () => {
    const telemetry = backend.player.getTransitionTelemetry()
    const preserveOutgoingProgress = shouldPreserveOutgoingProgress({
      enabled: appSetting['player.isSmartTransition'],
      playing: telemetry.playing,
      empty: backend.player.isEmpty(),
    })
    if (preserveOutgoingProgress) {
      // The selected song changed, but its URL/deck is not active yet. Keep the
      // outgoing deck untouched until prepareNext promotes the incoming deck.
      restorePlayTime = 0
      setNowPlayTime(backend.player.getPosition())
      const duration = backend.player.getDuration()
      if (Number.isFinite(duration) && duration > 0) setMaxplayTime(duration)
    } else {
      backend.player.seek(restorePlayTime = playProgress.nowPlayTime)
    }
    handlePause()
    if (!preserveOutgoingProgress && !playMusicInfo.isTempPlay && playMusicInfo.listId) {
      delaySavePlayInfo({
        time: playProgress.nowPlayTime,
        maxTime: playProgress.maxPlayTime,
        listId: playMusicInfo.listId,
        index: playInfo.playIndex,
      })
    }
  }

  watch(() => playProgress.nowPlayTime, (newValue, oldValue) => {
    if (Math.abs(newValue - oldValue) > 2) window.app_event.activePlayProgressTransition()
    if (appSetting['player.isSavePlayTime'] && !playMusicInfo.isTempPlay) {
      delaySavePlayInfo({
        time: newValue,
        maxTime: playProgress.maxPlayTime,
        listId: playMusicInfo.listId as string,
        index: playInfo.playIndex,
      })
    }
  })
  watch(() => playProgress.maxPlayTime, maxPlayTime => {
    if (!playMusicInfo.isTempPlay) {
      delaySavePlayInfo({
        time: playProgress.nowPlayTime,
        maxTime: maxPlayTime,
        listId: playMusicInfo.listId as string,
        index: playInfo.playIndex,
      })
    }
  })

  // window.app_event.on('play', handlePlay)
  window.app_event.on('pause', handlePause)
  window.app_event.on('stop', handleStop)
  window.app_event.on('error', handleError)
  window.app_event.on('setProgress', setProgress)
  // window.app_event.on(eventPlayerNames.restorePlay, handleRestorePlay)
  window.app_event.on('playerLoadeddata', handleLoadeddata)
  window.app_event.on('playerPlaying', handlePlaying)
  window.app_event.on('playerWaiting', handleWating)
  window.app_event.on('playerEmptied', handleEmpied)
  window.app_event.on('musicToggled', handleSetPlayInfo)

  const rOnTimeupdate = backend.player.on('timeupdate', () => {
    setNowPlayTime(backend.player.getPosition())
  })
  const rOnDurationchange = backend.player.on('durationchange', () => {
    updateDurationFromPlayer()
  })

  let currentPlayTime = 0
  const rVisibilityChange = backend.player.on('visibilitychange', () => {
    if (document.hidden) {
      currentPlayTime = playProgress.nowPlayTime
    } else {
      if (Math.abs(playProgress.nowPlayTime - currentPlayTime) > 2) {
        window.app_event.activePlayProgressTransition()
      }
    }
  })

  onBeforeUnmount(() => {
    rOnTimeupdate()
    rOnDurationchange()
    rVisibilityChange()
    // window.app_event.off('play', handlePlay)
    window.app_event.off('pause', handlePause)
    window.app_event.off('stop', handleStop)
    window.app_event.off('error', handleError)
    window.app_event.off('setProgress', setProgress)
    // window.app_event.off(eventPlayerNames.restorePlay, handleRestorePlay)
    window.app_event.off('playerLoadeddata', handleLoadeddata)
    window.app_event.off('playerPlaying', handlePlaying)
    window.app_event.off('playerWaiting', handleWating)
    window.app_event.off('playerEmptied', handleEmpied)
    window.app_event.off('musicToggled', handleSetPlayInfo)
  })
}
