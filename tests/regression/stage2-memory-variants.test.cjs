'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const {
  APPLICATION_VARIANT_FLAGS,
  VARIANT_NAMES,
  buildVariantEnvironment,
  getVariant,
  installVariant,
  isApplicationGateEnabled,
} = require('../../scripts/performance/stage2/variants.cjs')

const createFakeClient = () => {
  const calls = []
  const events = []
  const listeners = new Map()
  return {
    calls,
    events,
    listeners,
    async call(method, params = {}) {
      events.push({ kind: 'call', method })
      calls.push({ method, params })
      return {}
    },
    on(method, listener) {
      events.push({ kind: 'on', method })
      listeners.set(method, listener)
      return () => listeners.delete(method)
    },
    async emit(method, params) {
      await listeners.get(method)?.(params)
    },
  }
}

test('variant catalog keeps control inert and application attribution unavailable without a real gate', async() => {
  assert.deepEqual(VARIANT_NAMES, [
    'control',
    'no-remote-images',
    'no-remote-video',
    'no-keep-alive',
    'artwork-128',
    'no-renderer-worker',
    'no-db-worker',
  ])

  const client = createFakeClient()
  const installed = await installVariant(client, 'control')
  assert.deepEqual(installed.attribution, {
    variant: 'control',
    measurable: true,
    effectiveControls: [],
  })
  assert.deepEqual(client.calls, [])
  assert.deepEqual(buildVariantEnvironment('control', { UNRELATED: 'preserved' }), { UNRELATED: 'preserved' })

  for (const name of Object.keys(APPLICATION_VARIANT_FLAGS)) {
    const variant = getVariant(name)
    assert.equal(variant.kind, 'application')
    assert.equal(variant.measurable, false)
    assert.deepEqual(variant.effectiveControls, [])
    assert.match(variant.reason, /not implemented|not measurable/i)
  }
})

test('remote image attribution blocks only http(s) Image requests and allows local artwork', async() => {
  const client = createFakeClient()
  const installed = await installVariant(client, 'no-remote-images')

  assert.deepEqual(client.events.slice(0, 2), [
    { kind: 'on', method: 'Fetch.requestPaused' },
    { kind: 'call', method: 'Fetch.enable' },
  ])
  assert.deepEqual(client.calls[0], {
    method: 'Fetch.enable',
    params: {
      patterns: [
        { urlPattern: 'http://*', resourceType: 'Image', requestStage: 'Request' },
        { urlPattern: 'https://*', resourceType: 'Image', requestStage: 'Request' },
      ],
    },
  })
  assert.deepEqual(installed.attribution, {
    variant: 'no-remote-images',
    measurable: true,
    effectiveControls: [{
      mechanism: 'cdp-fetch',
      action: 'block',
      resourceType: 'Image',
      urlSchemes: ['http', 'https'],
    }],
  })

  await client.emit('Fetch.requestPaused', { requestId: 'remote', resourceType: 'Image', request: { url: 'https://img.example/cover.jpg' } })
  await client.emit('Fetch.requestPaused', { requestId: 'local', resourceType: 'Image', request: { url: 'file:///stage2/native-cache/cover.webp' } })
  await client.emit('Fetch.requestPaused', { requestId: 'data', resourceType: 'Image', request: { url: 'data:image/png;base64,AA==' } })
  await client.emit('Fetch.requestPaused', { requestId: 'script', resourceType: 'Script', request: { url: 'https://img.example/app.js' } })

  assert.deepEqual(client.calls.slice(1), [
    { method: 'Fetch.failRequest', params: { requestId: 'remote', errorReason: 'BlockedByClient' } },
    { method: 'Fetch.continueRequest', params: { requestId: 'local' } },
    { method: 'Fetch.continueRequest', params: { requestId: 'data' } },
    { method: 'Fetch.continueRequest', params: { requestId: 'script' } },
  ])

  await installed.cleanup()
  assert.equal(client.listeners.has('Fetch.requestPaused'), false)
  assert.deepEqual(client.calls.at(-1), { method: 'Fetch.disable', params: {} })
})

