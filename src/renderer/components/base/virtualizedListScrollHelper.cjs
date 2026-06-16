const easeInOutQuad = (t, b, c, d) => {
  t /= d / 2
  if (t < 1) return (c / 2) * t * t + b
  t--
  return (-c / 2) * (t * (t - 2) - 1) + b
}

const setElementScrollTop = (element, value) => {
  if (typeof element.scrollTo === 'function') element.scrollTo(0, value)
  else element.scrollTop = value
}

const clampScrollTarget = (element, target) => {
  const start = element.scrollTop || element.scrollY || 0
  let nextTarget = target
  if (nextTarget > start) {
    const maxScrollTop = element.scrollHeight - element.clientHeight
    if (nextTarget > maxScrollTop) nextTarget = maxScrollTop
  } else if (nextTarget < start) {
    if (nextTarget < 0) nextTarget = 0
  }
  return {
    start,
    target: nextTarget,
  }
}

const animateElementScroll = ({
  element,
  to,
  duration = 300,
  scheduler = globalThis,
  onComplete = () => {},
  onCancel = () => {},
} = {}) => {
  if (!element) {
    onComplete()
    return () => {}
  }

  const { start, target } = clampScrollTarget(element, to)
  const change = target - start
  if (!change) {
    onComplete()
    return () => {}
  }

  let startTime = 0
  let frameId = null
  let finished = false
  let cancelCallback = null

  const requestFrame = scheduler.requestAnimationFrame?.bind(scheduler) ?? (callback => scheduler.setTimeout(() => callback(Date.now()), 16))
  const cancelFrame = scheduler.cancelAnimationFrame?.bind(scheduler) ?? scheduler.clearTimeout?.bind(scheduler)

  const clearFrame = () => {
    if (frameId != null) {
      cancelFrame(frameId)
      frameId = null
    }
  }

  const finish = callback => {
    if (finished) return
    finished = true
    clearFrame()
    callback?.()
  }

  const step = timestamp => {
    if (finished) return
    frameId = null
    if (!startTime) startTime = timestamp
    const currentTime = Math.min(timestamp - startTime, duration)
    const value = parseInt(easeInOutQuad(currentTime, start, change, duration))
    setElementScrollTop(element, value)

    if (currentTime >= duration) {
      finish(onComplete)
      return
    }

    frameId = requestFrame(step)
  }

  frameId = requestFrame(step)

  return callback => {
    if (finished) return
    cancelCallback = typeof callback === 'function' ? callback : cancelCallback
    const currentCancelCallback = cancelCallback
    cancelCallback = null
    finish(() => {
      currentCancelCallback?.()
      onCancel()
    })
  }
}

module.exports = {
  animateElementScroll,
}
