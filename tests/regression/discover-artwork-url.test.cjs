'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { toDiscoverArtworkUrl } = require('../../src/renderer/views/Discover/artworkUrl.cjs')

test('Discover requests 640px NetEase artwork without mutating unrelated URLs', () => {
  assert.equal(
    toDiscoverArtworkUrl('https://p1.music.126.net/cover.jpg'),
    'https://p1.music.126.net/cover.jpg?param=640y640',
  )
  assert.equal(
    toDiscoverArtworkUrl('http://music.126.net/cover.jpg?foo=bar&param=200y200'),
    'http://music.126.net/cover.jpg?foo=bar&param=640y640',
  )

  for (const url of [
    'https://example.com/cover.jpg',
    'file:///C:/Music/cover.jpg',
    'data:image/png;base64,abc',
    'blob:https://example.com/id',
    '',
  ]) assert.equal(toDiscoverArtworkUrl(url), url)
})
