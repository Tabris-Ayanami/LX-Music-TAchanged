'use strict'

const createDiscoverResourceLifecycle = ({ createImage = () => new Image() } = {}) => {
  let active = false
  let generation = 0
  const pendingImages = new Set()

  const isCurrent = token => active && token === generation

  const activate = () => {
    active = true
    generation += 1
  }

  const cancelImage = image => {
    image.onload = null
    image.onerror = null
    if (typeof image.removeAttribute === 'function') image.removeAttribute('src')
    else image.src = ''
    pendingImages.delete(image)
  }

  const deactivate = () => {
    active = false
    generation += 1
    for (const image of [...pendingImages]) cancelImage(image)
  }

  const loadImage = ({ url, crossOrigin, onLoad, onError = () => {} }) => {
    if (!active || !url) return null
    const token = generation
    const image = createImage()
    pendingImages.add(image)
    if (crossOrigin) image.crossOrigin = crossOrigin

    const settle = callback => event => {
      image.onload = null
      image.onerror = null
      pendingImages.delete(image)
      if (isCurrent(token)) callback(image, event)
    }
    image.onload = settle(onLoad)
    image.onerror = settle(onError)
    image.src = url
    return image
  }

  const runWhileActive = async({ task, onSuccess = () => {}, onError = () => {}, onSettled = () => {} }) => {
    if (!active) return { status: 'inactive' }
    const token = generation
    try {
      const value = await task()
      if (!isCurrent(token)) return { status: 'stale' }
      onSuccess(value)
      onSettled()
      return { status: 'committed', value }
    } catch (error) {
      if (!isCurrent(token)) return { status: 'stale' }
      onError(error)
      onSettled()
      return { status: 'failed', error }
    }
  }

  return { activate, deactivate, loadImage, runWhileActive }
}

module.exports = { createDiscoverResourceLifecycle }
