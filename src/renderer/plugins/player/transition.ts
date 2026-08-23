export interface TailActivityState {
  rms: number
  peakRms: number
  silenceSec: number
  isSilent: boolean
}

export interface TailActivityTracker {
  update: (rms: number, nowSec: number) => TailActivityState
  reset: () => void
}

export interface TailActivityTrackerOptions {
  silenceDurationSec?: number
  thresholdRatio?: number
  floorRms?: number
  peakDecayPerSec?: number
}

export interface TransitionStartOptions {
  prepared: boolean
  playing: boolean
  remainingSec: number
  silenceSec?: number
  minOverlapSec?: number
  maxOverlapSec?: number
  maxLeadSec?: number
}

export type TransitionStartReason = 'tail-silence' | 'fallback-window' | 'not-ready' | 'not-playing' | 'too-early' | 'expired'

export interface TransitionStartDecision {
  shouldStart: boolean
  overlapSec: number
  reason: TransitionStartReason
}

interface PreparedMediaEventTarget {
  readonly readyState: number
  dispatchEvent: (event: Event) => boolean
}

export interface PreserveOutgoingProgressOptions {
  enabled: boolean
  playing: boolean
  empty: boolean
}

export const shouldPreserveOutgoingProgress = (options: PreserveOutgoingProgressOptions): boolean => {
  return options.enabled && options.playing && !options.empty
}

export const relayPreparedMediaReady = (media: PreparedMediaEventTarget): boolean => {
  // HAVE_CURRENT_DATA (2) or above means loadeddata already happened while this
  // element was still the standby deck. Relay it now that the deck is active.
  if (media.readyState < 2) return false
  media.dispatchEvent(new Event('loadeddata'))
  return true
}

export const createTailActivityTracker = (options: TailActivityTrackerOptions = {}): TailActivityTracker => {
  const silenceDurationSec = options.silenceDurationSec ?? 0.3
  const thresholdRatio = options.thresholdRatio ?? 0.18
  const floorRms = options.floorRms ?? 0.003
  const peakDecayPerSec = options.peakDecayPerSec ?? 0.35
  let peakRms = 0
  let silenceStartedAt: number | null = null
  let lastTime = 0

  const reset = () => {
    peakRms = 0
    silenceStartedAt = null
    lastTime = 0
  }

  const update = (rawRms: number, nowSec: number): TailActivityState => {
    const rms = Math.max(0, Number.isFinite(rawRms) ? rawRms : 0)
    const now = Math.max(lastTime, Number.isFinite(nowSec) ? nowSec : lastTime)
    const elapsed = Math.max(0, now - lastTime)
    const decayedPeak = peakRms * Math.max(0, 1 - peakDecayPerSec * elapsed)
    peakRms = Math.max(rms, decayedPeak)
    const threshold = Math.max(floorRms, peakRms * thresholdRatio)
    // Do not classify a track's quiet intro as its tail until the analyser has
    // observed a meaningful signal above the noise floor.
    const isBelowThreshold = peakRms > floorRms * 1.5 && rms <= threshold

    if (isBelowThreshold) {
      silenceStartedAt ??= now
    } else {
      silenceStartedAt = null
    }
    lastTime = now

    const silenceSec = silenceStartedAt == null ? 0 : Math.max(0, now - silenceStartedAt)
    return { rms, peakRms, silenceSec, isSilent: silenceSec >= silenceDurationSec }
  }

  return { update, reset }
}

export const computeEqualPowerGains = (progress: number) => {
  const safeProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  if (safeProgress == 0) return { outgoingGain: 1, incomingGain: 0 }
  if (safeProgress == 1) return { outgoingGain: 0, incomingGain: 1 }
  return {
    outgoingGain: Math.cos(safeProgress * Math.PI * 0.5),
    incomingGain: Math.sin(safeProgress * Math.PI * 0.5),
  }
}

