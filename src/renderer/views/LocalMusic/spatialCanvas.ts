export interface SpatialPoint {
  index: number
  x: number
  y: number
}

export interface SpatialViewport {
  width: number
  height: number
}

export interface SpatialPan {
  x: number
  y: number
}

export interface SpatialIndex {
  bucketSize: number
  buckets: Map<string, SpatialPoint[]>
}

export interface SpatialFrameOptions {
  peakScale?: number
  minScale?: number
  minOpacity?: number
  viewportBuffer?: number
  visibilityBuffer?: number
}

export interface SpatialFrame {
  x: number
  y: number
  distance: number
  scale: number
  opacity: number
  zIndex: number
  inViewport: boolean
  visible: boolean
}

const HEX_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
] as const

/** Builds a stable, center-first honeycomb so every item has the same world-space footprint. */
export const buildSpatialHexLayout = (count: number, spacingX: number, spacingY: number): SpatialPoint[] => {
  if (count <= 0) return []

  const result: SpatialPoint[] = [{ index: 0, x: 0, y: 0 }]
  for (let radius = 1; result.length < count; radius++) {
    let q = 0
    let r = -radius

    for (const [stepQ, stepR] of HEX_DIRECTIONS) {
      for (let step = 0; step < radius && result.length < count; step++) {
        result.push({
          index: result.length,
          x: (q + r / 2) * spacingX,
          y: r * spacingY,
        })
        q += stepQ
        r += stepR
      }
    }
  }
  return result
}

const getSpatialBucketKey = (x: number, y: number) => `${x}:${y}`

/** Indexes stable world-space points once so panning only inspects nearby buckets. */
export const buildSpatialIndex = (points: SpatialPoint[], bucketSize: number): SpatialIndex => {
  const resolvedBucketSize = Math.max(1, bucketSize)
  const buckets = new Map<string, SpatialPoint[]>()

  for (const point of points) {
    const bucketX = Math.floor(point.x / resolvedBucketSize)
    const bucketY = Math.floor(point.y / resolvedBucketSize)
    const key = getSpatialBucketKey(bucketX, bucketY)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(point)
    else buckets.set(key, [point])
  }

  return { bucketSize: resolvedBucketSize, buckets }
}

/** Returns only the viewport and overscan candidates, independent of total library size. */
export const querySpatialIndex = (
  index: SpatialIndex,
  pan: SpatialPan,
  viewport: SpatialViewport,
  visibilityBuffer: number,
): SpatialPoint[] => {
  const halfWidth = viewport.width / 2 + visibilityBuffer
  const halfHeight = viewport.height / 2 + visibilityBuffer
  const minBucketX = Math.floor((-pan.x - halfWidth) / index.bucketSize)
  const maxBucketX = Math.floor((-pan.x + halfWidth) / index.bucketSize)
  const minBucketY = Math.floor((-pan.y - halfHeight) / index.bucketSize)
  const maxBucketY = Math.floor((-pan.y + halfHeight) / index.bucketSize)
  const candidates: SpatialPoint[] = []

  for (let bucketY = minBucketY; bucketY <= maxBucketY; bucketY++) {
    for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX++) {
      const bucket = index.buckets.get(getSpatialBucketKey(bucketX, bucketY))
      if (bucket) candidates.push(...bucket)
    }
  }

  return candidates
}

export const resolveSpatialFrame = (
  point: SpatialPoint,
  pan: SpatialPan,
  viewport: SpatialViewport,
  options: SpatialFrameOptions = {},
): SpatialFrame => {
  const x = point.x + pan.x
  const y = point.y + pan.y
  const distance = Math.hypot(x, y)
  const peakScale = options.peakScale ?? 1.12
  const minScale = options.minScale ?? 0.5
  const minOpacity = options.minOpacity ?? 0.56
  const maxDistance = Math.max(Math.hypot(viewport.width / 2, viewport.height / 2) * 0.9, 360)
  const progress = Math.min(distance / maxDistance, 1)
  const easedProgress = 1 - (1 - progress) ** 2
  const scale = peakScale - (peakScale - minScale) * easedProgress
  const opacity = 1 - (1 - minOpacity) * easedProgress
  const viewportBuffer = options.viewportBuffer ?? 96
  const visibilityBuffer = options.visibilityBuffer ?? 220
  const inViewport =
    Math.abs(x) <= viewport.width / 2 + viewportBuffer &&
    Math.abs(y) <= viewport.height / 2 + viewportBuffer

  return {
    x,
    y,
    distance,
    scale,
    opacity,
    zIndex: Math.max(1, Math.round(100 - progress * 90)),
    inViewport,
    visible:
      Math.abs(x) <= viewport.width / 2 + visibilityBuffer &&
      Math.abs(y) <= viewport.height / 2 + visibilityBuffer,
  }
}
