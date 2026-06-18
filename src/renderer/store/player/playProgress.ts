import { reactive } from '@common/utils/vueTools'
import { formatPlayTime2 } from '@common/utils/common'

export const playProgress = reactive({
  nowPlayTime: 0,
  maxPlayTime: 0,
  progress: 0,
  nowPlayTimeStr: '00:00',
  maxPlayTimeStr: '00:00',
})

export const setNowPlayTime = (time: number) => {
  playProgress.nowPlayTime = time
  const timeStr = formatPlayTime2(time)
  if (playProgress.nowPlayTimeStr != timeStr) playProgress.nowPlayTimeStr = timeStr
  const progress = playProgress.maxPlayTime ? time / playProgress.maxPlayTime : 0
  if (playProgress.progress != progress) playProgress.progress = progress
}

export const setMaxplayTime = (time: number) => {
  if (playProgress.maxPlayTime == time) return
  playProgress.maxPlayTime = time
  const timeStr = formatPlayTime2(time)
  if (playProgress.maxPlayTimeStr != timeStr) playProgress.maxPlayTimeStr = timeStr
  const progress = time ? playProgress.nowPlayTime / time : 0
  if (playProgress.progress != progress) playProgress.progress = progress
}

export const setProgress = (currentTime: number, totalTime: number) => {
  setMaxplayTime(totalTime)
  setNowPlayTime(currentTime)
}
