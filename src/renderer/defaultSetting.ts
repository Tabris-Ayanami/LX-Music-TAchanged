import { createDefaultSetting } from '@common/defaultSetting'
import { getHostBridge } from '@common/hostBridge'

const runtime = getHostBridge().platform

export default createDefaultSetting({
  platform: runtime.name,
  downloadSavePath: runtime.defaultDownloadPath,
})
