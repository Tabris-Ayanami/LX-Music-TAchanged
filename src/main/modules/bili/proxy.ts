import http from 'node:http'
import { Readable } from 'node:stream'
import { biliHeaders } from './request'

interface TokenInfo {
  url: string
  expiresAt: number
  contentType?: string
}

const tokenMap = new Map<string, TokenInfo>()
let server: http.Server | null = null
let port = 0

const writeError = (res: http.ServerResponse, status: number, message: string) => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

const startServer = async() => {
  if (server?.listening && port) return port

  server = http.createServer(async(req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
      if (requestUrl.pathname !== '/bili/audio' && requestUrl.pathname !== '/bili/image') {
        writeError(res, 404, 'not found')
        return
      }
      const token = requestUrl.searchParams.get('token') ?? ''
      const info = tokenMap.get(token)
      if (!info || info.expiresAt <= Date.now()) {
        tokenMap.delete(token)
        writeError(res, 410, 'B站音频地址已过期，请刷新播放')
        return
      }

      const isAudio = requestUrl.pathname === '/bili/audio'
      const headers = await biliHeaders(isAudio && req.headers.range ? { Range: req.headers.range } : undefined)
      const upstream = await fetch(info.url, { headers })
      const responseHeaders: Record<string, string> = {
        'Content-Type': upstream.headers.get('content-type') ?? info.contentType ?? (isAudio ? 'audio/mp4' : 'image/jpeg'),
        'Cache-Control': isAudio ? 'no-store' : 'public, max-age=86400',
      }
      const contentLength = upstream.headers.get('content-length')
      const contentRange = upstream.headers.get('content-range')
      const acceptRanges = upstream.headers.get('accept-ranges')
      if (contentLength) responseHeaders['Content-Length'] = contentLength
      if (contentRange) responseHeaders['Content-Range'] = contentRange
      responseHeaders['Accept-Ranges'] = acceptRanges ?? 'bytes'
      res.writeHead(upstream.status, responseHeaders)
      if (!upstream.body) {
        res.end()
        return
      }
      Readable.fromWeb(upstream.body as any).pipe(res)
    } catch (err: any) {
      writeError(res, 502, err.message || 'B站音频代理失败')
    }
  })

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address()
      port = typeof address == 'object' && address ? address.port : 0
      server!.off('error', reject)
      resolve()
    })
  })

  return port
}

export const createProxyUrl = async(url: string, expiresAt: number) => {
  const serverPort = await startServer()
  const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  tokenMap.set(token, { url, expiresAt, contentType: 'audio/mp4' })
  return `http://127.0.0.1:${serverPort}/bili/audio?token=${encodeURIComponent(token)}`
}

export const createImageProxyUrl = async(url: string) => {
  const serverPort = await startServer()
  const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  tokenMap.set(token, {
    url,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    contentType: 'image/jpeg',
  })
  return `http://127.0.0.1:${serverPort}/bili/image?token=${encodeURIComponent(token)}`
}
