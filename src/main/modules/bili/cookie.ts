import { createHmac } from 'node:crypto'
import { session, type CookiesSetDetails } from 'electron'
import { BILI_USER_AGENT } from './request'

interface WebBuvidResponse {
  code: number
  data: {
    b_3: string
    b_4: string
  }
}

interface GenWebTicketResponse {
  code: number
  data?: {
    ticket?: string
    ttl?: number
  }
}

const setCookie = async(details: Partial<CookiesSetDetails>) => {
  await session.defaultSession.cookies.set({
    ...details,
    url: 'https://bilibili.com/',
    domain: '.bilibili.com',
    path: '/',
    secure: true,
    sameSite: 'no_restriction',
    httpOnly: false,
  })
  await session.defaultSession.cookies.flushStore()
}

const getWebBuvid = async() => {
  const response = await fetch('https://api.bilibili.com/x/frontend/finger/spi_v2', {
    headers: {
      'User-Agent': BILI_USER_AGENT,
    },
  })
  if (!response.ok) throw new Error(`获取 B站 buvid 失败：${response.status}`)
  const body = await response.json() as WebBuvidResponse
  if (body.code !== 0 || !body.data?.b_4) throw new Error('获取 B站 buvid 失败')
  return body.data
}

const hmacSha256 = (message: string) => {
  const hmac = createHmac('sha256', 'XgwSnGZ1p')
  hmac.update(message)
  return hmac.digest('hex')
}

const getBiliTicket = async() => {
  const ts = Math.floor(Date.now() / 1000)
  const params = new URLSearchParams({
    key_id: 'ec02',
    hexsign: hmacSha256(`ts${ts}`),
    'context[ts]': String(ts),
    csrf: '',
  })
  const response = await fetch(`https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?${params.toString()}`, {
    method: 'POST',
    headers: {
      'User-Agent': BILI_USER_AGENT,
    },
  })
  if (!response.ok) throw new Error(`获取 B站 bili_ticket 失败：${response.status}`)
  const body = await response.json() as GenWebTicketResponse
  if (body.code !== 0 || !body.data?.ticket) throw new Error('获取 B站 bili_ticket 失败')
  return body.data.ticket
}

const injectBiliTicketCookie = async() => {
  const ticket = await getBiliTicket()
  const expirationDate = Math.floor(Date.now() / 1000 + 259260)
  await setCookie({
    name: 'bili_ticket',
    value: ticket,
    expirationDate,
  })
  await setCookie({
    name: 'bili_ticket_expires',
    value: String(expirationDate),
    expirationDate,
  })
}

const injectBuvidCookie = async() => {
  const buvid = await getWebBuvid()
  await setCookie({
    name: 'buvid3',
    value: buvid.b_3,
    expirationDate: Math.floor(Date.now() / 1000 + 30 * 24 * 3600),
  })
  await setCookie({
    name: 'buvid4',
    value: buvid.b_4,
    expirationDate: Math.floor(Date.now() / 1000 + 30 * 24 * 3600),
  })
}

let cookieAutoRefreshRegistered = false

const setupCookieAutoRefresh = () => {
  if (cookieAutoRefreshRegistered) return
  cookieAutoRefreshRegistered = true
  session.defaultSession.cookies.on('changed', (_event, cookie, cause, removed) => {
    if (!removed || (cause !== 'expired' && cause !== 'expired-overwrite')) return
    if (cookie.name === 'buvid4' || cookie.name === 'buvid3') {
      void injectBuvidCookie().catch(err => {
        console.warn('[bili] refresh buvid failed', err)
      })
      return
    }
    if (cookie.name === 'bili_ticket' || cookie.name === 'bili_ticket_expires') {
      void injectBiliTicketCookie().catch(err => {
        console.warn('[bili] refresh bili_ticket failed', err)
      })
    }
  })
}

export const injectAuthCookie = async() => {
  setupCookieAutoRefresh()
  const results = await Promise.allSettled([injectBiliTicketCookie(), injectBuvidCookie()])
  for (const result of results) {
    if (result.status === 'rejected') console.warn('[bili] inject cookie failed', result.reason)
  }
}
