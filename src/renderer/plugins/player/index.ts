import {
  computePerceptualCrossfadeGains,
  createTailActivityTracker,
  createTransitionOperation,
  relayPreparedMediaReady,
} from './transition'

interface HTMLAudioElementChrome extends HTMLAudioElement {
  setSinkId: (id: string) => Promise<void>
}
let audio: HTMLAudioElementChrome | null = null
let deckElements: [HTMLAudioElementChrome, HTMLAudioElementChrome] | null = null
let activeDeckIndex: 0 | 1 = 0
let audioContext: AudioContext
let mediaSource: AudioNode
let deckGains: [GainNode, GainNode]
let deckAnalysers: [AnalyserNode, AnalyserNode]
const deckRmsBuffers: [Float32Array<ArrayBuffer> | null, Float32Array<ArrayBuffer> | null] = [null, null]
let analyser: AnalyserNode
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext
// https://benzleung.gitbooks.io/web-audio-api-mini-guide/content/chapter5-1.html
export const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
type Freqs = (typeof freqs)[number]
let biquads: Map<`hz${Freqs}`, BiquadFilterNode>
export const freqsPreset = [
  { name: 'pop', hz31: 6, hz62: 5, hz125: -3, hz250: -2, hz500: 5, hz1000: 4, hz2000: -4, hz4000: -3, hz8000: 6, hz16000: 4 },
  { name: 'dance', hz31: 4, hz62: 3, hz125: -4, hz250: -6, hz500: 0, hz1000: 0, hz2000: 3, hz4000: 4, hz8000: 4, hz16000: 5 },
  { name: 'rock', hz31: 7, hz62: 6, hz125: 2, hz250: 1, hz500: -3, hz1000: -4, hz2000: 2, hz4000: 1, hz8000: 4, hz16000: 5 },
  { name: 'classical', hz31: 6, hz62: 7, hz125: 1, hz250: 2, hz500: -1, hz1000: 1, hz2000: -4, hz4000: -6, hz8000: -7, hz16000: -8 },
  { name: 'vocal', hz31: -5, hz62: -6, hz125: -4, hz250: -3, hz500: 3, hz1000: 4, hz2000: 5, hz4000: 4, hz8000: -3, hz16000: -3 },
  { name: 'slow', hz31: 5, hz62: 4, hz125: 2, hz250: 0, hz500: -2, hz1000: 0, hz2000: 3, hz4000: 6, hz8000: 7, hz16000: 8 },
  { name: 'electronic', hz31: 6, hz62: 5, hz125: 0, hz250: -5, hz500: -4, hz1000: 0, hz2000: 6, hz4000: 8, hz8000: 8, hz16000: 7 },
  { name: 'subwoofer', hz31: 8, hz62: 7, hz125: 5, hz250: 4, hz500: 0, hz1000: 0, hz2000: 0, hz4000: 0, hz8000: 0, hz16000: 0 },
  { name: 'soft', hz31: -5, hz62: -5, hz125: -4, hz250: -4, hz500: 3, hz1000: 2, hz2000: 4, hz4000: 4, hz8000: 0, hz16000: 0 },
] as const
export const convolutions = [
  { name: 'telephone', mainGain: 0.0, sendGain: 3.0, source: 'filter-telephone.wav' }, // 电话
  { name: 's2_r4_bd', mainGain: 1.8, sendGain: 0.9, source: 's2_r4_bd.wav' }, // 教堂
  { name: 'bright_hall', mainGain: 0.8, sendGain: 2.4, source: 'bright-hall.wav' },
  { name: 'cinema_diningroom', mainGain: 0.6, sendGain: 2.3, source: 'cinema-diningroom.wav' },
  { name: 'dining_living_true_stereo', mainGain: 0.6, sendGain: 1.8, source: 'dining-living-true-stereo.wav' },
  { name: 'living_bedroom_leveled', mainGain: 0.6, sendGain: 2.1, source: 'living-bedroom-leveled.wav' },
  { name: 'spreader50_65ms', mainGain: 1, sendGain: 2.5, source: 'spreader50-65ms.wav' },
  // { name: 'spreader25_125ms', mainGain: 1, sendGain: 2.5, source: 'spreader25-125ms.wav' },
  // { name: 'backslap', mainGain: 1.8, sendGain: 0.8, source: 'backslap1.wav' },
  { name: 's3_r1_bd', mainGain: 1.8, sendGain: 0.8, source: 's3_r1_bd.wav' },
  { name: 'matrix_1', mainGain: 1.5, sendGain: 0.9, source: 'matrix-reverb1.wav' },
  { name: 'matrix_2', mainGain: 1.3, sendGain: 1, source: 'matrix-reverb2.wav' },
  { name: 'cardiod_35_10_spread', mainGain: 1.8, sendGain: 0.6, source: 'cardiod-35-10-spread.wav' },
  { name: 'tim_omni_35_10_magnetic', mainGain: 1, sendGain: 0.2, source: 'tim-omni-35-10-magnetic.wav' },
  // { name: 'spatialized', mainGain: 1.8, sendGain: 0.8, source: 'spatialized8.wav' },
  // { name: 'zing_long_stereo', mainGain: 0.8, sendGain: 1.8, source: 'zing-long-stereo.wav' },
  { name: 'feedback_spring', mainGain: 1.8, sendGain: 0.8, source: 'feedback-spring.wav' },
  // { name: 'tim_omni_rear_blend', mainGain: 1.8, sendGain: 0.8, source: 'tim-omni-rear-blend.wav' },
] as const
// 半音
// export const semitones = [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] as const

