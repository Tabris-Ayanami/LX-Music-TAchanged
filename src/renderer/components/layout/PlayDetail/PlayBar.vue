<template>
  <div :class="$style.footer">
    <div :class="$style.headerRow">
      <div :class="$style.metaBlock">
        <h2 :class="$style.title">{{ playTitle }}</h2>
        <div v-if="musicArtistLine" :class="$style.metaSubline">{{ musicArtistLine }}</div>
      </div>
      <material-popup-btn :class="$style.popupAnchor" :popup-class="$style.popupFrame" :list-class="$style.popupFrameList" no-arrow>
        <button type="button" :class="[$style.iconBtn, $style.moreBtn]" :aria-label="$t('player__playback_rate')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-dots-horizontal" />
          </svg>
        </button>
        <template #content>
          <div :class="$style.popupPanel" :style="popupThemeStyle">
            <div :class="$style.popupInfo">
              <span>{{ playbackRate.toFixed(2) }}x</span>
              <div :class="$style.popupActions">
                <base-checkbox
                  id="player__playback_preserves_pitch_detail"
                  :model-value="appSetting['player.preservesPitch']"
                  :label="$t('player__playback_preserves_pitch')"
                  @update:model-value="updatePreservesPitch"
                />
                <base-btn min @click="handleUpdatePlaybackRate(100)">{{ $t('player__playback_rate_reset_btn') }}</base-btn>
              </div>
            </div>
            <base-slider-bar :class="$style.popupSlider" :value="playbackRate * 100" :min="50" :max="200" @change="handleUpdatePlaybackRate" />
          </div>
        </template>
      </material-popup-btn>
    </div>

    <div :class="$style.progressTrack">
      <common-progress-bar
        :class-name="$style.progress"
        :progress="progress"
        :handle-transition-end="handleTransitionEnd"
        :is-active-transition="isActiveTransition"
      />
    </div>

    <div :class="$style.timeRow">
      <span>{{ nowPlayTimeStr }}</span>
      <span>{{ remainingTimeStr }}</span>
    </div>

    <div :class="$style.transportRow">
        <button type="button" :class="[$style.iconBtn, $style.modeBtn, { [$style.activeIcon]: isListLoopMode }]" :aria-label="$t('player__play_toggle_mode_list_loop')" @click.stop="enableListLoop()">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
          <use xlink:href="#icon-shuffle-amll" />
          </svg>
        </button>
      <button type="button" :class="[$style.transportBtn, $style.prevBtn]" :aria-label="$t('player__prev')" @click.stop="playPrev()">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 134 134" space="preserve">
          <use xlink:href="#icon-amll-rewind" />
        </svg>
      </button>
      <button type="button" :class="$style.playBtn" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click.stop="togglePlay()">
        <svg v-if="isPlay" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 38 38" space="preserve">
          <use xlink:href="#icon-amll-pause" />
        </svg>
        <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 38 38" space="preserve">
          <use xlink:href="#icon-amll-play" />
        </svg>
      </button>
      <button type="button" :class="[$style.transportBtn, $style.nextBtn]" :aria-label="$t('player__next')" @click.stop="playNext()">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 134 134" space="preserve">
          <use xlink:href="#icon-amll-forward" />
        </svg>
      </button>
      <button type="button" :class="[$style.iconBtn, $style.soundBtn]" :aria-label="$t('player__sound_effect')" @click.stop="soundEffectVisible = true">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
          <use xlink:href="#icon-sliders-modern" />
          </svg>
      </button>
    </div>

    <div :class="$style.volumeRow">
      <button type="button" :class="[$style.iconBtn, $style.volumeBtn]" :aria-label="isMute ? 'Unmute' : 'Mute'" @click.stop="saveVolumeIsMute(!isMute)">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
          <use xlink:href="#icon-sound-modern" />
        </svg>
      </button>
      <base-slider-bar
        :class-name="$style.volumeSlider"
        :value="volume"
        :min="0"
        :max="1"
        :step="0.01"
        @change="handleUpdateVolume"
      />
      <span :class="$style.volumeValue">{{ Math.round(volume * 100) }}</span>
    </div>

    <material-modal
      :show="soundEffectVisible"
      bg-close="bg-close"
      teleport="#root"
      :close-btn="false"
      :hide-header="true"
      overlay-filter-mode="off"
      :content-class="$style.soundModalFrame"
      min-width="0"
      width="min(1080px, calc(100vw - 48px))"
      max-width="calc(100vw - 48px)"
      max-height="calc(100vh - 40px)"
      @close="soundEffectVisible = false"
    >
      <div :class="$style.soundModal">
        <div :class="$style.soundHeader">
          <strong>{{ $t('player__sound_effect') }}</strong>
          <button type="button" :class="$style.soundCloseBtn" :aria-label="$t('close')" @click="soundEffectVisible = false">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
              <use xlink:href="#icon-close" />
            </svg>
          </button>
        </div>
        <div :class="$style.soundColumns">
          <div :class="['scroll', $style.soundColumn]">
            <AudioConvolution />
            <PitchShifter />
            <AudioPanner />
          </div>
          <div :class="['scroll', $style.soundColumn]">
            <BiquadFilter />
          </div>
        </div>
        <p v-if="showSoundTip" :class="$style.soundTip">{{ $t('player__sound_effect_features_tip') }}</p>
      </div>
    </material-modal>
  </div>
