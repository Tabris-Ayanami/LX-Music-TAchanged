#!/usr/bin/env node
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const http = require('node:http')
const { Readable } = require('node:stream')

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Referer: 'https://www.bilibili.com/',
  Origin: 'https://www.bilibili.com',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
}

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]

const getMixinKey = key => mixinKeyEncTab.map(n => key[n]).join('').slice(0, 32)
const getFileKey = url => url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))
const encodeWbi = (params, imgKey, subKey) => {
  const nextParams = {
    ...params,
    wts: Math.round(Date.now() / 1000),
  }
  const query = Object.keys(nextParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(nextParams[key]).replace(/[!'()*]/g, ''))}`)
    .join('&')
  return `${query}&w_rid=${crypto.createHash('md5').update(query + getMixinKey(imgKey + subKey)).digest('hex')}`
}

const requestJson = async(url) => {
  const response = await fetch(url, { headers })
  assert.ok(response.ok, `${url} responded ${response.status}`)
  const body = await response.json()
  assert.equal(body.code, 0, body.message || `Bilibili API code ${body.code}`)
  return body.data
}

const hmacSha256 = message => crypto.createHmac('sha256', 'XgwSnGZ1p').update(message).digest('hex')

const requestBiliTicket = async() => {
  const ts = Math.floor(Date.now() / 1000)
  const params = new URLSearchParams({
    key_id: 'ec02',
    hexsign: hmacSha256(`ts${ts}`),
    'context[ts]': String(ts),
    csrf: '',
  })
  const response = await fetch(`https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?${params.toString()}`, {
    method: 'POST',
    headers,
  })
  assert.ok(response.ok, `bili_ticket responded ${response.status}`)
  const body = await response.json()
  assert.equal(body.code, 0, body.message || `bili_ticket code ${body.code}`)
  assert.ok(body.data?.ticket, 'bili_ticket should return ticket')
  return body.data.ticket
}

const requestBuvid = async() => {
  const response = await fetch('https://api.bilibili.com/x/frontend/finger/spi_v2', { headers })
  assert.ok(response.ok, `buvid responded ${response.status}`)
  const body = await response.json()
  assert.equal(body.code, 0, body.message || `buvid code ${body.code}`)
  assert.ok(body.data?.b_4, 'buvid should return buvid4')
  return body.data
}

const withLocalProxy = async(remoteUrl, fn) => {
  const server = http.createServer(async(req, res) => {
    const upstream = await fetch(remoteUrl, {
      headers: {
        ...headers,
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
    })
    const responseHeaders = {
      'Content-Type': upstream.headers.get('content-type') || 'audio/mp4',
      'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
      'Cache-Control': 'no-store',
    }
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    if (contentLength) responseHeaders['Content-Length'] = contentLength
    if (contentRange) responseHeaders['Content-Range'] = contentRange
    res.writeHead(upstream.status, responseHeaders)
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
    else res.end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    return await fn(`http://127.0.0.1:${address.port}/bili/audio`)
  } finally {
    server.close()
  }
}

;(async() => {
  const [ticket, buvid] = await Promise.all([requestBiliTicket(), requestBuvid()])
  assert.ok(ticket.length > 20, 'bili_ticket should look valid')
  assert.ok(buvid.b_3 && buvid.b_4, 'buvid3 and buvid4 should exist')

  const navResponse = await fetch('https://api.bilibili.com/x/web-interface/nav', { headers })
  assert.ok(navResponse.ok, `nav responded ${navResponse.status}`)
  const navBody = await navResponse.json()
  assert.ok(navBody.data?.wbi_img?.img_url, 'nav should return WBI img key')
  assert.ok(navBody.data?.wbi_img?.sub_url, 'nav should return WBI sub key')

  const imgKey = getFileKey(navBody.data.wbi_img.img_url)
  const subKey = getFileKey(navBody.data.wbi_img.sub_url)
  const searchParams = encodeWbi({ keyword: '周杰伦', search_type: 'video', page: '1' }, imgKey, subKey)
  const searchData = await requestJson(`https://api.bilibili.com/x/web-interface/wbi/search/type?${searchParams}`)
  const searchItems = searchData.result.filter(video => video.bvid)
  assert.ok(searchItems.length > 0, 'search should return visible Bilibili video results')
  const item = searchItems[0]
  assert.ok(item?.bvid, 'search should return at least one video with bvid')

  const viewData = await requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${item.bvid}`)
  assert.ok(viewData.cid, 'view should return cid')
  assert.ok(viewData.pic, 'view should return cover pic')
  assert.ok(Array.isArray(viewData.pages) && viewData.pages.length, 'view should return pages')
  const firstPage = viewData.pages[0]
  assert.ok(firstPage.cid, 'first page should return cid')
  const coverResponse = await fetch(viewData.pic.startsWith('//') ? `https:${viewData.pic}` : viewData.pic, { headers })
  assert.ok(coverResponse.ok, `cover image responded ${coverResponse.status}`)
  assert.match(coverResponse.headers.get('content-type') || '', /image\//)

  const playParams = encodeWbi({
    bvid: item.bvid,
    cid: String(firstPage.cid),
    fnval: '4048',
    fnver: '0',
    fourk: '1',
    qn: '80',
  }, imgKey, subKey)
  const playData = await requestJson(`https://api.bilibili.com/x/player/wbi/playurl?${playParams}`)
  const audio = [...(playData.dash?.audio || [])].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0]
  const url = audio?.baseUrl || audio?.base_url || playData.durl?.[0]?.url
  assert.ok(url, 'playurl should return an audio url')

  const noRefererResponse = await fetch(url, { headers: { Range: 'bytes=0-1' } })
  assert.equal(noRefererResponse.status, 403, 'Bilibili media should reject requests without Referer')

  const refererResponse = await fetch(url, { headers: { ...headers, Range: 'bytes=0-1' } })
  assert.equal(refererResponse.status, 206, 'Bilibili media should accept ranged requests with Referer')
  assert.match(refererResponse.headers.get('content-type') || '', /video\/mp4|audio\/mp4/)

  await withLocalProxy(url, async(proxyUrl) => {
    const proxyResponse = await fetch(proxyUrl, { headers: { Range: 'bytes=0-1' } })
    assert.equal(proxyResponse.status, 206, 'local proxy should forward ranged media requests')
    const chunk = Buffer.from(await proxyResponse.arrayBuffer())
    assert.equal(chunk.length, 2, 'local proxy should return requested bytes')
  })

  const playerParams = encodeWbi({
    bvid: item.bvid,
    cid: String(firstPage.cid),
    fnval: '4048',
    fnver: '0',
    fourk: '1',
    qn: '80',
  }, imgKey, subKey)
  const playerData = await requestJson(`https://api.bilibili.com/x/player/wbi/v2?${playerParams}`)
  assert.equal(playerData.cid, firstPage.cid, 'player info should match selected cid')

  const commentData = await requestJson(`https://api.bilibili.com/x/v2/reply?type=1&oid=${viewData.aid}&pn=1&ps=5&sort=2`)
  assert.ok(commentData.page, 'comment should return page info')
  assert.ok(Array.isArray(commentData.replies) || Array.isArray(commentData.hots), 'comment should return comment list fields')

  console.log(`Bilibili backend smoke test passed: ${item.bvid}, cid=${firstPage.cid}, pages=${viewData.pages.length}, audio=${audio?.id || 'durl'}, comments=${commentData.page?.count ?? 0}`)
})().catch(error => {
  console.error(error)
  process.exit(1)
})
