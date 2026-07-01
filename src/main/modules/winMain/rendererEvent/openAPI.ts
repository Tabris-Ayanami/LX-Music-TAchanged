import { mainHandle } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

let openApiModulePromise: Promise<typeof import('@main/modules/openApi')> | null = null
const getOpenApiModule = async() => {
  return openApiModulePromise ??= import('@main/modules/openApi')
}

export default () => {
  mainHandle<LX.OpenAPI.Actions, any>(WIN_MAIN_RENDERER_EVENT_NAME.open_api_action, async({ params: data }) => {
    const {
      startServer,
      stopServer,
      getStatus,
    } = await getOpenApiModule()
    switch (data.action) {
      case 'enable':
        return data.data.enable ? await startServer(parseInt(data.data.port), data.data.bindLan) : await stopServer()
      case 'status': return getStatus()
    }
  })
}
