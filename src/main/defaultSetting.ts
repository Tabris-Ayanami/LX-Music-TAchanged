import os from 'node:os'
import path from 'node:path'
import { createDefaultSetting } from '@common/defaultSetting'

export default createDefaultSetting({
  platform: process.platform,
  downloadSavePath: path.join(os.homedir(), 'Desktop'),
})
