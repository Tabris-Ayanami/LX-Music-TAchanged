export interface HostIpcBridge {
  send: (name: string, params?: unknown) => void
  sendSync: (name: string, params?: unknown) => unknown
  invoke: (name: string, params?: unknown) => Promise<unknown>
  on: (name: string, listener: (params: unknown) => void) => number
  once: (name: string, listener: (params: unknown) => void) => void
  off: (subscriptionId: number) => void
  offAll: (name: string) => void
}

export interface HostPlatformBridge {
  showItemInFolder: (path: string) => void
  openExternal: (url: string) => Promise<void>
  clipboardWriteText: (text: string) => void
  clipboardReadText: () => string
}

export interface LxHostBridge {
  ipc: HostIpcBridge
  platform: HostPlatformBridge
}

declare global {
  interface Window {
    lxHost: LxHostBridge
  }
}

export const getHostBridge = () => {
  if (!window.lxHost) throw new Error('LX host bridge is unavailable')
  return window.lxHost
}
