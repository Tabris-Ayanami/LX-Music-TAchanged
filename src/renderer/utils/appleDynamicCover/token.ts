/**
 * Apple Music 网页版媒体 token 获取与缓存
 *
 * amp-api.music.apple.com 需要 `authorization: Bearer <jwt>`，该 JWT 的 header 中
 * kid 为 WebPlayKid。从 music.apple.com 的页面中加载的主 JS bundle 里可以提取到它。
 */

import { httpFetch } from '@renderer/utils/request'

const TOKEN_STORAGE_KEY = 'lx_apple_web_token'

/** httpFetch 是 JS 实现，这里补一个最小类型声明 */
const httpFetchTyped: (url: string, options?: Record<string, any>) => { promise: Promise<any> } = httpFetch as any

interface CachedToken {
  token: string
  /** token 过期时间（毫秒时间戳），提前 10 分钟视为过期 */
  exp: number
}

/** base64url 字符串解码为 JSON（JWT 的 header/payload 为 base64url 编码） */
const decodeJwtSegment = (segment: string): any => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const raw = atob(base64 + padding)
  // UTF-8 解码
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** 从 JWT 的 payload 里解析过期时间 */
const getTokenExp = (jwt: string): number => {
  try {
    const payload = jwt.split('.')[1]
    const json = decodeJwtSegment(payload)
    const exp = Number(json.exp)
    if (Number.isFinite(exp) && exp > 0) return exp * 1000 - 10 * 60 * 1000
  } catch (err) {
    console.warn('[appleDynamicCover] parse token exp failed', err)
  }
  return 0
}

const readCachedToken = (): string | null => {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CachedToken
    if (!data?.token || !Number.isFinite(data.exp) || data.exp < Date.now()) return null
    return data.token
  } catch (err) {
    return null
  }
}

const writeCachedToken = (token: string) => {
  try {
    const data: CachedToken = { token, exp: getTokenExp(token) }
    if (!data.exp) data.exp = Date.now() + 6 * 60 * 60 * 1000
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('[appleDynamicCover] cache token failed', err)
  }
}

/** 手动清除缓存 token（鉴权失败时调用） */
let tokenPromise: Promise<string> | null = null
let tokenGeneration = 0

export const clearCachedToken = () => {
  tokenGeneration++
  tokenPromise = null
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch (_) { /* ignore */ }
}

const getPageText = async(url: string): Promise<string> => new Promise((resolve, reject) => {
  const { promise } = httpFetchTyped(url, {
    method: 'get',
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36' },
  })
  promise
    .then(resp => {
      const { statusCode } = resp
      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`page fetch error ${statusCode}`))
        return
      }
      resolve(resp.raw?.toString?.() ?? resp.body)
    })
    .catch(reject)
})

/** 从 JS 文本里提取 header kid 为 WebPlayKid 的 JWT */
const extractWebPlayKidJwt = (js: string): string | null => {
  const jwtRxp = /e[yw][A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*\.[A-Za-z0-9\-_]{2,}(?:(?:\.[A-Za-z0-9\-_]{2,}){2})?/g
  const matches = js.match(jwtRxp)
  if (!matches) return null
  for (const jwt of matches) {
    try {
      const header = jwt.split('.')[0]
      const json = decodeJwtSegment(header)
      if (json?.kid == 'WebPlayKid') return jwt
    } catch (_) { /* 忽略无法解析的 token */ }
  }
  return null
}

/** 从 music.apple.com 页面动态获取 WebPlayKid token */
const fetchFreshToken = async(): Promise<string> => {
  // 访问一个公开专辑页，找到主 JS bundle 地址
  const page = await getPageText('https://music.apple.com/us/album/positions-deluxe-edition/1553944254')
  const assetMatch = /crossorigin src="(\/assets\/index.+?\.js)"/.exec(page)
  const assetPath = assetMatch?.[1]
  if (!assetPath) throw new Error('apple music page asset not found')
  const js = await getPageText(`https://music.apple.com${assetPath}`)
  const token = extractWebPlayKidJwt(js)
  if (!token) throw new Error('WebPlayKid token not found in bundle')
  return token
}

/** 获取可用的 WebPlayKid token（带内存缓存 + localStorage 持久化） */
export const getAppleMusicWebToken = async(): Promise<string> => {
  const cached = readCachedToken()
  if (cached) return Promise.resolve(cached)
  if (tokenPromise) return tokenPromise
  const generation = tokenGeneration
  const request = fetchFreshToken()
    .then(token => {
      if (generation == tokenGeneration) writeCachedToken(token)
      return token
    })
    .finally(() => {
      if (tokenPromise == request) tokenPromise = null
    })
  tokenPromise = request
  return request
}
