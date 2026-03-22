import * as Comlink from 'comlink'

export type MainTypes = Comlink.Remote<LX.WorkerMainTypes>

export const createMainWorker = () => {
  const worker: Worker = new Worker(new URL(
    /* webpackChunkName: 'renderer.main.worker' */
    '../main',
    import.meta.url,
  ))
  return Comlink.wrap<LX.WorkerMainTypes>(worker)
}

// export const createWorker = <T>(url: string): Comlink.Remote<T> => {
//   // @ts-expect-error
//   const worker: Worker = new Worker(new URL(url, import.meta.url))
//   return Comlink.wrap<T>(worker)
//   // worker.addEventListener('message', (event: MessageEvent) => {

//   // })
// }

export type DownloadTypes = Comlink.Remote<LX.WorkerDownloadTypes>
export const createDownloadWorker = () => {
  const worker: Worker = new Worker(new URL(
    /* webpackChunkName: 'renderer.download.worker' */
    '../download',
    import.meta.url,
  ))
  return Comlink.wrap<LX.WorkerDownloadTypes>(worker)
}

const createLazyWorker = <T extends object>(factory: () => T): T => {
  let worker: T | null = null
  const getWorker = () => {
    worker ??= factory()
    return worker
  }
  const proxyTarget: Record<PropertyKey, never> = {}
  return new Proxy(proxyTarget, {
    get(_target, prop) {
      const target = getWorker() as Record<PropertyKey, unknown>
      const value = target[prop]
      if (typeof value != 'function') return value
      return (...args: unknown[]) => {
        const nextValue = getWorker() as Record<PropertyKey, (...args: unknown[]) => unknown>
        return nextValue[prop](...args)
      }
    },
  }) as T
}

export const createMainWorkerProxy = (): MainTypes => createLazyWorker(createMainWorker)
export const createDownloadWorkerProxy = (): DownloadTypes => createLazyWorker(createDownloadWorker)

export const proxyCallback = <Args extends any[]>(callback: (...T: Args) => void) => {
  return Comlink.proxy(callback)
}