</template>

<script setup>
import { formatPlayTime2 } from '@common/utils/common'
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import AudioConvolution from '@renderer/components/common/SoundEffectBtn/AudioConvolution.vue'
import AudioPanner from '@renderer/components/common/SoundEffectBtn/AudioPanner.vue'
import BiquadFilter from '@renderer/components/common/SoundEffectBtn/BiquadFilter.vue'
import PitchShifter from '@renderer/components/common/SoundEffectBtn/PitchShifter.vue'
import { playNext, playPrev, togglePlay } from '@renderer/core/player'
import { playbackRate } from '@renderer/store/player/playbackRate'
import { playProgress } from '@renderer/store/player/playProgress'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { isMute, volume } from '@renderer/store/player/volume'
import { appSetting, saveVolumeIsMute, setTogglePlayMode, updateSetting } from '@renderer/store/setting'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'

const {
  nowPlayTimeStr,
  progress,
  isActiveTransition,
  handleTransitionEnd,
} = usePlayProgress()

const soundEffectVisible = ref(false)
const showSoundTip = ref(false)
const popupThemeStyle = ref({})
let popupThemeObserver = null

const updatePopupThemeStyle = () => {
  const themeHost = document.getElementById('container')
  const hostStyles = themeHost ? window.getComputedStyle(themeHost) : null
  const rootStyles = window.getComputedStyle(document.documentElement)
  const popupAccent = [
    hostStyles?.getPropertyValue('--shell-accent')?.trim(),
    hostStyles?.getPropertyValue('--color-primary')?.trim(),
    rootStyles.getPropertyValue('--color-primary').trim(),
  ].find(color => color) ?? 'rgb(77, 175, 124)'

  popupThemeStyle.value = {
    '--popup-accent': popupAccent,
  }
}

watch(soundEffectVisible, visible => {
  if (visible) showSoundTip.value = appSetting['player.mediaDeviceId'] != 'default'
})

onMounted(() => {
  updatePopupThemeStyle()
  popupThemeObserver = new MutationObserver(updatePopupThemeStyle)
  const themeHost = document.getElementById('container')
  if (themeHost) popupThemeObserver.observe(themeHost, { attributes: true, attributeFilter: ['class', 'style'] })
  popupThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
})

onBeforeUnmount(() => {
  popupThemeObserver?.disconnect()
  popupThemeObserver = null
})

const handleUpdateVolume = val => {
  window.app_event.setVolume(val)
}

const handleUpdatePlaybackRate = val => {
  window.app_event.setPlaybackRate(Math.round(val) / 100)
}

const updatePreservesPitch = enabled => {
  updateSetting({ 'player.preservesPitch': enabled })
}

const enableListLoop = () => {
  if (appSetting['player.togglePlayMethod'] == 'listLoop') return
  setTogglePlayMode('listLoop')
}

const playTitle = computed(() => playMusicInfo.musicInfo?.name || '')

const musicArtistLine = computed(() => {
  const info = playMusicInfo.musicInfo
  if (!info) return ''
  const items = []
  if (info.singer) items.push(info.singer)
  if (info.meta?.albumName) items.push(info.meta.albumName)
  return items.join(' / ')
})

