import { backend } from '@renderer/backend'
import useMediaDevice from './useMediaDevice'
import usePlayerEvent from './usePlayerEvent'
import usePlayer from './usePlayer'
import usePlayStatus from './usePlayStatus'

export default () => {
  backend.player.initialize()

  usePlayerEvent()
  useMediaDevice() // 初始化音频驱动输出设置
  usePlayer()
  const initPlayStatus = usePlayStatus()

  return () => {
    void initPlayStatus()
  }
}
