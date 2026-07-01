import { checkUpdate, getEnvParams, getViewPrevState, sendInited } from '@renderer/utils/ipc'

import { proxy, isFullscreen, themeId } from '@renderer/store'
import { appSetting, updateSetting } from '@renderer/store/setting'

import useSync from './useSync'
import useUpdate from './useUpdate'
import useDataInit from './useDataInit'
import useHandleEnvParams from './useHandleEnvParams'
import useEventListener from './useEventListener'
import useDeeplink from './useDeeplink'
import usePlayer from './usePlayer'
import useSettingSync from './useSettingSync'
import { useRouter } from '@common/utils/vueRouter'
import handleListAutoUpdate from './listAutoUpdate'
import { watch } from '@common/utils/vueTools'

let openAPIInitPromise: Promise<void> | null = null
const initOpenAPI = async() => {
  const { default: useOpenAPI } = await import('./useOpenAPI')
  await useOpenAPI()()
}
const ensureOpenAPI = async() => {
  openAPIInitPromise ||= initOpenAPI()
    .catch(error => {
      openAPIInitPromise = null
      console.warn('init open api failed', error)
    })
  await openAPIInitPromise
}

let statusbarLyricInitPromise: Promise<void> | null = null
const initStatusbarLyric = async() => {
  const { default: useStatusbarLyric } = await import('./useStatusbarLyric')
  await useStatusbarLyric()()
}
const ensureStatusbarLyric = async() => {
  statusbarLyricInitPromise ||= initStatusbarLyric()
    .catch(error => {
      statusbarLyricInitPromise = null
      console.warn('init statusbar lyric failed', error)
    })
  await statusbarLyricInitPromise
}


export default () => {
  // apiSource.value = appSetting['common.apiSource']
  proxy.enable = appSetting['network.proxy.enable']
  proxy.host = appSetting['network.proxy.host']
  proxy.port = appSetting['network.proxy.port']
  isFullscreen.value = appSetting['common.startInFullscreen']
  const activeThemeId = appSetting['theme.id'] == 'auto'
    ? appSetting['theme.lightId']
    : appSetting['theme.id']
  if (appSetting['theme.id'] == 'auto') {
    appSetting['theme.id'] = activeThemeId
    updateSetting({ 'theme.id': activeThemeId })
  }
  themeId.value = activeThemeId

  const router = useRouter()
  const initSyncService = useSync()
  useEventListener()
  const initPlayer = usePlayer()
  const handleEnvParams = useHandleEnvParams()
  const initData = useDataInit()
  const initDeeplink = useDeeplink()
  // const handleListAutoUpdate = useListAutoUpdate()

  useUpdate()
  useSettingSync()

  watch(() => appSetting['openAPI.enable'], enable => {
    if (enable) void ensureOpenAPI()
  })
  watch(() => appSetting['player.isShowStatusBarLyric'], enable => {
    if (enable) void ensureStatusbarLyric()
  })

  void getEnvParams().then(envParams => {
    // 移除代理相关的环境变量设置，防止请求库自动应用它们
    // eslint-disable-next-line no-undef
    // const processEnv = ENVIRONMENT
    // for (const key of Object.keys(processEnv)) {
    //   // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    //   if (/^(?:http_proxy|https_proxy|NO_PROXY)$/i.test(key)) delete processEnv[key]
    // }
    const envProxy = envParams.cmdParams['proxy-server']
    if (envProxy && typeof envProxy == 'string') {
      const [host, port = ''] = envProxy.split(':')
      proxy.envProxy = {
        host,
        port,
      }
    }

    void getViewPrevState().then(state => {
      void router.push({ path: state.url, query: state.query })
    })

    // 初始化我的列表、下载列表等数据
    void initData().then(() => {
      initPlayer()
      handleEnvParams(envParams) // 处理传入的启动参数
      void initDeeplink(envParams)
      void initSyncService()
      if (appSetting['openAPI.enable']) void ensureOpenAPI()
      if (appSetting['player.isShowStatusBarLyric']) void ensureStatusbarLyric()
      sendInited()

      handleListAutoUpdate()
      if (window.lx.isProd && appSetting['common.isAgreePact']) checkUpdate()
    })
  })
}