let convolver: ConvolverNode
let convolverSourceGainNode: GainNode
let convolverOutputGainNode: GainNode
let convolverDynamicsCompressor: DynamicsCompressorNode
let gainNode: GainNode
let userVolume = 1
let isMuted = false
let panner: PannerNode
let pitchShifterNode: AudioWorkletNode
let pitchShifterNodePitchFactor: AudioParam | null
let pitchShifterNodeLoadStatus: 'none' | 'loading' | 'unconnect' | 'connected' = 'none'
let pitchShifterNodeTempValue = 1
let pitchShifterDeckBindings: Array<{
  deck: HTMLAudioElementChrome
  playing: EventListener
  pause: EventListener
  waiting: EventListener
  emptied: EventListener
}> = []
let defaultChannelCount = 2
export const soundR = 0.5
let preparedSource = ''
let preparedReady = false
let preparedDeckIndex: 0 | 1 = 1
let transitionTimer: number | null = null
let transitionRunning = false
let resourceRequestId = 0
const transitionOperation = createTransitionOperation()
const tailActivityTracker = createTailActivityTracker()
let lastTelemetryTime = 0

const isSmartTransitionEnabled = () => !!window.lxData?.appSetting?.['player.isSmartTransition']

const createDeck = () => {
  const deck = new window.Audio() as HTMLAudioElementChrome
  deck.controls = false
  deck.autoplay = false
  deck.preload = 'auto'
  deck.crossOrigin = 'anonymous'
  deck.volume = isMuted ? 0 : userVolume
  return deck
}

const getDeck = (index: 0 | 1) => deckElements?.[index] ?? null
const getActiveDeck = () => getDeck(activeDeckIndex)
const otherDeckIndex = (index: 0 | 1): 0 | 1 => index == 0 ? 1 : 0
const getStandbyDeck = () => getDeck(otherDeckIndex(activeDeckIndex))
const getDeckGain = (index: 0 | 1) => deckGains?.[index]

const setDeckGain = (index: 0 | 1, value: number) => {
  const gain = getDeckGain(index)
  if (!gain) return
  const safe = Math.min(1, Math.max(0, value))
  const now = audioContext?.currentTime ?? 0
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(safe, now)
}

const clearDeckSource = (deck: HTMLAudioElementChrome | null) => {
  if (!deck) return
  deck.pause()
  deck.removeAttribute('src')
  deck.load()
}

const cancelTransitionTimer = () => {
  if (transitionTimer == null) return
  window.clearTimeout(transitionTimer)
  transitionTimer = null
}

export const cancelPrepared = (_reason = 'cancelled') => {
  transitionOperation.cancel()
  cancelTransitionTimer()
  transitionRunning = false
  preparedSource = ''
  preparedReady = false
  const standbyIndex = otherDeckIndex(activeDeckIndex)
  setDeckGain(standbyIndex, 0)
  clearDeckSource(getStandbyDeck())
}

