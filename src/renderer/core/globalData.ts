// import defaultSetting from '@common/defaultSetting'
import createWorkers from '@renderer/worker'
import { getHostBridge } from '@common/hostBridge'

window.lx = {
  // appSetting: defaultSetting,
  isEditingHotKey: false,
  isPlayedStop: false,
  appHotKeyConfig: {
    local: {
      enable: false,
      keys: {},
    },
    global: {
      enable: false,
      keys: {},
    },
  },
  songListInfo: {
    fromName: '',
    searchKey: '',
    searchPosition: 0,
    songlistKey: '',
    songlistPosition: 0,
  },
  restorePlayInfo: null,
  worker: createWorkers(),
  isProd: getHostBridge().platform.isProduction,
  rootOffset: window.dt ? 0 : 8,
  apiInitPromise: [Promise.resolve(false), true, () => {}],
}

window.lxData = {}
