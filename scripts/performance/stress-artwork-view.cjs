#!/usr/bin/env node

const WebSocket = require('ws')

const args = new Map(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('=')
  return index < 0 ? [arg.replace(/^--/, ''), 'true'] : [arg.slice(2, index), arg.slice(index + 1)]
}))
const port = Number(args.get('port') ?? 9229)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

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
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const heap = async() => {
    const metrics = await call('Performance.getMetrics')
    return metrics.metrics.find(metric => metric.name == 'JSHeapUsedSize')?.value ?? null
  }

  await call('Performance.enable')
  await evaluate(`location.hash = '#/local?view=albums'`)
  await delay(5_000)
  const beforeHeap = await heap()
  const scroll = await evaluate(`(async() => {
    const elements = [...document.querySelectorAll('*')].filter(element => element.scrollHeight > element.clientHeight + 32)
    for (let round = 0; round < 24; round += 1) {
      for (const element of elements) element.scrollTop = round % 2 ? 0 : element.scrollHeight
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
    return {
      scrollContainers: elements.length,
      nativeArtworkUrls: [...document.images].filter(image => image.src.includes('/native-cache/') || image.src.includes('/native-core/cache/artwork/')).length,
    }
  })()`)
  await delay(2_000)
  const afterScrollHeap = await heap()
  await evaluate(`location.hash = '#/search'`)
  await delay(5_000)
  const afterReturnHeap = await heap()
  socket.close()
  console.log(JSON.stringify({ beforeHeap, afterScrollHeap, afterReturnHeap, ...scroll }, null, 2))
}

main().catch(error => { console.error(error); process.exit(1) })
