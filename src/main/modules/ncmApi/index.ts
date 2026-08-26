import { mainHandle } from '@common/mainIpc'
import { NCM_API_RENDERER_EVENT_NAME } from '@common/ipcNames'

interface NcmApiRequestParams {
  endpoint: string
  params?: Record<string, any>
}

interface NcmApiResponse {
  status: number
  body: any
  cookie: string[]
}

type NcmApiModule = Record<string, (params?: Record<string, any>) => Promise<NcmApiResponse>>

let apiModule: NcmApiModule | null = null

const loadApiModule = (): NcmApiModule => {
  if (apiModule) return apiModule
  // api-enhanced 整包保留在主进程，后续新接口可直接通过 endpoint 调用
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loadedModule = require('@neteasecloudmusicapienhanced/api') as NcmApiModule
  apiModule = loadedModule
  return loadedModule
}

export const requestNcmApi = async(endpoint: string, params: Record<string, any> = {}) => {
  const api = loadApiModule()
  const handler = api[endpoint]
  if (typeof handler != 'function') throw new Error(`Unsupported NCM API: ${endpoint}`)
  return handler(params)
}

export default () => {
  mainHandle<NcmApiRequestParams, {
    status: number
    body: any
    cookie: string[]
  }>(NCM_API_RENDERER_EVENT_NAME.request, async({ params }) => {
    if (!params || typeof params.endpoint != 'string' || !/^[a-z0-9_]+$/i.test(params.endpoint)) {
      throw new Error('Invalid NCM API request')
    }
    return requestNcmApi(params.endpoint, params.params ?? {})
  })
}