const remainingTimeStr = computed(() => `-${formatPlayTime2(Math.max(0, playProgress.maxPlayTime - playProgress.nowPlayTime))}`)
const isListLoopMode = computed(() => appSetting['player.togglePlayMethod'] == 'listLoop')
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footer {
  --card-control: rgba(255, 255, 255, 0.94);
  --card-control-muted: rgba(255, 255, 255, 0.72);
  --card-soft-bg: rgba(255, 255, 255, 0.1);
  --card-soft-bg-hover: rgba(255, 255, 255, 0.16);
  --card-shadow: 0 14px 28px rgba(0, 0, 0, 0.14);
  --slider-track-color: rgba(255, 255, 255, 0.24);
  --slider-fill-color: rgba(244, 246, 244, 0.9);
  --slider-drag-fill-color: rgba(255, 255, 255, 0.82);
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-rows: auto auto auto auto auto;
  gap: 9px;
  width: 100%;
  padding-top: 0;
  transform: translateY(-6px);
  pointer-events: auto;
}

.headerRow,
.timeRow,
.transportRow,
.volumeRow {
  width: 100%;
  position: relative;
  z-index: 2;
}

.headerRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
}

.metaBlock {
  min-width: 0;
}

.title {
  margin: 0;
  font-size: clamp(18px, 1.78vw, 23px);
  line-height: 1.1;
  font-weight: 760;
  letter-spacing: -.03em;
  color: rgba(255, 255, 255, 0.98);
  .mixin-ellipsis-1();
}

.metaSubline {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.64);
  .mixin-ellipsis-1();
}

.popupAnchor {
  position: relative;
  z-index: 3;
  flex: none;
}

.iconBtn,
.transportBtn,
.playBtn {
  position: relative;
  z-index: 2;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--card-control);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .2s ease, opacity .2s ease, background-color .2s ease;
  pointer-events: auto;

  svg {
    display: block;
    fill: currentColor;
  }
}

.iconBtn {
  width: 32px;
  height: 32px;
  color: var(--card-control-muted);

  svg {
    width: 19px;
    height: 19px;
  }

  &:hover {
    color: var(--card-control);
    transform: translateY(-1px);
  }
}

.moreBtn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.popupFrame {
  border-radius: 20px;
  background: rgba(251, 253, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 22px 48px rgba(20, 29, 46, 0.16);
  backdrop-filter: blur(28px) saturate(148%);
  -webkit-backdrop-filter: blur(28px) saturate(148%);
  filter: none;
}

.popupFrameList {
  padding: 0;
}

.popupPanel {
  --popup-accent: var(--shell-accent, #4da7d0);
  --color-primary: var(--popup-accent);
  --color-primary-font: color-mix(in srgb, var(--popup-accent) 88%, white 12%);
  --color-font-label: rgba(84, 97, 118, 0.7);
  --color-button-font: color-mix(in srgb, var(--popup-accent) 84%, white 16%);
  --color-button-background: color-mix(in srgb, var(--popup-accent) 14%, transparent);
  --color-button-background-hover: color-mix(in srgb, var(--popup-accent) 20%, transparent);
  --color-button-background-active: color-mix(in srgb, var(--popup-accent) 26%, transparent);
  --slider-track-color: color-mix(in srgb, var(--popup-accent) 18%, white 82%);
  --slider-fill-color: color-mix(in srgb, var(--popup-accent) 74%, white 26%);
  width: min(258px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: transparent;
  border: none;
  color: rgba(31, 38, 49, 0.94);
  box-shadow: none;
}

.popupInfo {
  display: flex;
  flex-direction: column;
  gap: 12px;

  span {
    font-size: 18px;
    font-weight: 800;
    color: rgba(31, 38, 49, 0.94);
  }
}

.popupActions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;

  :global(.base-checkbox-label) {
    color: rgba(45, 55, 67, 0.9);
    font-size: 15px;
    font-weight: 700;
  }

  :global(.base-btn) {
    border-radius: 10px;
    align-self: flex-end;
  }
}

.popupSlider {
  width: 100%;
}

.progressTrack {
  width: 100%;
  padding-top: 3px;
  position: relative;
  z-index: 2;
}

.progress {
  height: 4px !important;
}

.timeRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.82);
}