const cancelRunningTransition = () => {
  if (!transitionRunning) return
  transitionOperation.cancel()
  cancelTransitionTimer()
  transitionRunning = false
  const activeGain = getDeckGain(activeDeckIndex)
  if (activeGain) {
    const now = audioContext?.currentTime ?? 0
    activeGain.gain.cancelScheduledValues(now)
    activeGain.gain.setValueAtTime(1, now)
  }
  const standbyIndex = otherDeckIndex(activeDeckIndex)
  setDeckGain(standbyIndex, 0)
  clearDeckSource(getStandbyDeck())
}

export const createAudio = () => {
  if (deckElements) return
  const first = createDeck()
  const second = createDeck()
  first.autoplay = true
  deckElements = [first, second]
  audio = first
  activeDeckIndex = 0
  setDeckGain(0, 1)
  setDeckGain(1, 0)
}

// Sound-effect maintenance (for example the spatial panner) should not keep
// a timer alive before the first track starts or after playback is paused.
export const isAudioPlaying = () => !!audio && !audio.paused && !audio.ended

const initAnalyser = () => {
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
}

const initBiquadFilter = () => {
  biquads = new Map()
  let i

  for (const item of freqs) {
    const filter = audioContext.createBiquadFilter()
    biquads.set(`hz${item}`, filter)
    filter.type = 'peaking'
    filter.frequency.value = item
    filter.Q.value = 1.4
    filter.gain.value = 0
  }

  for (i = 1; i < freqs.length; i++) {
    (biquads.get(`hz${freqs[i - 1]}`)!).connect(biquads.get(`hz${freqs[i]}`)!)
  }
}

const initConvolver = () => {
  convolverSourceGainNode = audioContext.createGain()
  convolverOutputGainNode = audioContext.createGain()
  convolverDynamicsCompressor = audioContext.createDynamicsCompressor()
  convolver = audioContext.createConvolver()
  convolver.connect(convolverOutputGainNode)
  convolverSourceGainNode.connect(convolverDynamicsCompressor)
  convolverOutputGainNode.connect(convolverDynamicsCompressor)
}

const initPanner = () => {
  panner = audioContext.createPanner()
}

const initGain = () => {
  gainNode = audioContext.createGain()
}

const initAdvancedAudioFeatures = () => {
  if (audioContext) return
  createAudio()
  if (!deckElements) throw new Error('audio not defined')
  audioContext = new window.AudioContext({ latencyHint: 'playback' })
  defaultChannelCount = audioContext.destination.channelCount
  for (const deck of deckElements) deck.volume = 1

  initAnalyser()
  initBiquadFilter()
  initConvolver()
  initPanner()
  initGain()
  const mixInput = audioContext.createGain()
  const sourceA = audioContext.createMediaElementSource(deckElements[0])
  const sourceB = audioContext.createMediaElementSource(deckElements[1])
  const gainA = audioContext.createGain()
  const gainB = audioContext.createGain()
  const analyserA = audioContext.createAnalyser()
  const analyserB = audioContext.createAnalyser()
  analyserA.fftSize = 1024
  analyserB.fftSize = 1024
  sourceA.connect(analyserA)
  sourceB.connect(analyserB)
  analyserA.connect(gainA)
  analyserB.connect(gainB)
  gainA.connect(mixInput)
  gainB.connect(mixInput)
  mixInput.connect(analyser)
  deckGains = [gainA, gainB]
  deckAnalysers = [analyserA, analyserB]
  mediaSource = mixInput
  gainA.gain.value = 1
  gainB.gain.value = 0
  gainNode.gain.value = isMuted ? 0 : userVolume
  analyser.connect(biquads.get(`hz${freqs[0]}`)!)
  const lastBiquadFilter = (biquads.get(`hz${freqs.at(-1)!}`)!)
  lastBiquadFilter.connect(convolverSourceGainNode)
  lastBiquadFilter.connect(convolver)
  convolverDynamicsCompressor.connect(panner)
  panner.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // 音频输出设备改变时刷新 audio node 连接
  window.app_event.on('playerDeviceChanged', handleMediaListChange)

  // audio.addEventListener('playing', connectAudioNode)
  // audio.addEventListener('pause', disconnectAudioNode)
  // audio.addEventListener('waiting', disconnectAudioNode)
  // audio.addEventListener('emptied', disconnectAudioNode)
  // if (!audio.paused) connectAudioNode()
}

const handleMediaListChange = () => {
  if (!mediaSource) return
  mediaSource.disconnect()
  mediaSource.connect(analyser)
}

