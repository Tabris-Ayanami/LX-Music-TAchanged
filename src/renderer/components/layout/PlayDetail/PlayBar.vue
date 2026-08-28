<template>
  <div :class="$style.footer">
    <div :class="[$style.headerRow, 'playDetailHeaderRow']">
      <div :class="[$style.metaBlock, 'playDetailMetaBlock']">
        <h2 :class="$style.title">{{ playTitle }}</h2>
        <div v-if="musicArtistLine" :class="$style.metaSubline">{{ musicArtistLine }}</div>
      </div>
      <div :class="$style.headerActions">
        <span v-if="formatLabel" :class="[$style.qualityCapsule, 'playDetailQualityCapsule']">{{ formatLabel }}</span>
        <button
          type="button"
          :class="[$style.iconBtn, $style.songInfoBtn, 'playDetailSongInfoBtn']"
          aria-label="查看歌曲信息"
          :disabled="!canEditMetadata"
          @click.stop="handleOpenSongInfo"
        >
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-info-modern" />
          </svg>
        </button>
      </div>
    </div>

    <div :class="[$style.progressTrack, 'playDetailProgressTrack']">
      <common-progress-bar
        :class-name="$style.progress"
        :progress="progress"
        :handle-transition-end="handleTransitionEnd"
        :is-active-transition="isActiveTransition"
      />
    </div>

    <div :class="[$style.timeRow, 'playDetailTimeRow']">
      <span>{{ nowPlayTimeStr }}</span>
      <span>{{ remainingTimeStr }}</span>
    </div>

    <div :class="[$style.transportRow, 'playDetailTransportRow']">
        <button type="button" :class="[$style.iconBtn, $style.modeBtn, { [$style.activeIcon]: isTogglePlayActive }]" :aria-label="currentTogglePlayLabel" @click.stop="toggleNextPlayMode()">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :viewBox="currentTogglePlayIcon.viewBox" space="preserve">
          <use :xlink:href="currentTogglePlayIcon.id" />
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

    <div :class="[$style.volumeRow, 'playDetailVolumeRow']">
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

    <ImmersiveSoundPanel v-model:show="soundEffectVisible" />
    <LocalTrackActions ref="localTrackActionsRef" :list-id="metadataListId" teleport-target="#root" />
  </div>
</template>

<script setup>
import { formatPlayTime2 } from '@common/utils/common'
import { computed, ref } from '@common/utils/vueTools'
import { playNext, playPrev, togglePlay } from '@renderer/core/player'
import { getPlayQuality } from '@renderer/core/music/utils'
import { playProgress } from '@renderer/store/player/playProgress'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { isMute, volume } from '@renderer/store/player/volume'
import { appSetting, saveVolumeIsMute, setTogglePlayMode } from '@renderer/store/setting'
import { LOCAL_MUSIC_LIST_ID } from '@renderer/utils/localMusic'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import ImmersiveSoundPanel from './ImmersiveSoundPanel.vue'
import LocalTrackActions from '@renderer/components/localMusic/LocalTrackActions.vue'

const {
  nowPlayTimeStr,
  progress,
  isActiveTransition,
  handleTransitionEnd,
} = usePlayProgress()

const soundEffectVisible = ref(false)
const localTrackActionsRef = ref(null)

const handleUpdateVolume = val => {
  window.app_event.setVolume(val)
}

const togglePlayModes = ['listLoop', 'random', 'list', 'singleLoop', 'none']
const togglePlayIconMap = {
  listLoop: { id: '#icon-list-loop', viewBox: '0 0 24 24' },
  random: { id: '#icon-list-random', viewBox: '0 0 24 24' },
  list: { id: '#icon-list-order', viewBox: '0 0 32 32' },
  singleLoop: { id: '#icon-single-loop', viewBox: '0 0 24 24' },
  none: { id: '#icon-single', viewBox: '0 0 32 32' },
}

