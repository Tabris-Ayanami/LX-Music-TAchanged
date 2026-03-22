import { createMainWorkerProxy, createDownloadWorkerProxy } from './utils'


export default () => {
  return {
    main: createMainWorkerProxy(),
    download: createDownloadWorkerProxy(),
  }
}