// let isConnected = true
// const connectAudioNode = () => {
//   if (isConnected) return
//   console.log('connect Node')
//   mediaSource.connect(analyser)
//   isConnected = true
//   if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
//     disconnectPitchShifterNode()
//   }
// }

// const disconnectAudioNode = () => {
//   if (!isConnected) return
//   console.log('disconnect Node')
//   mediaSource.disconnect()
//   isConnected = false
//   if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
//     disconnectPitchShifterNode()
//   }
// }

export const getAudioContext = () => {
  initAdvancedAudioFeatures()
  return audioContext
}

let unsubMediaListChangeEvent: (() => void) | null = null
export const setMaxOutputChannelCount = (enable: boolean) => {
  if (enable) {
    initAdvancedAudioFeatures()
    audioContext.destination.channelCountMode = 'max'
    audioContext.destination.channelCount = audioContext.destination.maxChannelCount
    // navigator.mediaDevices.addEventListener('devicechange', handleMediaListChange)
    if (!unsubMediaListChangeEvent) {
      let handleMediaListChange = () => {
        setMaxOutputChannelCount(true)
      }
      window.app_event.on('playerDeviceChanged', handleMediaListChange)
      unsubMediaListChangeEvent = () => {
        window.app_event.off('playerDeviceChanged', handleMediaListChange)
        unsubMediaListChangeEvent = null
      }
    }
  } else {
    unsubMediaListChangeEvent?.()
    if (audioContext && audioContext.destination.channelCountMode != 'explicit') {
      audioContext.destination.channelCount = defaultChannelCount
      // audioContext.destination.channelInterpretation
      audioContext.destination.channelCountMode = 'explicit'
    }
  }
}

export const getAnalyser = (): AnalyserNode | null => {
  initAdvancedAudioFeatures()
  return analyser
}

export const getBiquadFilter = () => {
  initAdvancedAudioFeatures()
  return biquads
}

// let isConvolverConnected = false
export const setConvolver = (buffer: AudioBuffer | null, mainGain: number, sendGain: number) => {
  initAdvancedAudioFeatures()
  convolver.buffer = buffer
  // console.log(mainGain, sendGain)
  if (buffer) {
    convolverSourceGainNode.gain.value = mainGain
    convolverOutputGainNode.gain.value = sendGain
  } else {
    convolverSourceGainNode.gain.value = 1
    convolverOutputGainNode.gain.value = 0
  }
}

export const setConvolverMainGain = (gain: number) => {
  initAdvancedAudioFeatures()
  if (convolverSourceGainNode.gain.value == gain) return
  // console.log(gain)
  convolverSourceGainNode.gain.value = gain
}

export const setConvolverSendGain = (gain: number) => {
  initAdvancedAudioFeatures()
  if (convolverOutputGainNode.gain.value == gain) return
  // console.log(gain)
  convolverOutputGainNode.gain.value = gain
}

let pannerInfo = {
  x: 0,
  y: 0,
  z: 0,
  soundR: 0.5,
  rad: 0,
  speed: 1,
  intv: null as NodeJS.Timeout | null,
}
const setPannerXYZ = (nx: number, ny: number, nz: number) => {
  pannerInfo.x = nx
  pannerInfo.y = ny
  pannerInfo.z = nz
  // console.log(pannerInfo)
  panner.positionX.value = nx * pannerInfo.soundR
  panner.positionY.value = ny * pannerInfo.soundR
  panner.positionZ.value = nz * pannerInfo.soundR
}
export const setPannerSoundR = (r: number) => {
  pannerInfo.soundR = r
}

export const setPannerSpeed = (speed: number) => {
  pannerInfo.speed = speed
  if (pannerInfo.intv) startPanner()
}
export const stopPanner = () => {
  if (pannerInfo.intv) {
    clearInterval(pannerInfo.intv)
    pannerInfo.intv = null
    pannerInfo.rad = 0
  }
  if (!panner) return
  panner.positionX.value = 0
  panner.positionY.value = 0
  panner.positionZ.value = 0
}

export const startPanner = () => {
  initAdvancedAudioFeatures()
  if (pannerInfo.intv) {
    clearInterval(pannerInfo.intv)
    pannerInfo.intv = null
    pannerInfo.rad = 0
  }
  pannerInfo.intv = setInterval(() => {
    pannerInfo.rad += 1
    if (pannerInfo.rad > 360) pannerInfo.rad -= 360
    setPannerXYZ(Math.sin(pannerInfo.rad * Math.PI / 180), Math.cos(pannerInfo.rad * Math.PI / 180), Math.cos(pannerInfo.rad * Math.PI / 180))
  }, pannerInfo.speed * 10)
}

