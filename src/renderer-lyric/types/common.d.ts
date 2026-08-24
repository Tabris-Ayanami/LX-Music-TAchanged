// import '@common/types/app_setting'
// import '@common/types/common'
// import '@common/types/user_api'
// import '@common/types/sync'
// import '@common/types/music'
// import '@common/types/list'
// import '@common/types/download_list'
// import '@common/types/player'
import '@common/types/shims_vue'
// import '@common/types/utils'
import '@common/types/theme'
import '@common/types/desktop_lyric'
import '@common/types/ipc_renderer'

// The isolated desktop-lyric renderer only receives transferred message
// ports from Electron. Keep that surface typed without loading Electron's
// complete browser-process declarations into this renderer compilation.
declare global {
  namespace Electron {
    interface IpcRendererEvent {
      ports: MessagePort[]
    }
  }
}
