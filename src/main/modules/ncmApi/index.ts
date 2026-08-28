import { mainHandle } from '@common/mainIpc'
import { NCM_API_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { parseCookieToRecord } from '@common/wyAccountCookie'
import type { NcmApiRequestParams, NcmApiResponse } from '@common/types/wyAccount'

type NcmApiModule = Record<string, (params?: Record<string, unknown>) => Promise<NcmApiResponse>>

let apiModule: NcmApiModule | null = null

const loadApiModule = (): NcmApiModule => {
  if (apiModule) return apiModule
  // api-enhanced 整包保留在主进程，后续新接口可直接通过 endpoint 调用
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loadedModule = require('@neteasecloudmusicapienhanced/api') as NcmApiModule
  apiModule = loadedModule
  return loadedModule
}

const preprocessParams = (params: Record<string, unknown>): Record<string, unknown> => {
  const cookie = params.cookie
  if (typeof cookie != 'string' || !cookie) return params
  const record = parseCookieToRecord(cookie)
  if (!Object.keys(record).length) console.warn('[ncmApi] cookie 无有效键值对')
  return { ...params, cookie: record }
}

export const requestNcmApi = async(endpoint: string, params: Record<string, unknown> = {}): Promise<NcmApiResponse> => {
  const api = loadApiModule()
  const handler = api[endpoint]
  if (typeof handler != 'function') throw new Error(`Unsupported NCM API: ${endpoint}`)
  try {
    return await handler(preprocessParams(params))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ncmApi] endpoint=%s failed: %s', endpoint, message)
    throw new Error(`${endpoint}: ${message}`)
  }
}

export default () => {
  mainHandle<NcmApiRequestParams, NcmApiResponse>(NCM_API_RENDERER_EVENT_NAME.request, async({ params }) => {
    if (!params || typeof params.endpoint != 'string' || !/^[a-z0-9_]+$/i.test(params.endpoint)) {
      throw new Error('Invalid NCM API request')
    }
    return requestNcmApi(params.endpoint, (params.params ?? {}) as Record<string, unknown>)
  })
}