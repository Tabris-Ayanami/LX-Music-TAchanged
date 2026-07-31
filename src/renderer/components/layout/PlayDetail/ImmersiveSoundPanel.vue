<template>
  <material-modal
    :show="show"
    bg-close="bg-close"
    teleport="#root"
    :close-btn="false"
    :hide-header="true"
    overlay-filter-mode="on"
    host-effect-mode="blur"
    :content-class="$style.frame"
    min-width="0"
    width="min(980px, calc(100vw - 48px))"
    max-width="calc(100vw - 48px)"
    max-height="calc(100vh - 48px)"
    @close="close"
  >
    <div :class="$style.panel">
      <header :class="$style.header">
        <div>
          <strong>{{ $t('player__sound_effect') }}</strong>
          <small>{{ $t('player__volume') }}</small>
        </div>
        <button type="button" :class="$style.close" :aria-label="$t('close')" @click="close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-close" /></svg>
        </button>
      </header>
      <div :class="$style.volumeRow">
        <button type="button" :class="$style.volumeButton" :aria-label="isMute ? 'Unmute' : 'Mute'" @click="toggleMute">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-sound-modern" /></svg>
        </button>
        <base-slider-bar :value="volume" :min="0" :max="1" :step="0.01" @change="handleUpdateVolume" />
        <span>{{ Math.round(volume * 100) }}%</span>
      </div>
      <div :class="[$style.columns, 'scroll']">
        <div :class="$style.column">
          <AudioConvolution />
          <PitchShifter />
          <AudioPanner />
        </div>
        <div :class="$style.column">
          <BiquadFilter />
        </div>
      </div>
    </div>
  </material-modal>
</template>

<script setup>
import AudioConvolution from '@renderer/components/common/SoundEffectBtn/AudioConvolution.vue'
import AudioPanner from '@renderer/components/common/SoundEffectBtn/AudioPanner.vue'
import BiquadFilter from '@renderer/components/common/SoundEffectBtn/BiquadFilter.vue'
import PitchShifter from '@renderer/components/common/SoundEffectBtn/PitchShifter.vue'
import { isMute, volume } from '@renderer/store/player/volume'
import { saveVolumeIsMute } from '@renderer/store/setting'

defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:show'])
const close = () => { emit('update:show', false) }
const toggleMute = () => { saveVolumeIsMute(!isMute.value) }
const handleUpdateVolume = value => { window.app_event.setVolume(value) }
</script>

<style lang="less" module>
.frame {
  width: min(980px, calc(100vw - 48px)) !important;
  max-width: calc(100vw - 48px) !important;
  max-height: calc(100vh - 48px) !important;
  min-width: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 24px !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: auto !important;
}

.panel {
  --color-font: rgba(255, 255, 255, .92);
  --color-font-label: rgba(255, 255, 255, .62);
  --color-divider: rgba(255, 255, 255, .14);
  --color-content-background: rgba(255, 255, 255, .06);
  --color-button-background: rgba(255, 255, 255, .1);
  --color-button-background-hover: rgba(255, 255, 255, .16);
  --color-primary: rgb(142, 193, 255);
  --color-primary-font: rgb(190, 218, 255);
  --slider-track-color: rgba(255, 255, 255, .18);
  --slider-fill-color: rgba(205, 225, 255, .9);
  position: relative;
  width: 100%;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  padding: 20px 24px 24px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 24px;
  color: rgba(255, 255, 255, .92);
  background: rgba(14, 18, 28, .97);
  box-shadow: 0 24px 64px rgba(0, 0, 0, .42);
  backdrop-filter: blur(24px) saturate(128%);
  -webkit-backdrop-filter: blur(24px) saturate(128%);
  overflow: auto;
  isolation: isolate;
}

.panel :global(*) {
  box-sizing: border-box;
}

.header,
.volumeRow,
.columns {
  position: relative;
  z-index: 1;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;

  strong,
  small {
    display: block;
  }

  strong {
    font-size: 18px;
  }

  small {
    margin-top: 4px;
    color: rgba(255, 255, 255, .58);
    font-size: 12px;
  }
}

.close {
  width: 30px;
  height: 30px;
  padding: 7px;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, .68);
  background: rgba(255, 255, 255, .08);
  cursor: pointer;

  &:hover {
    color: white;
    background: rgba(255, 255, 255, .16);
  }

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}

.volumeRow {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  color: rgba(255, 255, 255, .74);
  font-size: 12px;
}

.volumeButton {
  width: 30px;
  height: 30px;
  padding: 6px;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, .76);
  background: rgba(255, 255, 255, .08);
  cursor: pointer;

  &:hover {
    color: white;
    background: rgba(255, 255, 255, .15);
  }

  svg {
    width: 100%;
    height: 100%;
  }
}

.columns {
  display: flex;
  gap: 22px;
  max-height: calc(100vh - 160px);
  overflow: hidden auto;
  color: rgba(232, 237, 246, .9);
}

.column {
  flex: 1 1 0;
  min-width: 0;
  padding: 0 12px;
}

.column + .column {
  border-left: 1px dashed rgba(255, 255, 255, .18);
}

.columns :global(.player__sound_effect_title) {
  color: rgba(255, 255, 255, .9);
}

.columns :global(.base-checkbox-label) {
  color: rgba(232, 237, 246, .86);
}

.columns :global(.base-btn) {
  --color-button-font: rgba(241, 245, 252, .92);
  --color-button-background: rgba(255, 255, 255, .1);
  --color-button-background-hover: rgba(255, 255, 255, .17);
}

@media (max-width: 760px) {
  .frame {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
  }

  .panel {
    padding: 16px;
  }

  .columns {
    flex-direction: column;
  }

  .column {
    width: 100%;
    padding: 0;
  }

  .column + .column {
    padding-top: 16px;
    border-top: 1px dashed rgba(255, 255, 255, .18);
    border-left: 0;
  }
}
</style>