export interface PerceptualCrossfadeOptions {
  breathRatio?: number
  outgoingEarlyDrop?: number
  outgoingShape?: number
  incomingStartGain?: number
  incomingEndGain?: number
  totalMixCap?: number
}

export const computePerceptualCrossfadeGains = (
  progress: number,
  options: PerceptualCrossfadeOptions = {},
) => {
  const safeProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  if (safeProgress == 0) return { outgoingGain: 1, incomingGain: 0 }
  if (safeProgress == 1) return { outgoingGain: 0, incomingGain: 1 }

  const breathRatio = Math.min(0.46, Math.max(0.2, options.breathRatio ?? 0.22))
  const incomingProgress = safeProgress <= breathRatio
    ? 0
    : (safeProgress - breathRatio) / (1 - breathRatio)
  // Ease the outgoing timeline forward: most of the audible reduction happens
  // early, while the quiet tail decays more gently instead of lingering loudly.
  const outgoingEarlyDrop = Math.min(2, Math.max(1, options.outgoingEarlyDrop ?? 2))
  const outgoingProgress = 1 - Math.pow(1 - safeProgress, outgoingEarlyDrop)
  const outgoingCore = Math.cos(outgoingProgress * Math.PI * 0.5)
  const outgoingDuck = 1 - (0.14 * safeProgress) - (0.12 * Math.pow(safeProgress, 2.2))
  const outgoingShape = Math.max(1, options.outgoingShape ?? 1.15)
  const outgoingGain = Math.min(1, Math.max(0, Math.pow(
    outgoingCore * Math.max(0, outgoingDuck),
    outgoingShape,
  )))
  const incomingEnvelope = Math.sin(incomingProgress * Math.PI * 0.5)
  const incomingStartGain = Math.min(1, Math.max(0, options.incomingStartGain ?? 0.84))
  const incomingEndGain = Math.min(1, Math.max(incomingStartGain, options.incomingEndGain ?? 0.94))
  const incomingGainRaw = incomingEnvelope * (
    incomingStartGain + (incomingEndGain - incomingStartGain) * Math.pow(incomingProgress, 0.9)
  )
  const totalMixCap = Math.min(1.25, Math.max(0.84, options.totalMixCap ?? 1.04))
  const incomingGain = Math.min(incomingGainRaw, Math.max(0, totalMixCap - outgoingGain))
  return { outgoingGain, incomingGain }
}

export const chooseTransitionStart = (options: TransitionStartOptions): TransitionStartDecision => {
  const minOverlapSec = Math.max(0.5, options.minOverlapSec ?? 2)
  const maxOverlapSec = Math.max(minOverlapSec, options.maxOverlapSec ?? 4.5)
  const maxLeadSec = Math.max(maxOverlapSec, options.maxLeadSec ?? 8)
  const remainingSec = Number.isFinite(options.remainingSec) ? options.remainingSec : 0

  if (!options.prepared) return { shouldStart: false, overlapSec: 0, reason: 'not-ready' }
  if (!options.playing) return { shouldStart: false, overlapSec: 0, reason: 'not-playing' }
  if (remainingSec <= 0) return { shouldStart: false, overlapSec: 0, reason: 'expired' }
  if (remainingSec > maxLeadSec) return { shouldStart: false, overlapSec: 0, reason: 'too-early' }

  if ((options.silenceSec ?? 0) >= 0.3) {
    return {
      shouldStart: true,
      overlapSec: Math.min(maxOverlapSec, Math.max(minOverlapSec, 2)),
      reason: 'tail-silence',
    }
  }

  if (remainingSec <= maxOverlapSec) {
    return {
      shouldStart: true,
      overlapSec: Math.min(maxOverlapSec, Math.max(minOverlapSec, remainingSec)),
      reason: 'fallback-window',
    }
  }

  return { shouldStart: false, overlapSec: 0, reason: 'too-early' }
}

export const createTransitionOperation = () => {
  let token = 0
  return {
    begin: () => ++token,
    isCurrent: (candidate: number) => candidate > 0 && candidate == token,
    cancel: () => { token++ },
  }
}
