<template lang="pug">
div(:class="[$style.footerLeftControlBtns, { [$style.compact]: mode === 'main' }]")
  common-volume-btn(v-if="mode === 'extra'")
  PlayQueueBtn(v-if="mode === 'extra'")
  button(v-if="mode !== 'main'" :class="[$style.footerLeftControlBtn, $style.lrcBtn]" :aria-label="toggleDesktopLyricBtnTitle" @click="toggleDesktopLyric" @contextmenu="toggleLockDesktopLyric")
    svg(v-show="appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="125%" viewBox="0 0 512 512" space="preserve")
      use(xlink:href="#icon-desktop-lyric-on")
    svg(v-show="!appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="125%" viewBox="0 0 512 512" space="preserve")
      use(xlink:href="#icon-desktop-lyric-off")
  button(v-if="mode !== 'main'" :class="[$style.footerLeftControlBtn, { [$style.active]: appSetting['player.audioVisualization'] }]" :aria-label="$t('audio_visualization')" @click="toggleAudioVisualization")
    svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="95%" viewBox="0 0 24 24" space="preserve")
      use(xlink:href="#icon-audio-wave")
  button(v-if="mode !== 'main'" :class="[$style.footerLeftControlBtn, { [$style.active]: isShowLrcSelectContent }]" :aria-label="$t('lyric__select')" @click="toggleVisibleLrc")
    svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="95%" viewBox="0 0 24 24" space="preserve")
      use(xlink:href="#icon-text")
  button(v-if="mode !== 'main'" :class="[$style.footerLeftControlBtn, {[$style.active]: isShowPlayComment}]" :aria-label="$t('comment__show')" @click="toggleVisibleComment")
    svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="95%" viewBox="0 0 24 24" space="preserve")
      use(xlink:href="#icon-comment")
  common-sound-effect-btn(v-if="mode !== 'main'")
  common-playback-rate-btn(v-if="mode !== 'main'")
  common-toggle-play-mode-btn(v-if="mode !== 'main'")
  button(v-if="mode !== 'main'" :class="$style.footerLeftControlBtn" :aria-label="$t('player__add_music_to')" @click="isShowAddMusicTo = true")
    svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" space="preserve")
      use(xlink:href="#icon-add-2")
  common-list-add-modal(v-if="mode !== 'main'" v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo")
</template>

<script>
import { ref } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import {
  isShowLrcSelectContent,
  isShowPlayComment,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayLrcSelectContentLrc,
  setShowPlayComment,
} from '@renderer/store/player/action'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
import { dialog } from '@renderer/plugins/Dialog'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { appSetting, saveMediaDeviceId, setEnableAudioVisualization } from '@renderer/store/setting'
import PlayQueueBtn from './PlayQueueBtn.vue'

export default {
  components: {
    PlayQueueBtn,
  },
  props: {
    mode: {
      type: String,
      default: 'all',
    },
  },
  setup() {
    const t = useI18n()
    const toggleVisibleLrc = () => {
      setShowPlayLrcSelectContentLrc(!isShowLrcSelectContent.value)
    }
    const toggleVisibleComment = () => {
      setShowPlayComment(!isShowPlayComment.value)
    }
    const {
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
    } = useToggleDesktopLyric()

    const isShowAddMusicTo = ref(false)

    const toggleAudioVisualization = async() => {
      const newSetting = !appSetting['player.audioVisualization']
      if (newSetting && appSetting['player.mediaDeviceId'] !== 'default') {
        const confirm = await dialog.confirm({
          message: t('setting__player_audio_visualization_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!confirm) return
        await setMediaDeviceId('default').catch(_ => _)
        saveMediaDeviceId('default')
      }
      setEnableAudioVisualization(newSetting)
    }

    return {
      appSetting,
      isShowLrcSelectContent,
      toggleVisibleLrc,
      isShowPlayComment,
      toggleVisibleComment,
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
      toggleAudioVisualization,
      isShowAddMusicTo,
      playMusicInfo,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footerLeftControlBtns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px 16px;

  button {
    color: rgba(255, 255, 255, 0.94);
  }

  .footerLeftControlBtn {
    width: 24px;
    height: 24px;
    opacity: .82;
    cursor: pointer;
    transition: opacity @transition-normal, color @transition-normal, transform @transition-normal;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: none;
    padding: 0;

    &:hover {
      opacity: 1;
      transform: translateY(-1px);
    }

    &.active {
      color: var(--color-primary-light-100, var(--color-primary));
      opacity: 1;
    }
  }

  .lrcBtn {
    width: 20px;
  }
}

.compact {
  gap: 14px;
}
</style>
