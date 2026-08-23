import { ipcRenderer } from 'electron'

type IpcListener = (...args: any[]) => any
const listenerWrappers = new Map<string, Map<IpcListener, IpcListener[]>>()

export function rendererSend(name: string): void
export function rendererSend<T>(name: string, params: T): void
export function rendererSend<T>(name: string, params?: T): void {
  ipcRenderer.send(name, params)
}

export function rendererSendSync(name: string): void
export function rendererSendSync<T>(name: string, params: T): void
export function rendererSendSync<T>(name: string, params?: T): void {
  ipcRenderer.sendSync(name, params)
}

export async function rendererInvoke(name: string): Promise<void>
export async function rendererInvoke<V>(name: string): Promise<V>
export async function rendererInvoke<T>(name: string, params: T): Promise<void>
export async function rendererInvoke<T, V>(name: string, params: T): Promise<V>
export async function rendererInvoke <T, V>(name: string, params?: T): Promise<V> {
  return ipcRenderer.invoke(name, params)
}

export function rendererOn(name: string, listener: LX.IpcRendererEventListener): void
export function rendererOn<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void
export function rendererOn<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void {
  const wrapper = (event: Electron.IpcRendererEvent, params: T) => {
    listener({ event, params })
  }
  ipcRenderer.on(name, wrapper)
  let wrappersByListener = listenerWrappers.get(name)
  if (!wrappersByListener) {
    wrappersByListener = new Map()
    listenerWrappers.set(name, wrappersByListener)
  }
  const wrappers = wrappersByListener.get(listener) ?? []
  wrappers.push(wrapper)
  wrappersByListener.set(listener, wrappers)
}

export function rendererOnce(name: string, listener: LX.IpcRendererEventListener): void
export function rendererOnce<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void
export function rendererOnce<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void {
  ipcRenderer.once(name, (event, params) => {
    listener({ event, params })
  })
}

export const rendererOff = (name: string, listener: (...args: any[]) => any) => {
  const wrappersByListener = listenerWrappers.get(name)
  const wrappers = wrappersByListener?.get(listener)
  const wrapper = wrappers?.shift()
  if (wrapper) {
    ipcRenderer.removeListener(name, wrapper)
    if (!wrappers?.length) wrappersByListener?.delete(listener)
    if (!wrappersByListener?.size) listenerWrappers.delete(name)
    return
  }
  ipcRenderer.removeListener(name, listener)
}

export const rendererOffAll = (name: string) => {
  ipcRenderer.removeAllListeners(name)
  listenerWrappers.delete(name)
}
