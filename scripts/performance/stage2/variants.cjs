'use strict'

const MASTER_TEST_FLAG = 'LX_STAGE2_MEMORY_TEST'

const APPLICATION_VARIANT_FLAGS = Object.freeze({
  'no-keep-alive': 'LX_STAGE2_NO_KEEP_ALIVE',
  'artwork-128': 'LX_STAGE2_ARTWORK_128',
  'no-renderer-worker': 'LX_STAGE2_NO_RENDERER_WORKER',
  'no-db-worker': 'LX_STAGE2_NO_DB_WORKER',
})

const unavailableReason = 'The application-side attribution gate is not implemented, so this variant is not measurable.'

const definitions = Object.freeze({
  control: Object.freeze({ name: 'control', kind: 'control', measurable: true, effectiveControls: Object.freeze([]) }),
  'no-remote-images': Object.freeze({
    name: 'no-remote-images',
    kind: 'cdp-fetch',
    measurable: true,
    resourceType: 'Image',
    effectiveControls: Object.freeze([Object.freeze({
      mechanism: 'cdp-fetch',
      action: 'block',
      resourceType: 'Image',
      urlSchemes: Object.freeze(['http', 'https']),
    })]),
  }),
  'no-remote-video': Object.freeze({
    name: 'no-remote-video',
    kind: 'cdp-fetch',
    measurable: true,
    resourceType: 'Media',
    effectiveControls: Object.freeze([Object.freeze({
      mechanism: 'cdp-fetch',
      action: 'block',
      resourceType: 'Media',
      urlSchemes: Object.freeze(['http', 'https']),
    })]),
  }),
  'no-keep-alive': Object.freeze({ name: 'no-keep-alive', kind: 'application', measurable: false, reason: unavailableReason, effectiveControls: Object.freeze([]) }),
  'artwork-128': Object.freeze({ name: 'artwork-128', kind: 'application', measurable: false, reason: unavailableReason, effectiveControls: Object.freeze([]) }),
  'no-renderer-worker': Object.freeze({ name: 'no-renderer-worker', kind: 'application', measurable: false, reason: unavailableReason, effectiveControls: Object.freeze([]) }),
  'no-db-worker': Object.freeze({ name: 'no-db-worker', kind: 'application', measurable: false, reason: unavailableReason, effectiveControls: Object.freeze([]) }),
})

const VARIANT_NAMES = Object.freeze(Object.keys(definitions))

const getVariant = name => {
  const variant = definitions[name]
  if (!variant) throw new Error(`Unknown Stage 2 memory variant: ${name}`)
  return variant
}

const buildVariantEnvironment = (name, baseEnvironment = {}) => {
  const variant = getVariant(name)
  const environment = { ...baseEnvironment }
  if (variant.kind !== 'application') return environment
  environment[MASTER_TEST_FLAG] = 'true'
  environment[APPLICATION_VARIANT_FLAGS[name]] = 'true'
  return environment
}

const isApplicationGateEnabled = (name, environment) => {
  const variant = getVariant(name)
  if (variant.kind !== 'application') return false
  return environment?.[MASTER_TEST_FLAG] === 'true' && environment?.[APPLICATION_VARIANT_FLAGS[name]] === 'true'
}

const createAttribution = variant => {
  const attribution = {
    variant: variant.name,
    measurable: variant.measurable,
    effectiveControls: variant.effectiveControls.map(control => ({
      ...control,
      ...(control.urlSchemes ? { urlSchemes: [...control.urlSchemes] } : {}),
    })),
  }
  if (variant.reason) attribution.reason = variant.reason
  return attribution
}

const isRemoteUrl = value => /^https?:\/\//i.test(value)

const handlePausedRequest = (client, variant, event) => {
  const shouldBlock = event.resourceType === variant.resourceType && isRemoteUrl(event.request?.url ?? '')
  return shouldBlock
    ? client.call('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' })
    : client.call('Fetch.continueRequest', { requestId: event.requestId })
}

const installVariant = async(client, name) => {
  const variant = getVariant(name)
  const attribution = createAttribution(variant)
  if (variant.kind !== 'cdp-fetch') return { attribution, cleanup: async() => {} }
  if (!client || typeof client.call !== 'function' || typeof client.on !== 'function') {
    throw new TypeError('CDP Fetch variants require a client with call() and on()')
  }

  let handlingError
  const unsubscribe = client.on('Fetch.requestPaused', event => {
    if (handlingError) return Promise.resolve()
    return Promise.resolve(handlePausedRequest(client, variant, event)).catch(error => {
      handlingError = error
    })
  })
  try {
    await client.call('Fetch.enable', {
      patterns: [
        { urlPattern: 'http://*', resourceType: variant.resourceType, requestStage: 'Request' },
        { urlPattern: 'https://*', resourceType: variant.resourceType, requestStage: 'Request' },
      ],
    })
  } catch (error) {
    unsubscribe?.()
    throw error
  }
  let cleanedUp = false
  return {
    attribution,
    async cleanup() {
      if (cleanedUp) return
      cleanedUp = true
      unsubscribe?.()
      let disableError
      try {
        await client.call('Fetch.disable')
      } catch (error) {
        disableError = error
      }
      if (handlingError) {
        throw new Error('Stage 2 memory variant failed while handling Fetch.requestPaused', { cause: handlingError })
      }
      if (disableError) throw disableError
    },
  }
}

module.exports = {
  APPLICATION_VARIANT_FLAGS,
  MASTER_TEST_FLAG,
  VARIANT_NAMES,
  buildVariantEnvironment,
  getVariant,
  installVariant,
  isApplicationGateEnabled,
}
