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
  const pool = avcList.length ? avcList : variants

  // 排序：分辨率优先，其次带宽
  const sorted = [...pool].sort((a, b) => {
    const areaDiff = (b.width * b.height) - (a.width * a.height)
    if (areaDiff) return areaDiff
    return b.bandwidth - a.bandwidth
  })

  const target = sorted[0]
  if (!isAvc(target.codecs)) {
    // 全是 HEVC 时，选一个中等分辨率，降低解码压力
    const median = sorted[Math.floor(sorted.length / 2)] ?? target
    return median
  }
  return target
}

/** 将变体 URI 解析为完整地址 */
export const resolveVariantMediaUrl = (variant: HlsVariant, masterUrl: string): string => {
  try {
    return new URL(variant.uri, masterUrl).href
  } catch (_) {
    return variant.uri
  }
}
