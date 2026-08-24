import { exposeWorker } from '../utils/worker'

import * as download from './download'


console.log('hello download worker')


exposeWorker(Object.assign({}, download))

export type workerDownloadTypes = typeof download
