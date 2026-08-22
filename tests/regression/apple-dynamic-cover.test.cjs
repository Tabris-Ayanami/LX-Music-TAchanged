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

test('dynamic artwork caps AVC selection at the approved 640px target', () => {
  const hls = loadTs('src/renderer/utils/appleDynamicCover/hls.ts')
  const master = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=300000,CODECS="avc1.64001f",RESOLUTION=320x320',
    'shape-320.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=900000,CODECS="avc1.64001f",RESOLUTION=640x640',
    'shape-640.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2200000,CODECS="avc1.64001f",RESOLUTION=1080x1080',
    'shape-1080.m3u8',
  ].join('\n')

  assert.equal(hls.pickBestVariant(master, 'https://example.test/master.m3u8')?.uri, 'shape-640.m3u8')
})

test('dynamic artwork uses an HLS engine when Electron cannot play m3u8 natively and releases it', async() => {
  const hls = loadTs('src/renderer/utils/appleDynamicCover/hls.ts')
  assert.equal(typeof hls.attachDynamicArtworkSource, 'function')

  const calls = []
  const listeners = new Map()
  class FakeHls {
    static isSupported() { return true }
    static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifestParsed' }
    loadSource(source) { calls.push(['loadSource', source]) }
    attachMedia(video) { calls.push(['attachMedia', video]) }
    on(event, listener) { listeners.set(event, listener) }
    destroy() { calls.push(['destroy']) }
  }
  const video = {
    src: '',
    paused: true,
    canPlayType: () => '',
    play: async() => { calls.push(['play']) },
    removeAttribute: name => calls.push(['removeAttribute', name]),
    load: () => calls.push(['load']),
  }
  let fatalErrors = 0

  const release = await hls.attachDynamicArtworkSource(video, 'https://example.test/shape.m3u8', {
    loadHls: async() => FakeHls,
    onFatalError: () => { fatalErrors++ },
  })

  assert.deepEqual(calls.slice(0, 2), [
    ['loadSource', 'https://example.test/shape.m3u8'],
    ['attachMedia', video],
  ])
  listeners.get('manifestParsed')?.('manifestParsed')
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(calls.some(call => call[0] == 'play'), 'HLS playback must be started after its manifest is ready')
  listeners.get('error')?.('error', { fatal: false })
  assert.equal(fatalErrors, 0)
  listeners.get('error')?.('error', { fatal: true })
  assert.equal(fatalErrors, 1)

  release()
  assert.deepEqual(calls.slice(-3), [
    ['destroy'],
    ['removeAttribute', 'src'],
    ['load'],
  ])
})

