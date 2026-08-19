/**
 * HLS master 播放列表解析：优先挑选 H.264(AVC) 变体，
 * 兼容 Chromium/Electron 的原生 HLS 播放（HEVC 需硬解，不确定环境可能失败）。
 */

export interface HlsVariant {
  /** 变体播放列表（相对或绝对地址） */
  uri: string
  /** CODECS 字符串，如 "avc1.64001f,mp4a.40.2" */
  codecs: string
  /** 分辨率字符串，如 "1080x1080" */
  resolution: string
  /** 带宽 bps */
  bandwidth: number
  /** 宽 */
  width: number
  /** 高 */
  height: number
}

const isAvc = (codecs: string): boolean => /avc1|avc3|mp4v/i.test(codecs)

/** 解析 master 播放列表中的视频变体 */
export const parseMasterPlaylist = (content: string): HlsVariant[] => {
  const variants: HlsVariant[] = []
  const lines = content.split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue

    // 下一行为变体 URI
    let uri = ''
    for (let next = index + 1; next < lines.length; next++) {
      const candidate = lines[next].trim()
      if (!candidate) continue
      if (candidate.startsWith('#')) break
      uri = candidate
      break
    }
    if (!uri) continue

    const codecs = /CODECS="([^"]*)"/.exec(line)?.[1] ?? ''
    const resolution = /RESOLUTION=(\d+x\d+)/.exec(line)?.[1] ?? ''
    const bandwidth = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? 0)
    const [width = 0, height = 0] = resolution.split('x').map(Number)

    variants.push({ uri, codecs, resolution, bandwidth, width, height })
  }
  return variants
}

/** 挑选最佳变体：优先 AVC，其次 HEVC 中分辨率适中者 */
export const pickBestVariant = (content: string, _masterUrl: string): HlsVariant | null => {
  const variants = parseMasterPlaylist(content)
  if (!variants.length) return null

  const avcList = variants.filter(variant => isAvc(variant.codecs))
  if (avcList.length) {
    // 动态封面按此前确认的 640px 上限取最高可用档，避免在大图层重复解码 1080p。
    const withResolution = avcList.filter(variant => variant.width > 0 && variant.height > 0)
    const withinTarget = withResolution.filter(variant => Math.max(variant.width, variant.height) <= 640)
    const sorted = [...(withinTarget.length ? withinTarget : withResolution)].sort((a, b) => {
      const edgeDiff = Math.max(b.width, b.height) - Math.max(a.width, a.height)
      if (edgeDiff) return withinTarget.length ? edgeDiff : -edgeDiff
      return b.bandwidth - a.bandwidth
    })
    return sorted[0] ?? avcList[0]
  }

  // 没有 AVC 时保留原来的中等分辨率降级策略。
  const sorted = [...variants].sort((a, b) => {
    const areaDiff = (b.width * b.height) - (a.width * a.height)
    if (areaDiff) return areaDiff
    return b.bandwidth - a.bandwidth
  })
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0]
}

/** 将变体 URI 解析为完整地址 */
export const resolveVariantMediaUrl = (variant: HlsVariant, masterUrl: string): string => {
  try {
    return new URL(variant.uri, masterUrl).href
  } catch (_) {
    return variant.uri
  }
}

interface HlsEngine {
  loadSource: (source: string) => void
  attachMedia: (video: HTMLVideoElement) => void
  on: (...args: any[]) => void
  destroy: () => void
}

interface HlsEngineConstructor {
  new (config?: Record<string, unknown>): HlsEngine
  isSupported: () => boolean
  Events: { ERROR: string, MANIFEST_PARSED: string }
}

interface DynamicArtworkPlaybackOptions {
  loadHls?: () => Promise<HlsEngineConstructor | { default: HlsEngineConstructor }>
  onFatalError?: () => void
  onPlaybackError?: () => void
}

const isHlsSource = (source: string): boolean => /\.m3u8(?:$|[?#])/i.test(source)

const clearVideoSource = (video: HTMLVideoElement) => {
  video.removeAttribute('src')
  video.load()
}

/**
 * Attach one dynamic-artwork source to a video element.
 *
 * Chromium's native HLS support varies by platform. Prefer it when advertised,
 * otherwise lazy-load hls.js and feed the stream through Media Source Extensions.
 * The returned release function must be called when the artwork becomes inactive.
 */
export const attachDynamicArtworkSource = async(
  video: HTMLVideoElement,
  source: string,
  options: DynamicArtworkPlaybackOptions = {},
): Promise<() => void> => {
  let engine: HlsEngine | null = null
  let released = false
  const release = () => {
    if (released) return
    released = true
    engine?.destroy()
    engine = null
    clearVideoSource(video)
  }

  const startPlayback = () => {
    if (released || !video.paused) return
    void video.play().catch(() => {
      if (!released) options.onPlaybackError?.()
    })
  }

  const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL')
  if (!isHlsSource(source) || nativeHls) {
    video.src = source
    startPlayback()
    return release
  }

  const loaded = await (options.loadHls?.() ?? import('hls.js'))
  if (released) return release
  const Hls = ('default' in loaded ? loaded.default : loaded) as HlsEngineConstructor
  if (!Hls.isSupported()) {
    video.src = source
    startPlayback()
    return release
  }

  const instance = new Hls({
    capLevelToPlayerSize: true,
    maxBufferLength: 12,
    backBufferLength: 0,
  })
  engine = instance
  instance.on(Hls.Events.ERROR, (_event: string, data: { fatal?: boolean }) => {
    if (data.fatal) options.onFatalError?.()
  })
  instance.on(Hls.Events.MANIFEST_PARSED, startPlayback)
  instance.loadSource(source)
  instance.attachMedia(video)
  return release
}
