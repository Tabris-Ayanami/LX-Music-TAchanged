<template>
  <material-popup-btn :class="$style.btnContent" :popup-class="$style.popupShell" :list-class="$style.popupShellList" no-arrow>
    <button :class="[$style.btn, { [$style.active]: playbackRate != 1 }]" :aria-label="`${$t('player__playback_rate')}${playbackRate}x`">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-plex" />
      </svg>
    </button>
    <template #content>
      <div :class="$style.setting">
        <div :class="$style.topRow">
          <span :class="$style.rate">{{ playbackRate.toFixed(2) }}x</span>
          <base-btn min @click="handleUpdatePlaybackRate(100)">{{ $t('player__playback_rate_reset_btn') }}</base-btn>
        </div>
        <base-checkbox
          id="player__playback_preserves_pitch"
          :class="$style.checkbox"
          :model-value="appSetting['player.preservesPitch']"
          :label="$t('player__playback_preserves_pitch')"
          @update:model-value="updatePreservesPitch"
        />
        <base-slider-bar :class="$style.slider" :value="playbackRate * 100" :min="50" :max="200" @change="handleUpdatePlaybackRate" />
      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { playbackRate } from '@renderer/store/player/playbackRate'
import { appSetting, updateSetting } from '@renderer/store/setting'

const handleUpdatePlaybackRate = val => {
  window.app_event.setPlaybackRate(Math.round(val) / 100)
}

const updatePreservesPitch = enabled => {
  updateSetting({ 'player.preservesPitch': enabled })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btnContent {
  flex: none;
  height: var(--detail-side-control-size, 24px);
  display: flex;
  align-items: center;
}

.btn {
  position: relative;
  justify-content: center;
  align-items: center;
  transition: color @transition-normal;
  cursor: pointer;
  background-color: transparent;
  border: none;
  width: var(--detail-side-control-size, 24px);
  height: var(--detail-side-control-size, 24px);
  display: flex;
  flex-flow: column nowrap;
  padding: 0;

  svg {
    transition: opacity @transition-fast;
    width: 92%;
    height: 92%;
    opacity: .76;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.22));
  }

  &:hover {
    svg {
      opacity: .9;
    }
  }

  &:active {
    svg {
      opacity: 1;
    }
  }

  &.active {
    svg {
      color: var(--color-primary);
      opacity: .8;
    }
  }
}

.popupShell {
  border-radius: 18px;
  background: rgba(244, 247, 253, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 40px rgba(20, 29, 46, 0.18);
  backdrop-filter: blur(24px) saturate(152%);
  -webkit-backdrop-filter: blur(24px) saturate(152%);
  filter: none;
}

.popupShellList {
  padding: 0;
}

.setting {
  --popup-accent: var(--shell-accent, var(--color-primary));
  --color-primary: var(--popup-accent);
  --color-primary-font: color-mix(in srgb, var(--popup-accent) 86%, white 14%);
  --color-font-label: color-mix(in srgb, var(--popup-accent) 34%, rgba(84, 97, 118, 0.82));
  --color-button-font: color-mix(in srgb, var(--popup-accent) 86%, white 14%);
  --color-button-background: color-mix(in srgb, var(--popup-accent) 14%, transparent);
  --color-button-background-hover: color-mix(in srgb, var(--popup-accent) 20%, transparent);
  --color-button-background-active: color-mix(in srgb, var(--popup-accent) 26%, transparent);
  --slider-track-color: color-mix(in srgb, var(--popup-accent) 18%, white 82%);
  --slider-fill-color: color-mix(in srgb, var(--popup-accent) 74%, white 26%);
  width: min(228px, calc(100vw - 32px));
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;
  padding: 14px 16px 16px;
}

.topRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  :global(.base-btn) {
    border-radius: 10px;
  }
}

.rate {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  color: rgba(31, 39, 52, 0.95);
}

.checkbox {
  :global(.base-checkbox-label) {
    color: rgba(31, 39, 52, 0.92);
    font-size: 13px;
    font-weight: 700;
  }
}

.slider {
  width: 100%;
}
</style>
