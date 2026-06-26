import { BaseBackgroundRender } from './BaseBackgroundRender'

type WorkerCommand =
  | { type: 'init', canvas: OffscreenCanvas, width: number, height: number, colors: string[] }
  | { type: 'resize', width: number, height: number }
  | { type: 'colors', colors: string[] }
  | { type: 'play', isPlaying: boolean }
  | { type: 'pause', paused: boolean }
  | { type: 'coverImage', imageData: ImageBitmap }

export class WebWorkerBackgroundRender extends BaseBackgroundRender {
  private readonly canvas: HTMLCanvasElement
  private worker: Worker | null = null
  private readonly coverTextureSize = 512

  constructor(canvas: HTMLCanvasElement, targetFps: number = 60) {
    super(targetFps)
    this.canvas = canvas
  }

  start(colors: string[] = []) {
    if (!WebWorkerBackgroundRender.isSupported(this.canvas)) {
      console.warn('WebWorker background renderer requires OffscreenCanvas support')
      return
    }

    this.stop()

    try {
      const offscreen = this.canvas.transferControlToOffscreen()
      this.canvas.dataset.offscreenTransferred = 'true'
      this.worker = new Worker(new URL(
        /* webpackChunkName: 'play-detail-aura-background.worker' */
        './webWorkerBackground.worker',
        import.meta.url,
      ))
      const command: WorkerCommand = {
        type: 'init',
        canvas: offscreen,
        width: this.canvas.clientWidth,
        height: this.canvas.clientHeight,
        colors,
      }
      this.worker.postMessage(command, [offscreen])
    } catch (error) {
      console.error('Failed to initialize aura background renderer', error)
      this.worker = null
    }
  }

  stop() {
    if (!this.worker) return
    this.worker.terminate()
    this.worker = null
  }

  resize(width: number, height: number) {
    if (!this.worker) return
    const command: WorkerCommand = { type: 'resize', width, height }
    this.worker.postMessage(command)
  }

  override setPaused(paused: boolean) {
    super.setPaused(paused)
    if (!this.worker) return
    this.worker.postMessage({ type: 'pause', paused })
  }

  setPlaying(isPlaying: boolean) {
    if (!this.worker) return
    this.worker.postMessage({ type: 'play', isPlaying })
  }

  setColors(colors: string[]) {
    if (!this.worker) return
    this.worker.postMessage({ type: 'colors', colors })
  }

  async setCoverImage(url: string, signal?: AbortSignal) {
    if (!this.worker) return
    try {
      const response = await fetch(url, { signal })
      const blob = await response.blob()
      if (signal?.aborted) return
      const sourceBitmap = await createImageBitmap(blob)
      if (signal?.aborted) {
        sourceBitmap.close?.()
        return
      }
      const bitmap = await this.createCoverBitmap(sourceBitmap)
      sourceBitmap.close?.()
      if (signal?.aborted) {
        bitmap.close?.()
        return
      }
      const command: WorkerCommand = { type: 'coverImage', imageData: bitmap }
      this.worker.postMessage(command, [bitmap])
    } catch (error) {
      if (signal?.aborted) return
      console.warn('Failed to load cover image for aura background renderer', error)
    }
  }

  setCoverBitmap(bitmap: ImageBitmap) {
    if (!this.worker) return
    const command: WorkerCommand = { type: 'coverImage', imageData: bitmap }
    this.worker.postMessage(command, [bitmap])
  }

  private async createCoverBitmap(bitmap: ImageBitmap) {
    const size = this.coverTextureSize
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')
    if (!ctx) return createImageBitmap(bitmap)

    const scale = Math.max(size / bitmap.width, size / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    ctx.drawImage(bitmap, (size - width) * 0.5, (size - height) * 0.5, width, height)
    return createImageBitmap(canvas)
  }

  static isSupported(canvas: HTMLCanvasElement) {
    return (
      typeof window !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof canvas.transferControlToOffscreen === 'function'
    )
  }
}
