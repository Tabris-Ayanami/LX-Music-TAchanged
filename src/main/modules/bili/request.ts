import { session } from 'electron'
import { encodeWbi, getFileKey } from './wbi'

const API_BASE_URL = 'https://api.bilibili.com'
const ORIGIN = 'https://www.bilibili.com'
export const BILI_REFERER = `${ORIGIN}/`
export const BILI_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

interface WbiKeys {
  imgKey: string
  subKey: string
  expire: number
}

let cachedWbiKeys: WbiKeys | null = null
let wbiKeysPromise: Promise<WbiKeys> | null = null

const normalizeUrl = (url: string) => {
  if (!url) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

const getStoredCookie = () => global.lx.appSetting['account.bili.cookie']?.trim() || ''

export const getCookieString = async() => {
  const sessionCookies = await session.defaultSession.cookies.get({ url: 'https://bilibili.com' })
  const fromSession = sessionCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
  const stored = getStoredCookie()
  return [stored, fromSession].filter(Boolean).join('; ')
}

export const setBiliCookie = async(cookieString: string) => {
  const cookie = cookieString.trim()
  global.lx.event_app.update_config({ 'account.bili.cookie': cookie })

  const pairs = cookie.split(';').map(item => item.trim()).filter(Boolean)
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=')
    if (eqIndex < 1) continue
    const name = pair.slice(0, eqIndex).trim()
    const value = pair.slice(eqIndex + 1).trim()
    if (!name) continue
    await session.defaultSession.cookies.set({
      url: 'https://bilibili.com/',
      domain: '.bilibili.com',
      path: '/',
      name,
      value,
      secure: true,
      sameSite: 'no_restriction',
    })
  }
  await session.defaultSession.cookies.flushStore()
}

export const clearBiliCookie = async() => {
  global.lx.event_app.update_config({ 'account.bili.cookie': '' })
  const cookies = await session.defaultSession.cookies.get({ domain: '.bilibili.com' })
  await Promise.all(cookies.map(async cookie => session.defaultSession.cookies.remove('https://bilibili.com/', cookie.name).catch(() => null)))
  await session.defaultSession.cookies.flushStore()
}

export const biliHeaders = async(extra?: Record<string, string>) => {
  const cookie = await getCookieString()
  return {
    'User-Agent': BILI_USER_AGENT,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    Referer: BILI_REFERER,
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    ...(cookie ? { Cookie: cookie } : {}),
    ...extra,
  }
}

export const requestJson = async<T = any>(endpointOrUrl: string, params?: Record<string, string | number | null | undefined>, useWbi = false): Promise<T> => {
  const url = endpointOrUrl.startsWith('http')
    ? new URL(endpointOrUrl)
    : new URL(`${API_BASE_URL}${endpointOrUrl}`)
  let finalParams = params ?? {}
  if (useWbi) {
    const keys = await getWbiKeys()
    finalParams = encodeWbi(finalParams, keys.imgKey, keys.subKey)
  }
  for (const [key, value] of Object.entries(finalParams)) {
    if (value == null) continue
    url.searchParams.set(key, String(value))
  }

  let lastError: any
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: await biliHeaders() })
      if (!response.ok) {
        if (response.status >= 500 && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
          continue
        }
        throw new Error(`B站接口 HTTP ${response.status}`)
      }
      const body = await response.json() as {
        code: number
        message?: string
        data: T
      } | T
      if (typeof (body as any).code == 'number') {
        if ((body as any).code !== 0) throw new Error((body as any).message || `B站接口错误：${(body as any).code}`)
        return (body as any).data
      }
      return body as T
    } catch (err: any) {
      lastError = err
      const message = String(err?.message ?? err)
      const canRetry = /terminated|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(message)
      if (!canRetry || attempt >= 2) throw err
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }
  throw lastError
}

export const getWbiKeys = async() => {
  if (cachedWbiKeys && cachedWbiKeys.expire > Date.now()) return cachedWbiKeys
  if (wbiKeysPromise) return wbiKeysPromise
  wbiKeysPromise = getWbiKeysInternal().finally(() => {
    wbiKeysPromise = null
  })
  return wbiKeysPromise
}

const getWbiKeysInternal = async() => {
  const data = await requestJson<{
    wbi_img?: {
      img_url?: string
      sub_url?: string
    }
  }>('/x/web-interface/nav')
  const imgUrl = data.wbi_img?.img_url ?? ''
  const subUrl = data.wbi_img?.sub_url ?? ''
  cachedWbiKeys = {
    imgKey: getFileKey(imgUrl),
    subKey: getFileKey(subUrl),
    expire: Date.now() + 60 * 60 * 1000,
  }
  return cachedWbiKeys
}

export const getAccountInfo = async() => {
  const data = await requestJson<{
    isLogin?: boolean
    mid?: number | string
    uname?: string
  }>('/x/web-interface/nav')
  return {
    hasCookie: Boolean(getStoredCookie()),
    isLogin: Boolean(data.isLogin),
    mid: data.mid,
    uname: data.uname,
  }
}

export const normalizeBiliUrl = normalizeUrl