let isConnected = true
const connectNode = () => {
  if (isConnected) return
  console.log('connect Node')
  analyser?.connect(biquads.get(`hz${freqs[0]}`)!)
  isConnected = true
  if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
    disconnectPitchShifterNode()
  }
}
const disconnectNode = () => {
  if (!isConnected) return
  console.log('disconnect Node')
  analyser?.disconnect()
  isConnected = false
  if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
    disconnectPitchShifterNode()
  }
}
const connectPitchShifterNode = () => {
  console.log('connect Pitch Shifter Node')
  for (const binding of pitchShifterDeckBindings) {
    binding.deck.removeEventListener('playing', binding.playing)
    binding.deck.removeEventListener('pause', binding.pause)
    binding.deck.removeEventListener('waiting', binding.waiting)
    binding.deck.removeEventListener('emptied', binding.emptied)
  }
  pitchShifterDeckBindings = []
  for (const deck of deckElements ?? []) {
    const playing: EventListener = event => {
      if (event.currentTarget === audio) connectNode()
    }
    const pause: EventListener = event => {
      if (event.currentTarget === audio) disconnectNode()
    }
    const waiting: EventListener = event => {
      if (event.currentTarget === audio) disconnectNode()
    }
    const emptied: EventListener = event => {
      if (event.currentTarget === audio) disconnectNode()
    }
    deck.addEventListener('playing', playing)
    deck.addEventListener('pause', pause)
    deck.addEventListener('waiting', waiting)
    deck.addEventListener('emptied', emptied)
    pitchShifterDeckBindings.push({ deck, playing, pause, waiting, emptied })
  }
  if (audio?.paused) disconnectNode()

  const lastBiquadFilter = (biquads.get(`hz${freqs.at(-1)!}`)!)
  lastBiquadFilter.disconnect()
  lastBiquadFilter.connect(pitchShifterNode)

  pitchShifterNode.connect(convolver)
  pitchShifterNode.connect(convolverSourceGainNode)
  // convolverDynamicsCompressor.disconnect(panner)
  // convolverDynamicsCompressor.connect(pitchShifterNode)
  // pitchShifterNode.connect(panner)
  pitchShifterNodeLoadStatus = 'connected'
  pitchShifterNodePitchFactor!.value = pitchShifterNodeTempValue
}
const disconnectPitchShifterNode = () => {
  console.log('disconnect Pitch Shifter Node')
  const lastBiquadFilter = (biquads.get(`hz${freqs.at(-1)!}`)!)
  lastBiquadFilter.disconnect()
  lastBiquadFilter.connect(convolver)
  lastBiquadFilter.connect(convolverSourceGainNode)
  pitchShifterNodeLoadStatus = 'unconnect'
  pitchShifterNodePitchFactor = null

  for (const binding of pitchShifterDeckBindings) {
    binding.deck.removeEventListener('playing', binding.playing)
    binding.deck.removeEventListener('pause', binding.pause)
    binding.deck.removeEventListener('waiting', binding.waiting)
    binding.deck.removeEventListener('emptied', binding.emptied)
  }
  pitchShifterDeckBindings = []
  connectNode()
}
const loadPitchShifterNode = () => {
  pitchShifterNodeLoadStatus = 'loading'
  initAdvancedAudioFeatures()
  // source -> analyser -> biquadFilter -> audioWorklet(pitch shifter) -> [(convolver & convolverSource)->convolverDynamicsCompressor] -> panner -> gain
  void audioContext.audioWorklet.addModule(new URL(
    /* webpackChunkName: 'pitch_shifter.audioWorklet' */
    './pitch-shifter/phase-vocoder.js',
    import.meta.url,
  )).then(() => {
    console.log('pitch shifter audio worklet loaded')
    // https://github.com/olvb/phaze/issues/26#issuecomment-1574629971
    pitchShifterNode = new AudioWorkletNode(audioContext, 'phase-vocoder-processor', { outputChannelCount: [2] })
    let pitchFactorParam = pitchShifterNode.parameters.get('pitchFactor')
    if (!pitchFactorParam) return
    pitchShifterNodePitchFactor = pitchFactorParam
    pitchShifterNodeLoadStatus = 'unconnect'
    if (pitchShifterNodeTempValue == 1) return

    connectPitchShifterNode()
  })
}