test('remote video attribution blocks only http(s) Media requests', async() => {
  const client = createFakeClient()
  const installed = await installVariant(client, 'no-remote-video')

  await client.emit('Fetch.requestPaused', { requestId: 'video', resourceType: 'Media', request: { url: 'http://media.example/cover.mp4' } })
  await client.emit('Fetch.requestPaused', { requestId: 'image', resourceType: 'Image', request: { url: 'https://media.example/cover.jpg' } })
  await client.emit('Fetch.requestPaused', { requestId: 'local-video', resourceType: 'Media', request: { url: 'file:///stage2/media/clip.mp4' } })

  assert.deepEqual(client.calls.slice(1), [
    { method: 'Fetch.failRequest', params: { requestId: 'video', errorReason: 'BlockedByClient' } },
    { method: 'Fetch.continueRequest', params: { requestId: 'image' } },
    { method: 'Fetch.continueRequest', params: { requestId: 'local-video' } },
  ])
  assert.equal(installed.attribution.effectiveControls[0].resourceType, 'Media')
})

test('a rejected Fetch command invalidates the variant without leaking an event-listener rejection', async() => {
  const client = createFakeClient()
  client.call = async(method, params = {}) => {
    client.calls.push({ method, params })
    if (method === 'Fetch.failRequest') throw new Error('CDP request is already handled')
    return {}
  }
  const installed = await installVariant(client, 'no-remote-images')
  const listener = client.listeners.get('Fetch.requestPaused')

  await assert.doesNotReject(async() => listener({
    requestId: 'rejected',
    resourceType: 'Image',
    request: { url: 'https://img.example/cover.jpg' },
  }))
  await assert.rejects(installed.cleanup(), /variant failed while handling Fetch\.requestPaused/i)
})

test('cleanup waits for every paused request before declaring attribution healthy', async() => {
  const client = createFakeClient()
  let release
  const pending = new Promise(resolve => { release = resolve })
  client.call = async(method, params = {}) => {
    client.calls.push({ method, params })
    if (method === 'Fetch.failRequest') await pending
    return {}
  }
  const installed = await installVariant(client, 'no-remote-images')
  const listener = client.listeners.get('Fetch.requestPaused')
  void listener({ requestId: 'slow', resourceType: 'Image', request: { url: 'https://img.example/slow.jpg' } })
  let cleaned = false
  const cleanup = installed.cleanup().then(() => { cleaned = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cleaned, false)
  release()
  await cleanup
  assert.equal(cleaned, true)
})

test('application attribution environment requires the master test guard and one specific flag', () => {
  for (const [name, flag] of Object.entries(APPLICATION_VARIANT_FLAGS)) {
    const baseEnvironment = { UNRELATED: 'preserved' }
    const environment = buildVariantEnvironment(name, baseEnvironment)

    assert.deepEqual(baseEnvironment, { UNRELATED: 'preserved' })
    assert.equal(environment.UNRELATED, 'preserved')
    assert.equal(environment.LX_STAGE2_MEMORY_TEST, 'true')
    assert.equal(environment[flag], 'true')
    assert.equal(isApplicationGateEnabled(name, environment), true)
    assert.equal(isApplicationGateEnabled(name, { [flag]: 'true' }), false)
    assert.equal(isApplicationGateEnabled(name, { LX_STAGE2_MEMORY_TEST: 'true' }), false)
    assert.equal(isApplicationGateEnabled(name, {}), false)
  }
})

test('unknown variants fail closed instead of silently becoming control', async() => {
  assert.throws(() => getVariant('typo'), /unknown stage 2 memory variant/i)
  assert.throws(() => buildVariantEnvironment('typo', {}), /unknown stage 2 memory variant/i)
  await assert.rejects(installVariant(createFakeClient(), 'typo'), /unknown stage 2 memory variant/i)
})
