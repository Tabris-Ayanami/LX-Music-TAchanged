import Lyric from '@common/utils/lyric-font-player'
import { getCurrentTime as getPlayerCurrentTime } from '@renderer/plugins/player'
import { lyric, setLines, setOffset, setTempOffset, setText } from '@renderer/store/player/lyric'
import { isPlay, musicInfo } from '@renderer/store/player/state'
import { setStatusText } from '@renderer/store/player/action'
import { markRawList } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'

const getCurrentTime = () => {
  return getPlayerCurrentTime() * 1000
}

let lrc: Lyric
export const init = () => {
  lrc = new Lyric({
    shadowContent: false,
    onPlay(line, text) {
      setText(text, Math.max(line, 0))
      setStatusText(text)
      window.app_event.lyricLinePlay(text, line)
      // console.log(line, text)
    },
    onSetLyric(lines, offset) { // listening lyrics seting event
      // console.log(lines) // lines is array of all lyric text
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
      setOffset(offset) // 歌词延迟
      setTempOffset(0) // 重置临时延迟
    },
    onUpdateLyric(lines) {
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
    },
    rate: appSetting['player.playbackRate'],
    // offset: 80,
  })
}

export const setLyricOffset = (offset: number) => {
  const tempOffset = offset - lyric.offset
  setTempOffset(tempOffset)
  lrc.setOffset(tempOffset)

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime()
      lrc.play(time)
    })
  }
}

export const setPlaybackRate = (rate: number) => {
  lrc.setPlaybackRate(rate)

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime()
      lrc.play(time)
    })
  }
}

export const setLyric = () => {
  if (!musicInfo.id) return
  if (musicInfo.lrc) {
    const extendedLyrics = []
    if (appSetting['player.isShowLyricRoma'] && musicInfo.rlrc) extendedLyrics.push(musicInfo.rlrc)
    if (appSetting['player.isShowLyricTranslation'] && musicInfo.tlrc) extendedLyrics.push(musicInfo.tlrc)
    if (appSetting['player.isSwapLyricTranslationAndRoma']) extendedLyrics.reverse()

    lrc.setLyric(
      appSetting['player.isPlayLxlrc'] && musicInfo.lxlrc ? musicInfo.lxlrc : musicInfo.lrc,
      extendedLyrics,
    )
  }

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime()
      lrc.play(time)
    })
  }
}

export const setDisabledAutoPause = (disabledAutoPause: boolean) => {
  lrc.setDisabledAutoPause(disabledAutoPause)
}

let sources = new Map<string, boolean>()
let prevDisabled = false
export const setDisableAutoPauseBySource = (disabled: boolean, source: string) => {
  sources.set(source, disabled)
  const currentDisabled = Array.from(sources.values()).some(e => e)
  if (prevDisabled == currentDisabled) return
  prevDisabled = currentDisabled
  setDisabledAutoPause(currentDisabled)
}


export const play = () => {
  // if (!musicInfo.lrc) return
  const currentTime = getCurrentTime()
  lrc.play(currentTime)
}

export const pause = () => {
  lrc.pause()
}

export const stop = () => {
  lrc.setLyric('')
  // setLines([])
  setText('', 0)
}
