import { apiSource, qualityList, userApi } from '@renderer/store'
import { appSetting, setApiSource } from '@renderer/store/setting'
import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'

let prevId = ''
const qualityByApi: Record<string, LX.QualityList> = {
  temp: {
    bili: ['flac24bit', '320k', '192k', '128k'],
  },
}

const loadApiSourceInfo = async() => {
  return (await import('@renderer/utils/musicSdk/api-source-info')).default
}

const getQualityByApi = async(apiId: string) => {
  if (qualityByApi[apiId]) return qualityByApi

  const apiSourceInfo = await loadApiSourceInfo()
  for (const api of apiSourceInfo) {
    qualityByApi[api.id] = {
      ...api.supportQualitys,
      bili: ['flac24bit', '320k', '192k', '128k'],
    }
  }
  return qualityByApi
}

export const setUserApi = async(apiId: string) => {
  if (prevId == apiId) return
  prevId = apiId
  if (window.lx.apiInitPromise[1]) {
    window.lx.apiInitPromise[0] = new Promise<boolean>(resolve => {
      window.lx.apiInitPromise[1] = false
      window.lx.apiInitPromise[2] = (result: boolean) => {
        window.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }

  if (/^user_api/.test(apiId)) {
    qualityList.value = {}
    userApi.status = false
    userApi.message = 'initing'

    try {
      await setUserApiAction(apiId)
      if (prevId != apiId) return
      apiSource.value = apiId
    } catch (err) {
      if (prevId != apiId) return
      if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](false)
      console.log(err)
      const apiSourceInfo = await loadApiSourceInfo()
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      apiSource.value = api.id
      if (api.id != appSetting['common.apiSource']) setApiSource(api.id)
    }
  } else {
    qualityList.value = (await getQualityByApi(apiId))[apiId] ?? {}
    apiSource.value = apiId
    void setUserApiAction(apiId)
    if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](true)
  }

  if (prevId != apiId) return
  if (apiId != appSetting['common.apiSource']) setApiSource(apiId)
}
