import { createHash } from 'node:crypto'

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

const getMixinKey = (orig: string) => mixinKeyEncTab.map(n => orig[n]).join('').slice(0, 32)

export const getFileKey = (url: string) => url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))

export const encodeWbi = (params: Record<string, string | number | null | undefined>, imgKey: string, subKey: string) => {
  if (!imgKey || !subKey) return params

  const nextParams: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    nextParams[key] = value
  }
  nextParams.wts = Math.round(Date.now() / 1000)

  const query = Object.keys(nextParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(nextParams[key]).replace(/[!'()*]/g, ''))}`)
    .join('&')

  return {
    ...nextParams,
    w_rid: createHash('md5').update(query + getMixinKey(imgKey + subKey)).digest('hex'),
  }
}

