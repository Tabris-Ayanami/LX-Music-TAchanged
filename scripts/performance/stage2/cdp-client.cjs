'use strict'

const WebSocket = require('ws')

const defaultFetchJson = async(port, pathname) => {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`)
  if (!response.ok) throw new Error(`CDP ${pathname} returned ${response.status}`)
  return response.json()
}

const selectRendererTarget = targets => targets.find(target => target.type === 'page' && /\/dist\/index\.html|\\dist\\index\.html/i.test(decodeURIComponent(target.url))) ??
  targets.find(target => target.type === 'page' && target.title !== 'User api')

const connectWebSocket = async(webSocketDebuggerUrl, target, WebSocketClass) => {
  if (!webSocketDebuggerUrl) throw new Error('CDP websocket endpoint was not found')
  const socket = new WebSocketClass(webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })

  let sequence = 0
  let closed = false
  const pending = new Map()
  const eventListeners = new Map()
  const rejectPending = error => {
    if (closed) return
    closed = true
    for (const waiter of pending.values()) waiter.reject(error)
    pending.clear()
    eventListeners.clear()
  }
  socket.on('message', raw => {
    const message = JSON.parse(String(raw))
    if (!message.id) {
      if (!message.method) return
      for (const listener of eventListeners.get(message.method) ?? []) listener(message.params ?? {})
      return
    }
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result)
  })
  socket.on('error', error => rejectPending(error))
  socket.on('close', () => rejectPending(new Error('CDP connection closed')))

  return {
    target,
    on(method, handler) {
      if (typeof method !== 'string' || method.length === 0) throw new TypeError('CDP event method is required')
      if (typeof handler !== 'function') throw new TypeError('CDP event handler must be a function')
      let listeners = eventListeners.get(method)
      if (!listeners) {
        listeners = new Set()
        eventListeners.set(method, listeners)
      }
      listeners.add(handler)
      return () => {
        listeners.delete(handler)
        if (listeners.size === 0) eventListeners.delete(method)
      }
    },
    call(method, params = {}) {
      if (closed) return Promise.reject(new Error('CDP connection is closed'))
      return new Promise((resolve, reject) => {
        const id = ++sequence
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }), error => {
          if (!error) return
          pending.delete(id)
          reject(error)
        })
      })
    },
    close() {
      if (closed) return
      socket.close()
      rejectPending(new Error('CDP connection closed'))
    },
  }
}

const connectRenderer = async(port, options = {}) => {
  if (!Number.isInteger(port) || port <= 0) throw new TypeError('CDP port must be a positive integer')
  const fetchJson = options.fetchJson ?? defaultFetchJson
  const WebSocketClass = options.WebSocketClass ?? WebSocket
  const targets = await fetchJson(port, '/json')
  const target = selectRendererTarget(targets)
  if (!target?.webSocketDebuggerUrl) throw new Error('LX-TA renderer target was not found')
  return connectWebSocket(target.webSocketDebuggerUrl, target, WebSocketClass)
}

module.exports = { connectRenderer, selectRendererTarget }
