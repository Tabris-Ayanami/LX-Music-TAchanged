import { sendNcmApiRequest } from '@renderer/utils/ipc'
import { getWYCookie } from './utils/index'

export const request = async(endpoint, params = {}) => {
  const cookie = getWYCookie()
  if (cookie) params = { ...params, cookie }
  return sendNcmApiRequest(endpoint, params)
}

export const requestBody = async(endpoint, params = {}) => {
  const response = await request(endpoint, params)
  if (
    !response ||
    response.status >= 400 ||
    !response.body ||
    (response.body.code != null && response.body.code !== 200 && response.body.code !== '200')
  ) {
    const message = response?.body?.msg || response?.body?.message || 'NCM API request failed'
    throw new Error(`${endpoint}: ${message}`)
  }
  return response.body
}

const normalizeMv = item => ({
  type: 'netease',
  mvid: Number(item.id ?? item.mvid),
  title: item.name || item.title || '',
  artist: item.artistName || item.artist || '',
  cover: item.cover || item.picUrl || '',
  duration: Math.round(Number(item.duration ?? 0) / 1000),
  pageTitle: item.name || item.title || '',
})

export const searchMv = async(keyword, limit = 8) => {
  const searchParams = {
    keywords: keyword,
    type: 1004,
    limit,
  }
  let body = await requestBody('cloudsearch', searchParams)
  let list = body.result?.mvs || []
  if (!list.length) {
    body = await requestBody('search', searchParams)
    list = body.result?.mvs || []
  }
  return list.map(normalizeMv).filter(item => item.mvid)
}

export const getMvUrl = async(mvid) => {
  const body = await requestBody('mv_url', { id: mvid })
  if (!body.data?.url) throw new Error('获取网易云 MV 链接失败')
  return {
    url: body.data.url,
    br: body.data.br,
  }
}

export default {
  request,
  requestBody,
  searchMv,
  getMvUrl,
}
