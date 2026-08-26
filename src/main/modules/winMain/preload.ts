import { clipboard, contextBridge, ipcRenderer, shell } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL as toFileURL } from 'node:url'
import {
  BILI_RENDERER_EVENT_NAME,
  CMMON_EVENT_NAME,
  DISLIKE_EVENT_NAME,
  HOTKEY_RENDERER_EVENT_NAME,
  NCM_API_RENDERER_EVENT_NAME,
  PLAYER_EVENT_NAME,
  WIN_LYRIC_RENDERER_EVENT_NAME,
  WIN_MAIN_RENDERER_EVENT_NAME,
} from '@common/ipcNames'

const allowedChannels = new Set<string>([
  ...Object.values(BILI_RENDERER_EVENT_NAME),
  ...Object.values(CMMON_EVENT_NAME),
  ...Object.values(DISLIKE_EVENT_NAME),
  ...Object.values(HOTKEY_RENDERER_EVENT_NAME),
  ...Object.values(NCM_API_RENDERER_EVENT_NAME),
  ...Object.values(PLAYER_EVENT_NAME),
  ...Object.values(WIN_LYRIC_RENDERER_EVENT_NAME),
  ...Object.values(WIN_MAIN_RENDERER_EVENT_NAME),
])

function assertChannel(name: unknown): asserts name is string {
  if (typeof name != 'string' || !allowedChannels.has(name)) throw new Error(`IPC channel is not allowed: ${String(name)}`)
}

let nextSubscriptionId = 1
const subscriptions = new Map<number, { name: string, listener: (_event: Electron.IpcRendererEvent, params: unknown) => void }>()

const bridge = {
  ipc: {
    send(name: string, params?: unknown) {
      assertChannel(name)
      ipcRenderer.send(name, params)
    },
    sendSync(name: string, params?: unknown) {
      assertChannel(name)
      return ipcRenderer.sendSync(name, params)
    },
    async invoke(name: string, params?: unknown) {
      assertChannel(name)
      return ipcRenderer.invoke(name, params)
    },
    on(name: string, callback: (params: unknown) => void) {
      assertChannel(name)
      if (typeof callback != 'function') throw new Error('IPC listener must be a function')
      const subscriptionId = nextSubscriptionId++
      const listener = (_event: Electron.IpcRendererEvent, params: unknown) => { callback(params) }
      subscriptions.set(subscriptionId, { name, listener })
      ipcRenderer.on(name, listener)
      return subscriptionId
    },
    once(name: string, callback: (params: unknown) => void) {
      assertChannel(name)
      if (typeof callback != 'function') throw new Error('IPC listener must be a function')
      ipcRenderer.once(name, (_event, params) => { callback(params) })
    },
    off(subscriptionId: number) {
      const subscription = subscriptions.get(subscriptionId)
      if (!subscription) return
      subscriptions.delete(subscriptionId)
      ipcRenderer.removeListener(subscription.name, subscription.listener)
    },
    offAll(name: string) {
      assertChannel(name)
      for (const [subscriptionId, subscription] of subscriptions) {
        if (subscription.name != name) continue
        subscriptions.delete(subscriptionId)
        ipcRenderer.removeListener(name, subscription.listener)
      }
    },
  },
  platform: {
    name: process.platform,
    arch: process.arch,
    appVersion: process.versions.app,
    isProduction: process.env.NODE_ENV == 'production',
    defaultDownloadPath: path.join(os.homedir(), 'Desktop'),
    pathSeparator: path.sep,
    normalizePath(filePath: string) {
      if (typeof filePath != 'string') throw new Error('Path must be a string')
      return path.normalize(filePath)
    },
    pathToFileURL(filePath: string) {
      if (typeof filePath != 'string') throw new Error('Path must be a string')
      return toFileURL(filePath).href
    },
    showItemInFolder(filePath: string) {
      if (typeof filePath != 'string') throw new Error('Path must be a string')
      shell.showItemInFolder(filePath)
    },
    async openExternal(url: string) {
      if (typeof url != 'string' || !/^https?:\/\//i.test(url)) throw new Error('Only HTTP(S) URLs are allowed')
      await shell.openExternal(url)
    },
    clipboardWriteText(text: string) {
      if (typeof text != 'string') throw new Error('Clipboard text must be a string')
      clipboard.writeText(text)
    },
    clipboardReadText() {
      return clipboard.readText()
    },
  },
}

if (process.contextIsolated) contextBridge.exposeInMainWorld('lxHost', bridge)
else Object.defineProperty(globalThis, 'lxHost', { value: bridge, configurable: false, writable: false })