export const setPitchShifter = (val: number) => {
  // console.log('setPitchShifter', val)
  pitchShifterNodeTempValue = val
  switch (pitchShifterNodeLoadStatus) {
    case 'loading':
      break
    case 'none':
      loadPitchShifterNode()
      break
    case 'connected':
      // a: 1 = 半音
      // value = 2 ** (a / 12)
      pitchShifterNodePitchFactor!.value = val
      break
    case 'unconnect':
      connectPitchShifterNode()
      break
  }
}

export const hasInitedAdvancedAudioFeatures = (): boolean => audioContext != null

const clearPreparedWithoutInvalidating = () => {
  preparedSource = ''
  preparedReady = false
  const standbyIndex = activeDeckIndex == 0 ? 1 : 0
  setDeckGain(standbyIndex, 0)
  clearDeckSource(getStandbyDeck())
}

const scheduleGainCurve = (index: 0 | 1, deck: 'outgoing' | 'incoming', durationSec: number, breathRatio: number, startAt: number) => {
  const gain = getDeckGain(index)
  if (!gain || !audioContext) return
  const duration = Math.max(0.25, durationSec)
  const values = new Float32Array(96)
  for (let i = 0; i < values.length; i++) {
    const progress = i / (values.length - 1)
    const crossfade = computePerceptualCrossfadeGains(progress, { breathRatio })
    values[i] = deck == 'incoming' ? crossfade.incomingGain : crossfade.outgoingGain
  }
  // Use the same future anchor for both decks. A sequence of ordered ramps is
  // more reliable in Chromium than setValueCurveAtTime when a media element
  // becomes ready immediately (as local files commonly do).
  gain.gain.cancelScheduledValues(startAt - 0.01)
  gain.gain.setValueAtTime(values[0], startAt)
  for (let i = 1; i < values.length; i++) {
    gain.gain.linearRampToValueAtTime(values[i], startAt + (duration * i / (values.length - 1)))
  }
}

const finishPreparedTransition = (operationToken: number, outgoingIndex: 0 | 1, incomingIndex: 0 | 1) => {
  if (!transitionOperation.isCurrent(operationToken)) return
  transitionRunning = false
  transitionTimer = null
  setDeckGain(incomingIndex, 1)
  setDeckGain(outgoingIndex, 0)
  clearDeckSource(getDeck(outgoingIndex))
  preparedSource = ''
  preparedReady = false
}

export const startPreparedTransition = (overlapSec = 5) => {
  if (!preparedReady || !preparedSource || transitionRunning) return false
  const outgoing = getActiveDeck()
  const incoming = getDeck(preparedDeckIndex)
  if (!outgoing || !incoming || outgoing.paused || outgoing.ended) return false

  try {
    initAdvancedAudioFeatures()
  } catch (error) {
    console.warn('[transition] Web Audio unavailable, using immediate load', error)
    return false
  }

  const operationToken = transitionOperation.begin()
  const outgoingIndex = activeDeckIndex
  const incomingIndex = preparedDeckIndex
  const durationSec = Math.max(0.75, Math.min(8, overlapSec))
  incoming.currentTime = 0
  incoming.volume = 1
  setDeckGain(outgoingIndex, 1)
  setDeckGain(incomingIndex, 0)

  activeDeckIndex = incomingIndex
  audio = incoming
  transitionRunning = true
  relayPreparedMediaReady(incoming)
  const breathRatio = Math.min(0.34, Math.max(0.2, 1 / durationSec))
  const curveStartAt = audioContext.currentTime + 0.03
  try {
    scheduleGainCurve(outgoingIndex, 'outgoing', durationSec, breathRatio, curveStartAt)
    scheduleGainCurve(incomingIndex, 'incoming', durationSec, breathRatio, curveStartAt)
  } catch (error) {
    console.warn('[transition] gain curve scheduling failed, using immediate load', error)
    transitionOperation.cancel()
    cancelTransitionTimer()
    transitionRunning = false
    activeDeckIndex = outgoingIndex
    audio = outgoing
    setDeckGain(outgoingIndex, 1)
    setDeckGain(incomingIndex, 0)
    clearDeckSource(incoming)
    preparedSource = ''
    preparedReady = false
    return false
  }

  void incoming.play().catch((error: unknown) => {
    if (!transitionOperation.isCurrent(operationToken)) return
    console.warn('[transition] incoming play failed', error)
    transitionOperation.cancel()
    cancelTransitionTimer()
    transitionRunning = false
    activeDeckIndex = outgoingIndex
    audio = outgoing
    setDeckGain(outgoingIndex, 1)
    setDeckGain(incomingIndex, 0)
    clearDeckSource(incoming)
    preparedSource = ''
    preparedReady = false
  })

  transitionTimer = window.setTimeout(() => {
    finishPreparedTransition(operationToken, outgoingIndex, incomingIndex)
  }, durationSec * 1000 + 80)
  return true
}