const toggleNextPlayMode = () => {
  const currentMode = appSetting['player.togglePlayMethod']
  const currentIndex = togglePlayModes.indexOf(currentMode)
  const nextMode = togglePlayModes[(currentIndex + 1) % togglePlayModes.length] ?? 'listLoop'
  setTogglePlayMode(nextMode)
}

const currentDownloadItem = computed(() => {
  const item = playMusicInfo.musicInfo
  return item && 'metadata' in item ? item : null
})

const currentMusicInfo = computed(() => {
  const item = playMusicInfo.musicInfo
  if (!item) return null
  return 'metadata' in item ? item.metadata.musicInfo : item
})

const formatLabel = computed(() => {
  const download = currentDownloadItem.value
  if (download) return download.metadata.ext.toUpperCase()

  const info = currentMusicInfo.value
  if (!info) return ''
  if (info.source == 'local') return info.meta.ext.toUpperCase()
  if (info.source == 'bili') return 'BILI'
  return getPlayQuality(appSetting['player.playQuality'], info).toUpperCase()
})

const canEditMetadata = computed(() => currentMusicInfo.value?.source == 'local')
const metadataListId = computed(() => playMusicInfo.listId ?? LOCAL_MUSIC_LIST_ID)

const handleOpenSongInfo = () => {
  const info = currentMusicInfo.value
  if (!info || info.source != 'local') return
  localTrackActionsRef.value?.openMetadata(info, true)
}

const playTitle = computed(() => currentMusicInfo.value?.name ?? '')

const musicArtistLine = computed(() => {
  const info = currentMusicInfo.value
  if (!info) return ''
  const items = []
  if (info.singer) items.push(info.singer)
  if (info.meta?.albumName) items.push(info.meta.albumName)
  return items.join(' / ')
})

const remainingTimeStr = computed(() => `-${formatPlayTime2(Math.max(0, playProgress.maxPlayTime - playProgress.nowPlayTime))}`)
const currentTogglePlayMode = computed(() => appSetting['player.togglePlayMethod'])
const currentTogglePlayLabel = computed(() => {
  switch (currentTogglePlayMode.value) {
    case 'listLoop': return window.i18n.t('player__play_toggle_mode_list_loop')
    case 'random': return window.i18n.t('player__play_toggle_mode_random')
    case 'list': return window.i18n.t('player__play_toggle_mode_list')
    case 'singleLoop': return window.i18n.t('player__play_toggle_mode_single_loop')
    default: return window.i18n.t('player__play_toggle_mode_off')
  }
})
const currentTogglePlayIcon = computed(() => togglePlayIconMap[currentTogglePlayMode.value] ?? togglePlayIconMap.none)
const isTogglePlayActive = computed(() => currentTogglePlayMode.value != 'none')
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

.headerActions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.qualityCapsule {
  flex: none;
  min-width: 0;
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.15;
  text-transform: uppercase;
  white-space: nowrap;
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

.songInfoBtn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  &:disabled {
    opacity: .38;
    cursor: not-allowed;
  }
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
  // 与时间进度条一致的白色药丸手柄
  --slider-thumb-width: 12px;
  --slider-thumb-height: 10px;
  --slider-thumb-radius: 999px;
  --slider-thumb-color: rgba(255, 255, 255, .96);
  --slider-thumb-shadow: 0 1px 3px rgba(0, 0, 0, .22), 0 0 0 .5px rgba(0, 0, 0, .14);
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
  position: relative;
  width: min(1080px, calc(100vw - 48px));
  max-width: 100%;
  max-height: calc(100vh - 40px);
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  gap: 0;
  padding: 20px 24px 22px;
  border-radius: 28px;
  background: color-mix(in srgb, var(--shell-surface-strong, rgba(251, 253, 255, 0.92)) 72%, transparent);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 56px rgba(20, 29, 46, 0.14);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  isolation: isolate;
}

.soundHeader {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;

  strong {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -.02em;
    color: rgba(255, 255, 255, 0.96);
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
  position: relative;
  z-index: 1;
  display: flex;
  flex-flow: row nowrap;
  padding: 0;
  margin: 0;
  gap: 22px;
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
  position: relative;
  z-index: 1;
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
