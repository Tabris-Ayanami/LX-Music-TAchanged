import { getHostBridge } from './hostBridge'

type IpcListener = (...args: any[]) => any
const listenerWrappers = new Map<string, Map<IpcListener, number[]>>()

export function rendererSend(name: string): void
export function rendererSend<T>(name: string, params: T): void
export function rendererSend<T>(name: string, params?: T): void {
  getHostBridge().ipc.send(name, params)
}

export function rendererSendSync(name: string): void
export function rendererSendSync<T>(name: string, params: T): void
export function rendererSendSync<T>(name: string, params?: T): void {
  getHostBridge().ipc.sendSync(name, params)
}

export async function rendererInvoke(name: string): Promise<void>
export async function rendererInvoke<V>(name: string): Promise<V>
export async function rendererInvoke<T>(name: string, params: T): Promise<void>
export async function rendererInvoke<T, V>(name: string, params: T): Promise<V>
export async function rendererInvoke <T, V>(name: string, params?: T): Promise<V> {
  return getHostBridge().ipc.invoke(name, params) as Promise<V>
}

export function rendererOn(name: string, listener: LX.IpcRendererEventListener): void
export function rendererOn<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void
export function rendererOn<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void {
  const subscriptionId = getHostBridge().ipc.on(name, params => {
    listener({ event: undefined as never, params: params as T })
  })
  let wrappersByListener = listenerWrappers.get(name)
  if (!wrappersByListener) {
    wrappersByListener = new Map()
    listenerWrappers.set(name, wrappersByListener)
  }
  const subscriptions = wrappersByListener.get(listener) ?? []
  subscriptions.push(subscriptionId)
  wrappersByListener.set(listener, subscriptions)
}

export function rendererOnce(name: string, listener: LX.IpcRendererEventListener): void
export function rendererOnce<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void
export function rendererOnce<T>(name: string, listener: LX.IpcRendererEventListenerParams<T>): void {
  getHostBridge().ipc.once(name, params => {
    listener({ event: undefined as never, params: params as T })
  })
}

export const rendererOff = (name: string, listener: (...args: any[]) => any) => {
  const wrappersByListener = listenerWrappers.get(name)
  const subscriptions = wrappersByListener?.get(listener)
  const subscriptionId = subscriptions?.shift()
  if (subscriptionId != null) {
    getHostBridge().ipc.off(subscriptionId)
    if (!subscriptions?.length) wrappersByListener?.delete(listener)
    if (!wrappersByListener?.size) listenerWrappers.delete(name)
  }
}

export const rendererOffAll = (name: string) => {
  getHostBridge().ipc.offAll(name)
  listenerWrappers.delete(name)
}
