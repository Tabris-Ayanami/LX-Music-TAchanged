import { exposeWorker } from '../utils/worker'

import * as common from './common'
import * as list from './list'


console.log('hello main worker')


exposeWorker(Object.assign({}, common, list))

export type workerMainTypes = typeof common
  & typeof list
