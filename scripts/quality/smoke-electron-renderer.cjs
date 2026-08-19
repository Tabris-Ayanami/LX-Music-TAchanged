#!/usr/bin/env node

const WebSocket = require('ws')

const args = new Map(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('=')
  return index < 0 ? [arg.replace(/^--/, ''), 'true'] : [arg.slice(2, index), arg.slice(index + 1)]
}))
const port = Number(args.get('port') ?? 9229)

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const fetchJson = async path => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`)
  if (!response.ok) throw new Error(`CDP ${path} returned ${response.status}`)
  return response.json()
}

const main = async() => {
  const targets = await fetchJson('/json')
  const page = targets.find(target => target.type === 'page' && /\/dist\/index\.html|\\dist\\index\.html/i.test(decodeURIComponent(target.url)))
  if (!page?.webSocketDebuggerUrl) throw new Error('LX-TA renderer target was not found')

  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })

  let sequence = 0
  const pending = new Map()
  const exceptions = []
  socket.on('message', raw => {
    const message = JSON.parse(String(raw))
    if (message.method == 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
    if (!message.id) return
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
    return response.result.value
  }

  await call('Runtime.enable')
  const originalHash = await evaluate('location.hash')
  const startup = await evaluate(`(() => ({
    title: document.title,
    readyState: document.readyState,
    bodyTextLength: document.body.innerText.length,
    hasAppEvent: typeof window.app_event === 'object',
    hasWorkerBridge: typeof window.lx?.worker?.main === 'object',
  }))()`)
  if (startup.readyState != 'complete' || startup.bodyTextLength < 50 || !startup.hasAppEvent || !startup.hasWorkerBridge) {
    throw new Error(`Startup contract failed: ${JSON.stringify(startup)}`)
  }

  const routes = [
    ['discover', '#/discover'],
    ['search', '#/search?source=wy&type=music'],
    ['local-tracks', '#/local?view=tracks'],
    ['download', '#/download'],
    ['settings', '#/setting'],
  ]
  const routeResults = []
  for (const [name, hash] of routes) {
    await evaluate(`location.hash = ${JSON.stringify(hash)}`)
    await delay(1000)
    const state = await evaluate(`(() => ({ hash: location.hash, textLength: document.body.innerText.length, elements: document.getElementsByTagName('*').length }))()`)
    if (!state.hash.startsWith(hash.split('?')[0]) || state.textLength < 50 || state.elements < 20) throw new Error(`Route ${name} failed: ${JSON.stringify(state)}`)
    routeResults.push({ name, ...state })
  }

  let libraryScan = null
  if (args.get('scan') == 'true') {
    await evaluate(`location.hash = '#/setting'`)
    await delay(500)
    const openedLibrarySettings = await evaluate(`(() => {
      const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      const item = [...document.querySelectorAll('[role="tab"], button, [role="button"]')].find(element => visible(element) && element.getAttribute('aria-label') === '本地音乐库')
      item?.click()
      return Boolean(item)
    })()`)
    await delay(500)
    const scanStart = await evaluate(`(() => {
      const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      const button = [...document.querySelectorAll('button')].find(element => visible(element) && element.innerText.includes('重新扫描'))
      button?.click()
      return {
        started: Boolean(button),
        buttons: [...document.querySelectorAll('button')].filter(visible).map(element => element.innerText.trim()).filter(Boolean),
        body: document.body.innerText,
      }
    })()`)
    const started = scanStart.started
    if (!started) throw new Error(`Local library scan button was not found: ${JSON.stringify({ openedLibrarySettings, buttons: scanStart.buttons, body: scanStart.body })}`)
    let scanState = null
    for (let attempt = 0; attempt < 120; attempt++) {
      await delay(500)
      scanState = await evaluate(`(() => {
        const text = document.body.innerText
        const status = text.split(String.fromCharCode(10)).find(line => line.includes('扫描完成') || line.includes('扫描失败')) ?? null
        return { status }
      })()`)
      if (scanState.status) break
    }
    libraryScan = { openedLibrarySettings, started, ...scanState }
    if (!openedLibrarySettings || !started || !scanState?.status?.includes('扫描完成')) throw new Error(`Local library scan smoke failed: ${JSON.stringify(libraryScan)}`)
  }

  await evaluate(`location.hash = '#/local?view=tracks'`)
  await delay(800)
  const playerBefore = await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const labels = [...document.querySelectorAll('button')].filter(visible).map(button => button.getAttribute('aria-label')).filter(Boolean)
    const playButton = [...document.querySelectorAll('button')].find(button => visible(button) && button.getAttribute('aria-label') === '播放')
    playButton?.click()
    return { clickedPlay: Boolean(playButton), hasPrevious: labels.includes('上一首'), hasNext: labels.includes('下一首'), title: document.title }
  })()`)
  await delay(1800)
  const playerPlaying = await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const pauseButton = [...document.querySelectorAll('button')].find(button => visible(button) && button.getAttribute('aria-label') === '暂停')
    pauseButton?.click()
    return { exposedPauseControl: Boolean(pauseButton), title: document.title }
  })()`)
  await delay(300)
  const volumeBefore = await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const labels = [...document.querySelectorAll('button')].filter(visible).map(button => button.getAttribute('aria-label')).filter(Boolean)
    const volumeButton = [...document.querySelectorAll('button')].find(button => visible(button) && (button.getAttribute('aria-label') === '已静音' || button.getAttribute('aria-label')?.startsWith('当前音量')))
    return { exposedPlayControl: labels.includes('播放'), volumeControl: Boolean(volumeButton), label: volumeButton?.getAttribute('aria-label') ?? null }
  })()`)
  if (args.get('restore-unmuted') == 'true') {
    await evaluate('window.app_event.setVolumeIsMute(false)')
    await delay(800)
  }
  const playerAfter = await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const labels = [...document.querySelectorAll('button')].filter(visible).map(button => button.getAttribute('aria-label')).filter(Boolean)
    return { exposedPlayControl: labels.includes('播放'), volumeLabel: labels.find(label => label === '已静音' || label.startsWith('当前音量')) ?? null }
  })()`)
  const player = { before: playerBefore, playing: playerPlaying, volumeBefore, after: playerAfter }
  if (!playerBefore.clickedPlay || !playerBefore.hasPrevious || !playerBefore.hasNext || !playerPlaying.exposedPauseControl || !playerAfter.exposedPlayControl || !volumeBefore.volumeControl) {
    throw new Error(`Player control smoke failed: ${JSON.stringify(player)}`)
  }

  const visualSettings = await evaluate(`(() => {
    const setting = window.lxData.appSetting
    const previous = {
      background: setting['playDetail.background'],
      layoutStyle: setting['playDetail.layoutStyle'],
      immersiveBackground: setting['playDetail.immersiveBackground'],
      immersiveEffect: setting['playDetail.immersiveEffect'],
    }
    setting['playDetail.background'] = 'aura'
    setting['playDetail.layoutStyle'] = 'classic'
    setting['playDetail.immersiveBackground'] = 'aura'
    setting['playDetail.immersiveEffect'] = 'diorama'
    return previous
  })()`)
  const openedDetail = await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const button = [...document.querySelectorAll('button')].find(item => visible(item) && item.getAttribute('aria-label')?.startsWith('播放详情页'))
    button?.click()
    return Boolean(button)
  })()`)
  await delay(1000)
  const aura = await evaluate(`({ canvasCount: document.querySelectorAll('canvas').length })`)
  const openedImmersive = await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const button = [...document.querySelectorAll('button')].find(item => visible(item) && item.getAttribute('aria-label')?.includes('沉浸'))
    button?.click()
    return Boolean(button)
  })()`)
  await delay(1500)
  const immersive = await evaluate(`({
    foliaHosts: document.querySelectorAll('.folia-visualizer-root').length,
    foliaCanvases: document.querySelectorAll('.folia-visualizer-root canvas').length,
    canvasCount: document.querySelectorAll('canvas').length,
  })`)
  await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const exitButton = [...document.querySelectorAll('button')].find(item => visible(item) && item.getAttribute('aria-label')?.includes('退出'))
    exitButton?.click()
    const previous = ${JSON.stringify(visualSettings)}
    const setting = window.lxData.appSetting
    setting['playDetail.background'] = previous.background
    setting['playDetail.layoutStyle'] = previous.layoutStyle
    setting['playDetail.immersiveBackground'] = previous.immersiveBackground
    setting['playDetail.immersiveEffect'] = previous.immersiveEffect
  })()`)
  await delay(400)
  await evaluate(`(() => {
    const visible = element => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    const closeButton = [...document.querySelectorAll('button[data-play-detail-artwork]')].find(visible)
    closeButton?.click()
  })()`)
  const visuals = { openedDetail, aura, openedImmersive, immersive }
  if (!openedDetail || aura.canvasCount < 1 || !openedImmersive || immersive.foliaHosts < 1 || immersive.foliaCanvases < 1) {
    throw new Error(`Aura/Folia/Diorama smoke failed: ${JSON.stringify(visuals)}`)
  }

  await evaluate(`location.hash = ${JSON.stringify(originalHash)}`)
  await delay(600)
  const visualState = await evaluate(`(() => ({
    canvasCount: document.querySelectorAll('canvas').length,
    foliaHosts: document.querySelectorAll('.folia-visualizer-root').length,
    buttons: [...document.querySelectorAll('button')].slice(-30).map(button => ({
      title: button.getAttribute('title'),
      ariaLabel: button.getAttribute('aria-label'),
      text: button.innerText.trim().slice(0, 30),
    })),
    ranges: [...document.querySelectorAll('input[type="range"]')].map(input => ({
      ariaLabel: input.getAttribute('aria-label'),
      min: input.min,
      max: input.max,
      value: input.value,
    })),
  }))()`)
  socket.close()

  console.log(JSON.stringify({ startup, routes: routeResults, libraryScan, player, visuals, restoredHash: originalHash, visualState, exceptions }, null, 2))
  if (exceptions.length) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
