'use strict'

const PERFORMANCE_METRICS = new Set([
  'JSHeapUsedSize',
  'JSHeapTotalSize',
  'Documents',
  'Frames',
  'Nodes',
  'LayoutCount',
  'RecalcStyleCount',
])

const getProbeSource = () => String.raw`(() => {
  'use strict'
  if (window.__LX_STAGE2_MEMORY_PROBE__) return

  const objectUrls = new Set()
  let objectUrlsCreated = 0
  let objectUrlsRevoked = 0
  const originalCreateObjectURL = window.URL.createObjectURL.bind(window.URL)
  const originalRevokeObjectURL = window.URL.revokeObjectURL.bind(window.URL)
  window.URL.createObjectURL = (...args) => {
    const url = originalCreateObjectURL(...args)
    objectUrls.add(url)
    objectUrlsCreated += 1
    return url
  }
  window.URL.revokeObjectURL = url => {
    if (objectUrls.delete(url)) objectUrlsRevoked += 1
    return originalRevokeObjectURL(url)
  }

  const liveWorkers = new Set()
  let workersCreated = 0
  let workersTerminated = 0
  const NativeWorker = window.Worker
  if (typeof NativeWorker === 'function') {
    window.Worker = new Proxy(NativeWorker, {
      construct(Target, args, NewTarget) {
        const worker = Reflect.construct(Target, args, NewTarget)
        liveWorkers.add(worker)
        workersCreated += 1
        const originalTerminate = worker.terminate
        if (typeof originalTerminate === 'function') {
          let terminated = false
          worker.terminate = function(...terminateArgs) {
            if (!terminated) {
              terminated = true
              if (liveWorkers.delete(worker)) workersTerminated += 1
            }
            return originalTerminate.apply(this, terminateArgs)
          }
        }
        return worker
      },
    })
  }

  const canvasContexts = new WeakMap()
  const contextNames = new Set(['2d', 'webgl', 'webgl2', 'bitmaprenderer'])
  const Canvas = window.HTMLCanvasElement
  if (Canvas?.prototype?.getContext) {
    const originalGetContext = Canvas.prototype.getContext
    Canvas.prototype.getContext = function(type, ...args) {
      const context = originalGetContext.call(this, type, ...args)
      if (context && contextNames.has(type)) {
        let types = canvasContexts.get(this)
        if (!types) {
          types = new Set()
          canvasContexts.set(this, types)
        }
        types.add(type)
      }
      return context
    }
  }

  const snapshot = () => {
    const images = Array.from(window.document.querySelectorAll('img'))
    const canvases = Array.from(window.document.querySelectorAll('canvas'))
    const contexts = { '2d': 0, webgl: 0, webgl2: 0, bitmaprenderer: 0 }
    for (const canvas of canvases) {
      for (const type of canvasContexts.get(canvas) ?? []) contexts[type] += 1
    }
    const loadedImages = images.filter(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
    return {
      liveObjectUrls: objectUrls.size,
      objectUrls: { live: objectUrls.size, created: objectUrlsCreated, revoked: objectUrlsRevoked },
      workers: { live: liveWorkers.size, created: workersCreated, terminated: workersTerminated },
      contexts,
      dom: {
        images: images.length,
        loadedImages: loadedImages.length,
        loadedImagePixels: loadedImages.reduce((total, image) => total + image.naturalWidth * image.naturalHeight, 0),
        videos: window.document.querySelectorAll('video').length,
        canvases: canvases.length,
      },
    }
  }

  Object.defineProperty(window, '__LX_STAGE2_MEMORY_PROBE__', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ snapshot }),
  })
})()`

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const waitForRendererReady = async(client, options = {}) => {
  const attempts = options.attempts ?? 120
  const delayMs = options.delayMs ?? 250
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const state = await client.call('Runtime.evaluate', {
        expression: `({ readyState: document.readyState, probeReady: typeof window.__LX_STAGE2_MEMORY_PROBE__?.snapshot === 'function' })`,
        returnByValue: true,
      })
      const value = state?.result?.value
      if (value?.probeReady && (value.readyState === 'interactive' || value.readyState === 'complete')) return
    } catch (error) {
      lastError = error
    }
    await delay(delayMs)
  }
  throw new Error(`Renderer did not become ready after probe installation${lastError ? `: ${lastError.message}` : ''}`)
}

const installProbe = async(client, options = {}) => {
  if (!client || typeof client.call !== 'function') throw new TypeError('CDP client is required')
  await client.call('Page.enable')
  await client.call('Page.addScriptToEvaluateOnNewDocument', { source: getProbeSource() })
  await client.call('Page.reload', { ignoreCache: false })
  await (options.waitForReady ?? waitForRendererReady)(client, options)
}

const collectRendererMetrics = async client => {
  if (!client || typeof client.call !== 'function') throw new TypeError('CDP client is required')
  await client.call('Performance.enable')
  const [performanceResult, probeResult, targetResult] = await Promise.all([
    client.call('Performance.getMetrics'),
    client.call('Runtime.evaluate', {
      expression: 'window.__LX_STAGE2_MEMORY_PROBE__.snapshot()',
      returnByValue: true,
    }),
    client.call('Target.getTargets'),
  ])
  const probe = probeResult?.result?.value
  if (!probe || typeof probe !== 'object') throw new Error('Renderer memory probe did not return a snapshot')
  const performance = Object.fromEntries((performanceResult.metrics ?? [])
    .filter(metric => PERFORMANCE_METRICS.has(metric.name))
    .map(metric => [metric.name, metric.value]))
  const targetInfos = targetResult.targetInfos ?? []
  return {
    ...probe,
    performance,
    cdpTargets: {
      workers: targetInfos.filter(target => target.type === 'worker').length,
      serviceWorkers: targetInfos.filter(target => target.type === 'service_worker').length,
    },
  }
}

module.exports = { collectRendererMetrics, getProbeSource, installProbe, waitForRendererReady }
