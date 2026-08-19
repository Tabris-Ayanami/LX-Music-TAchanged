#!/usr/bin/env node

const WebSocket = require('ws')

const args = new Map(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('=')
  return index < 0 ? [arg.replace(/^--/, ''), 'true'] : [arg.slice(2, index), arg.slice(index + 1)]
}))
const port = Number(args.get('port') ?? 9229)
const delay = async(ms) => new Promise(resolve => setTimeout(resolve, ms))

const main = async() => {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const page = targets.find(target => target.type == 'page' && /dist[\\/]index\.html/i.test(decodeURIComponent(target.url)))
  if (!page?.webSocketDebuggerUrl) throw new Error('LX-TA renderer target was not found')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  let id = 0
  const pending = new Map()
  socket.on('message', raw => {
    const message = JSON.parse(String(raw))
    if (!message.id) return
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result)
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id
    pending.set(requestId, { resolve, reject })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
  const evaluate = async expression => {
    const value = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text)
    return value.result.value
  }

  await call('Runtime.enable')
  await evaluate(`(async() => {
    const patch = { 'backend.metadata': 'native-shadow', 'backend.artwork': 'native' }
    Object.assign(window.lxData.appSetting, patch)
    await window.lxData.updateSetting(patch)
    location.hash = '#/local?view=albums'
  })()`)
  await delay(5_000)
  const nativeArtworkUrls = await evaluate(`([...document.images].map(image => image.src).filter(src => src.includes('/native-cache/') || src.includes('/native-core/cache/artwork/')).length)`)
  await evaluate(`location.hash = '#/local?view=tracks'`)
  await delay(1_500)
  const menuOpened = await evaluate(`(() => {
    const row = document.querySelector('.list-item')
    if (!row) return false
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 160, clientY: 160 }))
    return true
  })()`)
  if (!menuOpened) throw new Error('No local track row was available for ElectronBackendAdapter integration')
  await delay(500)
  const editorOpened = await evaluate(`(() => {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find(element => element.textContent?.includes('编辑歌曲信息'))
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return Boolean(item)
  })()`)
  if (!editorOpened) throw new Error('Metadata action was not available')
  await delay(4_000)
  const state = await evaluate(`(() => ({
    metadataEditor: document.body.innerText.includes('编辑歌曲信息'),
    metadataError: [...document.querySelectorAll('[role="alert"]')].map(element => element.textContent).filter(Boolean),
    artworkBackend: window.lxData.appSetting['backend.artwork'],
    localRows: document.querySelectorAll('.list-item').length,
  }))()`)
  if (!state.metadataEditor || state.metadataError.length) throw new Error(`MetadataService integration failed: ${JSON.stringify(state)}`)
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(element => element.textContent?.trim() == '取消')
    button?.click()
  })()`)
  if (args.get('keep-native') != 'true') {
    await evaluate(`(() => {
      const patch = { 'backend.artwork': 'electron', 'backend.metadata': 'native-shadow' }
      Object.assign(window.lxData.appSetting, patch)
      return window.lxData.updateSetting(patch)
    })()`)
    await delay(500)
  }
  socket.close()
  console.log(JSON.stringify({ menuOpened, editorOpened, ...state, nativeArtworkUrls }, null, 2))
}

main().catch(error => { console.error(error); process.exit(1) })
