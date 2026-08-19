'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { createDiscoverResourceLifecycle } = require('../../src/renderer/views/Discover/resourceLifecycle.cjs')

test('Discover deactivation cancels pending image loads and rejects stale async results', async() => {
  const images = []
  const lifecycle = createDiscoverResourceLifecycle({
    createImage() {
      const image = { crossOrigin: '', onload: null, onerror: null, src: '' }
      images.push(image)
      return image
    },
  })

  lifecycle.activate()
  let loaded = 0
  const image = lifecycle.loadImage({
    url: 'https://example.invalid/cover.jpg',
    crossOrigin: 'anonymous',
    onLoad: () => { loaded += 1 },
  })
  const lateLoad = image.onload

  let resolveRequest
  const request = new Promise(resolve => { resolveRequest = resolve })
  let committed = null
  let settled = 0
  const pendingResult = lifecycle.runWhileActive({
    task: () => request,
    onSuccess: value => { committed = value },
    onSettled: () => { settled += 1 },
  })

  lifecycle.deactivate()
  assert.equal(image.src, '')
  assert.equal(image.onload, null)
  assert.equal(image.onerror, null)

  lateLoad()
  resolveRequest('stale daily list')
  assert.deepEqual(await pendingResult, { status: 'stale' })
  assert.equal(loaded, 0)
  assert.equal(committed, null)
  assert.equal(settled, 0)

  lifecycle.activate()
  const currentResult = await lifecycle.runWhileActive({
    task: async() => 'current daily list',
    onSuccess: value => { committed = value },
    onSettled: () => { settled += 1 },
  })
  assert.deepEqual(currentResult, { status: 'committed', value: 'current daily list' })
  assert.equal(committed, 'current daily list')
  assert.equal(settled, 1)
  assert.equal(images.length, 1)
})
