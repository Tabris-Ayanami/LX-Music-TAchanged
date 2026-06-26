import { watch } from '@common/utils/vueTools'
import {
  freqs,
  getBiquadFilter,
  setConvolver,
  setPannerSoundR,
  setPannerSpeed,
  startPanner,
  stopPanner,
  setConvolverMainGain,
  setConvolverSendGain,
  setPitchShifter,
} from '@renderer/plugins/player'

import { appSetting } from '@renderer/store/setting'

let convolverRequestId = 0

const applyBiquadGain = (hz: (typeof freqs)[number], gain: number) => {
  const filter = getBiquadFilter().get(`hz${hz}`)
  if (!filter) {
    console.warn(`biquad filter hz${hz} not found`)
    return
  }
  filter.gain.value = gain
}

const applyBiquadGains = () => {
  for (const item of freqs) {
    applyBiquadGain(item, appSetting[`player.soundEffect.biquadFilter.hz${item}`])
  }
}

const loadConvolver = (fileName: string | null) => {
  const requestId = ++convolverRequestId
  setTimeout(() => {
    if (requestId != convolverRequestId) return
    if (!fileName) {
      setConvolver(null, 0, 0)
      return
    }

    void import('./convolverBuffer').then(async({ loadConvolverBuffer }) => loadConvolverBuffer(fileName)).then((buffer) => {
      if (requestId != convolverRequestId) return
      setConvolver(buffer, appSetting['player.soundEffect.convolution.mainGain'] / 10, appSetting['player.soundEffect.convolution.sendGain'] / 10)
    }).catch(error => {
      if (requestId != convolverRequestId) return
      console.warn('load convolver buffer failed', error)
      setConvolver(null, 0, 0)
    })
  })
}

export default () => {
  // console.log(appSetting['player.soundEffect.panner.enable'])
  if (appSetting['player.soundEffect.panner.enable']) startPanner()
  setPannerSoundR(appSetting['player.soundEffect.panner.soundR'] / 10)
  setPannerSpeed(2 * (appSetting['player.soundEffect.panner.speed'] / 10))
  if (freqs.some(v => appSetting[`player.soundEffect.biquadFilter.hz${v}`] != 0)) {
    applyBiquadGains()
  }
  if (appSetting['player.soundEffect.convolution.fileName']) {
    loadConvolver(appSetting['player.soundEffect.convolution.fileName'])
  }
  if (appSetting['player.soundEffect.pitchShifter.playbackRate'] != 1) {
    setPitchShifter(appSetting['player.soundEffect.pitchShifter.playbackRate'])
  }


  watch(() => appSetting['player.soundEffect.panner.enable'], (enable) => {
    if (enable) {
      startPanner()
    } else {
      stopPanner()
    }
  })
  watch(() => appSetting['player.soundEffect.panner.soundR'], (soundR) => {
    setPannerSoundR(soundR / 10)
  })
  watch(() => appSetting['player.soundEffect.panner.speed'], (speed) => {
    setPannerSpeed(2 * (speed / 10))
  })
  watch(() => appSetting['player.soundEffect.convolution.fileName'], (fileName) => {
    loadConvolver(fileName)
  })
  watch(() => appSetting['player.soundEffect.convolution.mainGain'], (mainGain) => {
    if (!appSetting['player.soundEffect.convolution.fileName']) return
    setConvolverMainGain(mainGain / 10)
  })
  watch(() => appSetting['player.soundEffect.convolution.sendGain'], (sendGain) => {
    if (!appSetting['player.soundEffect.convolution.fileName']) return
    setConvolverSendGain(sendGain / 10)
  })
  watch(() => freqs.map(item => appSetting[`player.soundEffect.biquadFilter.hz${item}`]), applyBiquadGains)

  watch(() => appSetting['player.soundEffect.pitchShifter.playbackRate'], (playbackRate) => {
    setPitchShifter(playbackRate)
  })


  // window.key_event.on(HOTKEY_PLAYER.volume_up.action, hotkeyVolumeUp)
  // window.key_event.on(HOTKEY_PLAYER.volume_down.action, hotkeyVolumeDown)
  // window.app_event.on('setPlaybackRate', handleSetPlaybackRate)

  // onBeforeUnmount(() => {
  //   // window.key_event.off(HOTKEY_PLAYER.volume_up.action, hotkeyVolumeUp)
  //   // window.key_event.off(HOTKEY_PLAYER.volume_down.action, hotkeyVolumeDown)
  //   window.app_event.off('setPlaybackRate', handleSetPlaybackRate)
  // })
}