.transportRow {
  display: grid;
  grid-template-columns: 32px 56px 76px 56px 32px;
  align-items: center;
  justify-content: center;
  gap: 30px;
  min-height: 94px;
}

.modeBtn,
.soundBtn {
  color: rgba(255, 255, 255, 0.94);

  svg {
    width: 22px;
    height: 22px;
  }
}

.activeIcon {
  color: rgba(255, 255, 255, 0.98);
}

.transportBtn {
  width: 56px;
  height: 56px;
  color: rgba(255, 255, 255, 0.98);

  svg {
    width: 38px;
    height: 38px;
  }

  &:hover {
    transform: translateY(-1px) scale(1.02);
  }
}

.playBtn {
  width: 76px;
  height: 76px;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.98);
  box-shadow: none;

  svg {
    width: 46px;
    height: 46px;
  }

  &:hover {
    transform: translateY(-1px) scale(1.02);
  }
}

.prevBtn,
.nextBtn {
  svg {
    width: 40px;
    height: 40px;
  }
}

.modeBtn,
.soundBtn,
.prevBtn,
.nextBtn,
.playBtn {
  justify-self: center;
  align-self: center;
}

.volumeRow {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-top: -6px;
}

.volumeBtn {
  width: 24px;
  height: 24px;
  color: rgba(255, 255, 255, 0.72);

  svg {
    width: 19px;
    height: 19px;
  }
}

.volumeSlider {
  width: 100% !important;
}

.volumeValue {
  min-width: 28px;
  text-align: right;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
}

.soundModalFrame {
  border-radius: 28px !important;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: hidden !important;
}

.soundModal {
  width: min(1080px, calc(100vw - 48px));
  max-width: 100%;
  max-height: calc(100vh - 40px);
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  gap: 0;
  padding: 20px 24px 22px;
  border-radius: 28px;
  background: rgba(251, 253, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 56px rgba(20, 29, 46, 0.14);
  backdrop-filter: blur(28px) saturate(148%);
  -webkit-backdrop-filter: blur(28px) saturate(148%);
  color: rgba(31, 38, 49, 0.94);
  overflow: hidden;
}

.soundHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;

  strong {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -.02em;
    color: rgba(31, 38, 49, 0.94);
  }
}

.soundCloseBtn {
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(91, 103, 123, 0.1);
  color: rgba(51, 59, 70, 0.76);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform @transition-fast, background-color @transition-fast, color @transition-fast;

  &:hover {
    transform: translateY(-1px);
    background: rgba(91, 103, 123, 0.16);
    color: rgba(31, 38, 49, 0.96);
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

.soundColumns {
  display: flex;
  flex-flow: row nowrap;
  padding: 0;
  margin: 0;
  gap: 22px;
  position: relative;
  min-height: 0;

  &:before {
    .mixin-after();
    position: absolute;
    left: 50%;
    height: 100%;
    border-left: 1px dashed rgba(129, 144, 168, 0.32);
  }

  :global(.player__sound_effect_title) {
    font-size: 15px;
    padding-bottom: 10px;
    color: rgba(31, 38, 49, 0.94);
  }

  :global(.base-checkbox-label) {
    color: rgba(45, 55, 67, 0.88);
  }
}

.soundColumn {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  display: flex;
  gap: 16px;
  flex-flow: column nowrap;
  padding: 0 12px;
  box-sizing: border-box;
}

.soundTip {
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(70, 79, 91, 0.78);
}

@media (max-width: 920px) {
  .headerRow {
    gap: 10px;
  }

  .transportRow {
    grid-template-columns: 28px 46px 66px 46px 28px;
    gap: 18px;
  }

  .playBtn {
    width: 66px;
    height: 66px;

    svg {
      width: 38px;
      height: 38px;
    }
  }

  .transportBtn {
    width: 46px;
    height: 46px;

    svg {
      width: 31px;
      height: 31px;
    }
  }

  .modeBtn,
  .soundBtn {
    svg {
      width: 19px;
      height: 19px;
    }
  }

  .soundModal {
    width: calc(100vw - 24px);
    padding: 16px;
  }

  .soundColumns {
    flex-direction: column;

    &:before {
      display: none;
    }
  }

  .soundColumn {
    width: 100%;
    padding: 0;
  }
}
</style>
