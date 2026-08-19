'use strict'

const NETEASE_ARTWORK_SIZE = 640

const toDiscoverArtworkUrl = value => {
  if (typeof value != 'string' || !value) return value
  let url
  try {
    url = new URL(value)
  } catch {
    return value
  }
  const host = url.hostname.toLowerCase()
  if (host != 'music.126.net' && !host.endsWith('.music.126.net')) return value
  url.searchParams.set('param', `${NETEASE_ARTWORK_SIZE}y${NETEASE_ARTWORK_SIZE}`)
  return url.href
}

module.exports = { NETEASE_ARTWORK_SIZE, toDiscoverArtworkUrl }
