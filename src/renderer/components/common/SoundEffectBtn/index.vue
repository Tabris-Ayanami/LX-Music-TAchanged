<template>
  <button :class="$style.btn" :aria-label="$t('player__sound_effect')" @click="visible = true">
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="90%" viewBox="0 0 24 24" space="preserve">
      <use xlink:href="#icon-sliders-modern" />
    </svg>
  </button>
  <material-modal
    :show="visible"
    bg-close="bg-close"
    :teleport="teleport"
    :close-btn="false"
    :hide-header="true"
    overlay-filter-mode="off"
    :content-class="$style.modalFrame"
    min-width="0"
    width="min(960px, calc(100vw - 36px))"
    max-width="calc(100vw - 36px)"
    max-height="calc(100vh - 40px)"
    @close="visible = false"
  >
    <div :class="$style.main">
      <div :class="$style.modalHeader">
        <h2 :class="$style.title">{{ $t('player__sound_effect') }}</h2>
        <button type="button" :class="$style.closeBtn" :aria-label="$t('close')" @click="visible = false">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-close" />
          </svg>
        </button>
      </div>
      <div :class="$style.content">
        <div :class="['scroll', $style.row]">
          <AudioConvolution />
          <PitchShifter />
          <AudioPanner />
        </div>
        <div :class="['scroll', $style.row]">
          <BiquadFilter />
        </div>
      </div>
      <p v-if="showTip" :class="$style.tip">{{ $t('player__sound_effect_features_tip') }}</p>
    </div>
  </material-modal>
</template>

<script setup>
import { ref, watch } from '@common/utils/vueTools'
import BiquadFilter from './BiquadFilter.vue'
import AudioPanner from './AudioPanner.vue'
import AudioConvolution from './AudioConvolution.vue'
import PitchShifter from './PitchShifter.vue'
import { appSetting } from '@renderer/store/setting'

defineProps({
  teleport: {
    type: String,
    default: '#root',
  },
})

const visible = ref(false)
const showTip = ref(false)

watch(visible, visible => {
  if (visible) showTip.value = appSetting['player.mediaDeviceId'] != 'default'
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

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
    opacity: .8;
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
}

.modalFrame {
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.main {
  width: min(960px, calc(100vw - 36px));
  max-width: 100%;
  max-height: calc(100vh - 40px);
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  gap: 16px;
  padding: 18px 20px 20px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.58);
  background: rgba(244, 248, 255, 0.76);
  box-shadow: 0 28px 70px rgba(20, 29, 46, 0.22);
  backdrop-filter: blur(28px) saturate(148%);
  -webkit-backdrop-filter: blur(28px) saturate(148%);
  color: rgba(31, 38, 49, 0.94);
  overflow: hidden;
}

.modalHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.title {
  margin: 0;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -.02em;
}

.closeBtn {
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

.content {
  display: flex;
  flex-flow: row nowrap;
  gap: 18px;
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

.row {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  display: flex;
  gap: 16px;
  flex-flow: column nowrap;
  padding: 0 10px;
  box-sizing: border-box;
}

.tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(70, 79, 91, 0.78);
}

@media (max-width: 920px) {
  .main {
    width: calc(100vw - 24px);
    padding: 16px;
  }

  .content {
    flex-direction: column;

    &:before {
      display: none;
    }
  }

  .row {
    width: 100%;
    padding: 0;
  }
}
</style>
