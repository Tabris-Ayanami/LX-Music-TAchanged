const SNAPSHOT_EXPIRE_MS = 1200

/**
 * @param {DOMRect} rect
 */
const rectToPlain = (rect) => {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

const getRadiusValue = (element) => {
  if (!element) return '0px'
  return window.getComputedStyle(element).borderRadius || '0px'
}

const getTransformValue = (element) => {
  if (!element) return ''
  const transform = window.getComputedStyle(element).transform
  return transform && transform != 'none' ? transform : ''
}

let playDetailOriginSnapshot = null

const getFloatingIslandElement = () => {
  return document.querySelector('[data-play-floating-island="true"]')
}

export const capturePlayDetailOrigin = (element) => {
  if (!element) return
  const coverElement = element.querySelector('[data-play-floating-cover="true"]')
  const coverMotionElement = coverElement?.firstElementChild || coverElement
  const coverImage = coverElement?.querySelector('img')
  playDetailOriginSnapshot = {
    shellRect: rectToPlain(element.getBoundingClientRect()),
    coverRect: coverElement ? rectToPlain(coverElement.getBoundingClientRect()) : null,
    shellRadius: getRadiusValue(element),
    coverRadius: getRadiusValue(coverElement),
    coverTransform: getTransformValue(coverMotionElement),
    coverSrc: coverImage?.getAttribute('src') ?? '',
    time: Date.now(),
  }
}

export const getPlayDetailOrigin = (preferLive = false) => {
  if (!preferLive && playDetailOriginSnapshot && Date.now() - playDetailOriginSnapshot.time < SNAPSHOT_EXPIRE_MS) {
    return playDetailOriginSnapshot
  }

  const floatingIslandElement = getFloatingIslandElement()
  if (!floatingIslandElement) return null

  const coverElement = floatingIslandElement.querySelector('[data-play-floating-cover="true"]')
  const coverMotionElement = coverElement?.firstElementChild || coverElement
  const coverImage = coverElement?.querySelector('img')
  return {
    shellRect: rectToPlain(floatingIslandElement.getBoundingClientRect()),
    coverRect: coverElement ? rectToPlain(coverElement.getBoundingClientRect()) : null,
    shellRadius: getRadiusValue(floatingIslandElement),
    coverRadius: getRadiusValue(coverElement),
    coverTransform: getTransformValue(coverMotionElement),
    coverSrc: coverImage?.getAttribute('src') ?? '',
  }
}

export const clearPlayDetailOrigin = () => {
  playDetailOriginSnapshot = null
}
