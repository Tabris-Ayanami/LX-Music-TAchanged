const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

const loadTs = (relativePath, mocks = {}) => {
  const filename = path.join(root, relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const defaultRequire = loaded.require.bind(loaded)
  loaded.require = request => Object.hasOwn(mocks, request) ? mocks[request] : defaultRequire(request)
  loaded._compile(output, filename)
  return loaded.exports
}

const createStorage = () => {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

const encodeJwtPart = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const createToken = id => `${encodeJwtPart({ alg: 'ES256', kid: 'WebPlayKid' })}.${encodeJwtPart({ exp: Math.floor(Date.now() / 1000) + 3600, id })}.sig`

test('dynamic-cover HLS resolves parent-relative variant URLs using URL semantics', () => {
  const hls = loadTs('src/renderer/utils/appleDynamicCover/hls.ts')
  const variant = {
    uri: '../video/main.m3u8?token=1',
    codecs: 'avc1.64001f',
    resolution: '1080x1080',
    bandwidth: 1,
    width: 1080,
    height: 1080,
  }
  assert.equal(
    hls.resolveVariantMediaUrl(variant, 'https://example.test/hls/master/index.m3u8'),
    'https://example.test/hls/video/main.m3u8?token=1',
  )
})

test('clearing the Apple token cache also invalidates the in-memory token', async() => {
  const originalStorage = global.localStorage
  global.localStorage = createStorage()
  const tokens = [createToken('first'), createToken('second')]
  let bundleRequest = 0
  const httpFetch = url => ({
    promise: Promise.resolve(url.includes('/assets/')
      ? { statusCode: 200, raw: Buffer.from(`window.token='${tokens[bundleRequest++]}'`) }
      : { statusCode: 200, raw: Buffer.from('<script crossorigin src="/assets/index-test.js"></script>') }),
  })
  try {
    const token = loadTs('src/renderer/utils/appleDynamicCover/token.ts', {
      '@renderer/utils/request': { httpFetch },
    })
    assert.equal(await token.getAppleMusicWebToken(), tokens[0])
    token.clearCachedToken()
    assert.equal(await token.getAppleMusicWebToken(), tokens[1])
    assert.equal(bundleRequest, 2)
  } finally {
    global.localStorage = originalStorage
  }
})

test('same-track dynamic-cover callers share the in-flight result', async() => {
  let resolveRequest
  let callCount = 0
  const request = new Promise(resolve => { resolveRequest = resolve })
  const refs = []
  const dynamicCover = loadTs('src/renderer/store/player/dynamicCover.ts', {
    '@common/utils/vueTools': {
      ref: value => {
        const result = { value }
        refs.push(result)
        return result
      },
    },
    '@renderer/utils/appleDynamicCover': {
      getAppleDynamicCover: () => {
        callCount++
        return request
      },
      clearAppleDynamicCoverCache: () => {},
    },
  })
  const info = { id: 'track-1', name: 'Song', singer: 'Artist', album: 'Album' }
  const first = dynamicCover.loadDynamicCover(info)
  const second = dynamicCover.loadDynamicCover(info)
  resolveRequest({ videoUrl: 'https://example.test/video.m3u8', posterUrl: null })
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.equal(callCount, 1)
  assert.equal(dynamicCover.dynamicCoverUrl.value, 'https://example.test/video.m3u8')
})

test('dynamic-cover lookup continues across storefronts without editorial video', async() => {
  const httpFetch = url => {
    if (url.includes('/search?')) {
      return { promise: Promise.resolve({ statusCode: 200, body: {
        results: { albums: { data: [{ id: 'album-1', attributes: { name: 'Album', artistName: 'Artist' } }] } },
      } }) }
    }
    if (url.includes('/cn/albums/')) {
      return { promise: Promise.resolve({ statusCode: 200, body: { data: [{ attributes: {} }] } }) }
    }
    if (url.includes('/hk/albums/')) {
      return { promise: Promise.resolve({ statusCode: 200, body: { data: [{ attributes: {
        editorialVideo: { motionDetailSquare: { video: 'https://example.test/video.m3u8', previewFrame: { url: 'https://example.test/{w}x{h}.jpg' } } },
      } }] } }) }
    }
    if (url == 'https://example.test/video.m3u8') {
      return { promise: Promise.resolve({ statusCode: 200, raw: Buffer.from('#EXTM3U\n#EXTINF:3') }) }
    }
    throw new Error(`unexpected URL ${url}`)
  }
  const cover = loadTs('src/renderer/utils/appleDynamicCover/index.ts', {
    '@renderer/utils/request': { httpFetch },
    './token': { getAppleMusicWebToken: async() => 'token', clearCachedToken: () => {} },
    './hls': loadTs('src/renderer/utils/appleDynamicCover/hls.ts'),
  })
  const result = await cover.getAppleDynamicCover({ name: 'Album', singer: 'Artist', album: 'Album' })
  assert.equal(result?.videoUrl, 'https://example.test/video.m3u8')
  assert.equal(result?.storefront, 'hk')
})

test('play detail probes on open and remembers every prompted track', () => {
  const source = fs.readFileSync(path.join(root, 'src/renderer/components/layout/PlayDetail/index.vue'), 'utf8')
  assert.doesNotMatch(source, /if \(!needDynamic\) return/)
  assert.match(source, /const promptedMusicIds = new Set\(\)/)
  assert.match(source, /promptedMusicIds\.has\(musicId\)/)
})