export const prepareNext = async(src: string): Promise<boolean> => {
  if (!src) return false
  createAudio()
  cancelRunningTransition()
  cancelPrepared()
  const operationToken = transitionOperation.begin()
  preparedDeckIndex = activeDeckIndex == 0 ? 1 : 0
  const deck = getDeck(preparedDeckIndex)
  if (!deck) return false
  deck.autoplay = false
  deck.volume = audioContext ? 1 : isMuted ? 0 : userVolume
  deck.preload = 'auto'

  return await new Promise<boolean>(resolve => {
    let settled = false
    const cleanup = () => {
      window.clearTimeout(timeout)
      deck.removeEventListener('canplay', handleReady)
      deck.removeEventListener('error', handleError)
      deck.removeEventListener('abort', handleError)
    }
    const finish = (ready: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      if (!transitionOperation.isCurrent(operationToken)) {
        resolve(false)
        return
      }
      if (ready) {
        preparedSource = src
        preparedReady = true
        setDeckGain(preparedDeckIndex, 0)
      } else {
        clearPreparedWithoutInvalidating()
      }
      resolve(ready)
    }
    const handleReady = () => { finish(true) }
    const handleError = () => { finish(false) }
    const timeout = window.setTimeout(() => { finish(false) }, 8000)
    deck.addEventListener('canplay', handleReady, { once: true })
    deck.addEventListener('error', handleError, { once: true })
    deck.addEventListener('abort', handleError, { once: true })
    deck.src = src
    deck.load()
  })
}

export const setResource = (src: string, transition = isSmartTransitionEnabled()) => {
  const requestId = ++resourceRequestId
  createAudio()
  const current = getActiveDeck()
  if (!current) return
  if (!transition || !isSmartTransitionEnabled() || !current.src || current.paused || current.ended) {
    loadImmediate(src)
    return
  }
  void prepareNext(src).then(ready => {
    if (requestId != resourceRequestId) return
    if (!ready) {
      loadImmediate(src)
      return
    }
    if (!startPreparedTransition()) loadImmediate(src)
  })
}

const loadImmediate = (src: string) => {
  createAudio()
  cancelRunningTransition()
  cancelPrepared()
  const current = getActiveDeck()
  if (!current) return
  current.autoplay = true
  setDeckGain(activeDeckIndex, 1)
  current.volume = audioContext ? 1 : isMuted ? 0 : userVolume
  current.src = src
  current.load()
}

export const setPlay = () => {
  void getActiveDeck()?.play().catch((err: unknown) => {
    console.warn('audio play failed', err)
  })
}

export const setPause = () => {
  resourceRequestId++
  cancelRunningTransition()
  cancelPrepared('pause')
  getActiveDeck()?.pause()
  getStandbyDeck()?.pause()
}

export const setStop = () => {
  resourceRequestId++
  cancelRunningTransition()
  cancelPrepared('stop')
  for (const deck of deckElements ?? []) clearDeckSource(deck)
  setDeckGain(activeDeckIndex, 1)
  setDeckGain(otherDeckIndex(activeDeckIndex), 0)
}

export const isEmpty = (): boolean => !getActiveDeck()?.src

export const setLoopPlay = (isLoop: boolean) => {
  for (const deck of deckElements ?? []) deck.loop = isLoop
}

export const getPlaybackRate = (): number => getActiveDeck()?.defaultPlaybackRate ?? 1

export const setPlaybackRate = (rate: number) => {
  for (const deck of deckElements ?? []) {
    deck.defaultPlaybackRate = rate
    deck.playbackRate = rate
  }
}