test('released dynamic artwork ignores a late play rejection', async() => {
  const hls = loadTs('src/renderer/utils/appleDynamicCover/hls.ts')
  const listeners = new Map()
  class FakeHls {
    static isSupported() { return true }
    static Events = { ERROR: 'error', MANIFEST_PARSED: 'manifestParsed' }
    loadSource() {}
    attachMedia() {}
    on(event, listener) { listeners.set(event, listener) }
    destroy() {}
  }
  let rejectPlay
  const playResult = new Promise((_resolve, reject) => { rejectPlay = reject })
  const video = {
    paused: true,
    canPlayType: () => '',
    play: () => playResult,
    removeAttribute: () => {},
    load: () => {},
  }
  let playbackErrors = 0
  const release = await hls.attachDynamicArtworkSource(video, 'https://example.test/late.m3u8', {
    loadHls: async() => FakeHls,
    onPlaybackError: () => { playbackErrors++ },
  })

  listeners.get('manifestParsed')?.('manifestParsed')
  release()
  rejectPlay(new Error('released'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(playbackErrors, 0)
})

test('failed dynamic-cover lookup can be retried for the same track', async() => {
  let callCount = 0
  const dynamicCover = loadTs('src/renderer/store/player/dynamicCover.ts', {
    '@common/utils/vueTools': { ref: value => ({ value }) },
    '@renderer/utils/appleDynamicCover': {
      getAppleDynamicCover: async() => {
        callCount++
        return callCount == 1 ? null : { videoUrl: 'https://example.test/retry.m3u8', posterUrl: null }
      },
      clearAppleDynamicCoverCache: () => {},
    },
  })
  const info = { id: 'track-retry', name: 'Song', singer: 'Artist', album: 'Album' }

  assert.equal(await dynamicCover.loadDynamicCover(info), false)
  assert.equal(await dynamicCover.loadDynamicCover(info), true)
  assert.equal(callCount, 2)
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

test('song search hits resolve their album relationship in the matching storefront', async() => {
  const requestedUrls = []
  const httpFetch = url => {
    requestedUrls.push(url)
    if (url.includes('/cn/search?')) {
      return { promise: Promise.resolve({ statusCode: 200, body: {
        results: { songs: { data: [{
          id: '1193701392',
          type: 'songs',
          attributes: { name: 'Shape of You', artistName: 'Ed Sheeran', albumName: '÷ (Deluxe)' },
        }] } },
      } }) }
    }
    if (url.includes('/cn/songs/1193701392?include=albums')) {
      return { promise: Promise.resolve({ statusCode: 200, body: { data: [{
        id: '1193701392',
        type: 'songs',
        relationships: { albums: { data: [{ id: '1193701079', type: 'albums' }] } },
      }] } }) }
    }
    if (url.includes('/cn/albums/1193701079?extend=editorialVideo')) {
      return { promise: Promise.resolve({ statusCode: 200, body: { data: [{ attributes: {
        editorialVideo: { motionDetailSquare: {
          video: 'https://example.test/shape-master.m3u8',
          previewFrame: { url: 'https://example.test/shape/{w}x{h}.jpg' },
        } },
      } }] } }) }
    }
    if (url == 'https://example.test/shape-master.m3u8') {
      return { promise: Promise.resolve({ statusCode: 200, raw: Buffer.from('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,CODECS="avc1.64001f",RESOLUTION=640x640\nshape-avc.m3u8') }) }
    }
    throw new Error(`unexpected URL ${url}`)
  }
  const cover = loadTs('src/renderer/utils/appleDynamicCover/index.ts', {
    '@renderer/utils/request': { httpFetch },
    './token': { getAppleMusicWebToken: async() => 'token', clearCachedToken: () => {} },
    './hls': loadTs('src/renderer/utils/appleDynamicCover/hls.ts'),
  })

  const result = await cover.getAppleDynamicCover({ name: 'Shape of You', singer: 'Ed Sheeran', album: '÷ (Deluxe)' })

  assert.equal(result?.albumId, '1193701079')
  assert.equal(result?.storefront, 'cn')
  assert.equal(result?.videoUrl, 'https://example.test/shape-avc.m3u8')
  assert.ok(requestedUrls.some(url => url.includes('/cn/songs/1193701392?include=albums')))
  assert.ok(requestedUrls.some(url => url.includes('/cn/albums/1193701079?extend=editorialVideo')))
  assert.ok(!requestedUrls.some(url => url.includes('/albums/1193701392')))
})

test('play detail gates lookup on the appearance switch and delegates video lifecycle', () => {
  const playDetail = fs.readFileSync(path.join(root, 'src/renderer/components/layout/PlayDetail/index.vue'), 'utf8')
  const immersive = fs.readFileSync(path.join(root, 'src/renderer/components/layout/PlayDetail/ImmersiveLyrics.vue'), 'utf8')
  const dynamicVideo = fs.readFileSync(path.join(root, 'src/renderer/components/player/DynamicArtworkVideo.vue'), 'utf8')

  assert.match(playDetail, /setting__play_detail_dynamic_cover_prompt/)
  assert.match(playDetail, /dialog\.confirm/)
  assert.match(playDetail, /promptedMusicIds/)
  assert.match(playDetail, /selectionText/)
  assert.match(playDetail, /dynamicCoverAskAgain/)
  assert.match(playDetail, /playDetail\.appleDynamicCover[\s\S]*?playDetail\.coverType'\] == 'dynamic'/)
  assert.match(playDetail, /appSetting\['playDetail\.appleDynamicCover'\]/)
  assert.match(
    playDetail,
    /watch\(\(\) => musicInfo\.id,[\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?void tryLoadDynamicCover\(\)[\s\S]*?\}, oldId == null \? 1500 : 300\)/,
    'Dynamic-cover detection should run while a song is playing, not only when the detail page opens',
  )
  assert.match(playDetail, /if \(!appSetting\['playDetail\.appleDynamicCover'\] \|\| !musicInfo\.id\) return/)
  assert.ok((playDetail.match(/DynamicArtworkVideo/g) ?? []).length >= 3)
  assert.match(immersive, /DynamicArtworkVideo/)
  assert.match(dynamicVideo, /v-if="active && src"/)
  assert.match(dynamicVideo, /preload="auto"/)
  assert.match(playDetail, /if \(!loaded && lazyLoadKey == musicId\) lazyLoadKey = ''/)
})

test('dynamic-cover prompt ships a never-ask checkbox label in every locale', () => {
  const zhCN = fs.readFileSync(path.join(root, 'src/lang/zh-cn.json'), 'utf8')
  const zhTW = fs.readFileSync(path.join(root, 'src/lang/zh-tw.json'), 'utf8')
  const enUS = fs.readFileSync(path.join(root, 'src/lang/en-us.json'), 'utf8')
  assert.match(zhCN, /"setting__play_detail_dynamic_cover_prompt_never_ask": "不再询问"/)
  assert.match(zhTW, /"setting__play_detail_dynamic_cover_prompt_never_ask": "不再詢問"/)
  assert.match(enUS, /"setting__play_detail_dynamic_cover_prompt_never_ask": "Don't ask again"/)
})

test('Apple fetch calls follow redirects because the needle fork defaults to follow_max 0', () => {
  const tokenSource = fs.readFileSync(path.join(root, 'src/renderer/utils/appleDynamicCover/token.ts'), 'utf8')
  const coverSource = fs.readFileSync(path.join(root, 'src/renderer/utils/appleDynamicCover/index.ts'), 'utf8')
  assert.match(tokenSource, /follow_max:\s*5/)
  assert.match(coverSource, /follow_max:\s*5/)
})
