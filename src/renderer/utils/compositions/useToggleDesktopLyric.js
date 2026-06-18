import {
  computed,
} from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, isDesktopLyricDisabled, setLockDesktopLyric, setVisibleDesktopLyric } from '@renderer/store/setting'

export default () => {
  const t = useI18n()

  const toggleDesktopLyricBtnTitle = computed(() => {
    if (isDesktopLyricDisabled) return t('setting__desktop_lyric_disabled_tip')
    return `${
      appSetting['desktopLyric.enable']
        ? t('player__desktop_lyric_off')
        : t('player__desktop_lyric_on')
    }\n(${
      appSetting['desktopLyric.isLock']
        ? t('player__desktop_lyric_unlock')
        : t('player__desktop_lyric_lock')
    })`
  })

  const toggleDesktopLyric = () => {
    if (isDesktopLyricDisabled) return
    setVisibleDesktopLyric(!appSetting['desktopLyric.enable'])
  }
  const toggleLockDesktopLyric = () => {
    if (isDesktopLyricDisabled) return
    setLockDesktopLyric(!appSetting['desktopLyric.isLock'])
  }

  return {
    toggleDesktopLyricBtnTitle,
    toggleDesktopLyric,
    toggleLockDesktopLyric,
  }
}