export const setPreservesPitch = (preservesPitch: boolean) => {
  for (const deck of deckElements ?? []) deck.preservesPitch = preservesPitch
}

export const getMute = (): boolean => isMuted

export const setMute = (mute: boolean) => {
  isMuted = mute
  if (gainNode) gainNode.gain.value = mute ? 0 : userVolume
  else for (const deck of deckElements ?? []) deck.volume = mute ? 0 : userVolume
}

export const getCurrentTime = () => getActiveDeck()?.currentTime ?? 0

export const setCurrentTime = (time: number) => {
  const current = getActiveDeck()
  if (current) current.currentTime = time
}

export const setMediaDeviceId = async(mediaDeviceId: string): Promise<void> => {
  const decks = deckElements ?? []
  await Promise.all(decks.map(async deck => { await deck.setSinkId(mediaDeviceId) }))
}

export const setVolume = (volume: number) => {
  userVolume = Math.min(1, Math.max(0, volume))
  if (gainNode) gainNode.gain.value = isMuted ? 0 : userVolume
  else for (const deck of deckElements ?? []) deck.volume = isMuted ? 0 : userVolume
}

export const getDuration = () => getActiveDeck()?.duration ?? 0

const readDeckRms = (index: 0 | 1) => {
  const sourceAnalyser = deckAnalysers?.[index]
  if (!sourceAnalyser) return 0
  let buffer = deckRmsBuffers[index]
  if (!buffer || buffer.length != sourceAnalyser.fftSize) {
    buffer = new Float32Array(sourceAnalyser.fftSize)
    deckRmsBuffers[index] = buffer
  }
  sourceAnalyser.getFloatTimeDomainData(buffer)
  let sum = 0
  for (const sample of buffer) sum += sample * sample
  return Math.sqrt(sum / Math.max(1, buffer.length))
}

export const getTransitionTelemetry = () => {
  const current = getActiveDeck()
  const currentTime = current?.currentTime ?? 0
  if (currentTime < lastTelemetryTime) tailActivityTracker.reset()
  lastTelemetryTime = currentTime
  const activity = readDeckRms(activeDeckIndex)
  const tail = tailActivityTracker.update(activity, currentTime)
  return {
    prepared: preparedReady,
    playing: !!current && !current.paused && !current.ended,
    remainingSec: Math.max(0, (current?.duration ?? 0) - currentTime),
    rms: tail.rms,
    silenceSec: tail.silenceSec,
  }
}

// export const getPlaybackRate = () => {
//   return audio?.playbackRate ?? 1
// }

type Noop = () => void
type PlayerEventName = 'playing' | 'pause' | 'ended' | 'error' | 'loadeddata' | 'loadstart' | 'canplay' | 'emptied' | 'timeupdate' | 'durationchange' | 'waiting'

const listenPlayerEvent = (event: PlayerEventName, callback: Noop) => {
  const decks = deckElements ?? []
  const wrapper = (e: Event) => {
    if (e.currentTarget === audio) callback()
  }
  for (const deck of decks) deck.addEventListener(event, wrapper)
  return () => {
    for (const deck of decks) deck.removeEventListener(event, wrapper)
  }
}

export const onPlaying = (callback: Noop) => listenPlayerEvent('playing', callback)
export const onPause = (callback: Noop) => listenPlayerEvent('pause', callback)
export const onEnded = (callback: Noop) => listenPlayerEvent('ended', callback)
export const onError = (callback: Noop) => listenPlayerEvent('error', callback)
export const onLoadeddata = (callback: Noop) => listenPlayerEvent('loadeddata', callback)
export const onLoadstart = (callback: Noop) => listenPlayerEvent('loadstart', callback)
export const onCanplay = (callback: Noop) => listenPlayerEvent('canplay', callback)
export const onEmptied = (callback: Noop) => listenPlayerEvent('emptied', callback)
export const onTimeupdate = (callback: Noop) => listenPlayerEvent('timeupdate', callback)
export const onDurationchange = (callback: Noop) => listenPlayerEvent('durationchange', callback)
export const onWaiting = (callback: Noop) => listenPlayerEvent('waiting', callback)

export const onVisibilityChange = (callback: Noop) => {
  document.addEventListener('visibilitychange', callback)
  return () => {
    document.removeEventListener('visibilitychange', callback)
  }
}


export const getErrorCode = () => {
  return audio?.error?.code
}
