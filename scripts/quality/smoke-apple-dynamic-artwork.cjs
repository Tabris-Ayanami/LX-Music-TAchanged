#!/usr/bin/env node

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'

const fetchText = async(url, headers = {}) => {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, ...headers } })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

const getAppleToken = async() => {
  const page = await fetchText('https://music.apple.com/us/album/positions-deluxe-edition/1553944254')
  const assetPath = page.match(/crossorigin(?:="")?\s+src="(\/assets\/index.+?\.js)"/)?.[1] ??
    page.match(/src="(\/assets\/index.+?\.js)"/)?.[1]
  if (!assetPath) throw new Error('Apple Music web bundle was not found')
  const bundle = await fetchText(new URL(assetPath, 'https://music.apple.com').href)
  const candidates = bundle.match(/e[yw][A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]{2,}/g) ?? []
  for (const candidate of candidates) {
    try {
      const header = JSON.parse(Buffer.from(candidate.split('.')[0], 'base64url').toString())
      if (header.kid == 'WebPlayKid') return candidate
    } catch (_) { /* keep looking */ }
  }
  throw new Error('Apple WebPlayKid token was not found')
}

const getShapeOfYouArtwork = async() => {
  const token = await getAppleToken()
  const response = await fetch('https://amp-api.music.apple.com/v1/catalog/cn/albums/1193701079?extend=editorialVideo', {
    headers: {
      authorization: `Bearer ${token}`,
      origin: 'https://music.apple.com',
      'user-agent': USER_AGENT,
      accept: 'application/json',
    },
  })
  if (!response.ok) throw new Error(`Apple album API returned ${response.status}`)
  const data = await response.json()
  const editorial = data?.data?.[0]?.attributes?.editorialVideo
  const motion = editorial?.motionDetailSquare ?? editorial?.motionSquareVideo1x1 ?? editorial?.motionDetailTall
  if (!motion?.video) throw new Error('Shape of You dynamic artwork is unavailable')

  const master = await fetchText(motion.video)
  const lines = master.split(/\r?\n/)
  const variants = []
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF')) continue
    const uri = lines.slice(index + 1).find(line => line.trim() && !line.startsWith('#'))?.trim()
    if (!uri) continue
    const codecs = /CODECS="([^"]*)"/.exec(lines[index])?.[1] ?? ''
    const resolution = /RESOLUTION=(\d+)x(\d+)/.exec(lines[index])
    variants.push({
      url: new URL(uri, motion.video).href,
      codecs,
      edge: Math.max(Number(resolution?.[1] ?? 0), Number(resolution?.[2] ?? 0)),
    })
  }
  const avc = variants.filter(item => /avc1|avc3|mp4v/i.test(item.codecs))
  const withinTarget = avc.filter(item => item.edge && item.edge <= 640)
  const selected = [...(withinTarget.length ? withinTarget : avc)].sort((a, b) => b.edge - a.edge)[0]
  return { source: selected?.url ?? motion.video, edge: selected?.edge ?? null }
}

const runElectronPlayback = async(source) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lx-dynamic-artwork-'))
  const mainPath = path.join(tempDir, 'main.cjs')
  const htmlPath = path.join(tempDir, 'index.html')
  const hlsPath = path.resolve(__dirname, '..', '..', 'node_modules', 'hls.js', 'dist', 'hls.min.js').replace(/\\/g, '/')
  fs.writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8"><video muted autoplay loop playsinline></video>
<script src="file:///${hlsPath}"></script><script>
const { ipcRenderer } = require('electron')
const video = document.querySelector('video')
const source = ${JSON.stringify(source)}
let sent = false
const finish = data => { if (!sent) { sent = true; ipcRenderer.send('artwork-result', data) } }
video.muted = true
video.addEventListener('error', () => finish({ ok: false, stage: 'video', code: video.error?.code, message: video.error?.message }))
video.addEventListener('timeupdate', () => {
  if (video.currentTime > 0.5) finish({ ok: true, currentTime: video.currentTime, readyState: video.readyState, videoWidth: video.videoWidth, videoHeight: video.videoHeight })
})
if (video.canPlayType('application/vnd.apple.mpegurl')) {
  video.src = source
  video.play().catch(error => finish({ ok: false, stage: 'native-play', message: error.message }))
} else if (window.Hls?.isSupported()) {
  const hls = new Hls({ maxBufferLength: 12, backBufferLength: 0 })
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) finish({ ok: false, stage: 'hls', type: data.type, details: data.details, code: data.response?.code })
  })
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video.play().catch(error => finish({ ok: false, stage: 'hls-play', message: error.message }))
  })
  hls.loadSource(source)
  hls.attachMedia(video)
} else {
  finish({ ok: false, stage: 'support', message: 'Neither native HLS nor MediaSource is available' })
}
setTimeout(() => finish({ ok: false, stage: 'timeout', currentTime: video.currentTime, readyState: video.readyState }), 20000)
</script>`)
  fs.writeFileSync(mainPath, `const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.setPath('userData', path.join(__dirname, 'profile'))
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  ipcMain.once('artwork-result', (_event, result) => {
    process.stdout.write(JSON.stringify(result))
    app.exit(result.ok ? 0 : 1)
  })
  win.loadFile(path.join(__dirname, 'index.html'))
})
setTimeout(() => { process.stderr.write('Electron playback probe timed out'); app.exit(1) }, 30000)
`)

  const electronPath = require('electron')
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(electronPath, [mainPath], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      child.once('error', reject)
      child.once('exit', code => {
        let result
        try { result = JSON.parse(stdout) } catch (_) { result = { ok: false, stage: 'parse', stdout, stderr } }
        if (code === 0 && result.ok) resolve(result)
        else reject(new Error(`Electron playback failed (${code}): ${JSON.stringify(result)} ${stderr}`))
      })
    })
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

const main = async() => {
  const artwork = await getShapeOfYouArtwork()
  const playback = await runElectronPlayback(artwork.source)
  console.log(JSON.stringify({ track: 'Shape of You', source: artwork.source, selectedEdge: artwork.edge, playback }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
