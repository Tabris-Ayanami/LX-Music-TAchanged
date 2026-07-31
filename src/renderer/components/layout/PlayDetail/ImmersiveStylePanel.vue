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
    width="min(820px, calc(100vw - 48px))"
    max-width="calc(100vw - 48px)"
    max-height="calc(100vh - 48px)"
    @close="close"
  >
    <div :class="$style.panel">
      <header :class="$style.header">
        <div>
          <strong>{{ $t('setting__play_detail_immersive_settings') }}</strong>
          <small>{{ $t('setting__play_detail_immersive_settings_tip') }}</small>
        </div>
        <button type="button" :class="$style.close" :aria-label="$t('close')" @click="close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-close" /></svg>
        </button>
      </header>

      <div :class="$style.tabs" role="tablist" :aria-label="$t('setting__play_detail_immersive_settings')">
        <button
          v-for="tab in tabs"
          :id="`immersive-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          :class="{ [$style.active]: activeTab == tab.id }"
          :aria-selected="activeTab == tab.id"
          :aria-controls="`immersive-panel-${tab.id}`"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
        </button>
      </div>

      <section
        v-show="activeTab == 'lyrics'"
        id="immersive-panel-lyrics"
        :class="$style.tabPanel"
        role="tabpanel"
        aria-labelledby="immersive-tab-lyrics"
      >
        <p :class="$style.panelTip">{{ $t('setting__play_detail_immersive_effect_tip') }}</p>
        <div :class="$style.lyricStyleGrid">
          <button
            v-for="item in lyricStyleOptions"
            :key="item.id"
            type="button"
            :class="[$style.effectCard, { [$style.active]: appSetting['playDetail.immersiveEffect'] == item.id }]"
            :aria-pressed="appSetting['playDetail.immersiveEffect'] == item.id"
            @click="updateSetting({ 'playDetail.immersiveEffect': item.id })"
          >
            <span :class="[$style.effectPreview, $style[`effectPreview-${item.id}`]]" aria-hidden="true">
              <i>{{ item.name }}</i>
            </span>
            <span :class="$style.effectBody">
              <strong>{{ item.name }}</strong>
              <small>{{ item.description }}</small>
            </span>
          </button>
        </div>

      </section>

      <section
        v-show="activeTab == 'visualizer'"
        id="immersive-panel-visualizer"
        :class="$style.tabPanel"
        role="tabpanel"
        aria-labelledby="immersive-tab-visualizer"
      >
        <div :class="$style.visualizerSection">
          <div :class="$style.visualizerHeader">
            <div>
              <strong>{{ $t('setting__play_detail_immersive_audio_visualization') }}</strong>
              <small>{{ $t('setting__play_detail_immersive_audio_visualization_tip') }}</small>
            </div>
            <base-checkbox
              id="immersive_audio_visualization_toggle"
              :model-value="appSetting['playDetail.immersiveAudioVisualization']"
              :aria-label="$t('setting__play_detail_immersive_audio_visualization')"
              @update:model-value="updateSetting({ 'playDetail.immersiveAudioVisualization': $event })"
            />
          </div>
          <h3 :class="$style.sectionTitle">{{ $t('setting__play_detail_immersive_audio_visualization_style') }}</h3>
          <div :class="$style.visualizerFamilies">
            <button
              v-for="item in visualizerFamilies"
              :key="item.id"
              type="button"
              :class="[$style.visualizerFamily, { [$style.active]: currentVisualizerFamily == item.id }]"
              :aria-pressed="currentVisualizerFamily == item.id"
              @click="selectVisualizerFamily(item.id)"
            >
              <span :class="[$style.familyPreview, $style[`familyPreview-${item.id}`]]" aria-hidden="true">
                <i v-for="index in item.id == 'wave' ? 15 : 1" :key="index" />
              </span>
              <span>
                <strong>{{ item.name }}</strong>
                <small>{{ item.description }}</small>
              </span>
            </button>
          </div>

          <template v-if="currentVisualizerFamily == 'wave'">
            <h3 :class="$style.sectionTitle">{{ $t('setting__play_detail_immersive_audio_visualization_wave_style') }}</h3>
            <div :class="$style.visualizerOptions">
              <button
                v-for="item in waveStyleOptions"
                :key="item.id"
                type="button"
                :class="[$style.visualizerOption, { [$style.active]: appSetting['playDetail.immersiveAudioVisualizationStyle'] == item.id }]"
                :aria-pressed="appSetting['playDetail.immersiveAudioVisualizationStyle'] == item.id"
                @click="selectWaveStyle(item.id)"
              >
                <span :class="[$style.wavePreview, $style[`wavePreview-${item.id}`]]" aria-hidden="true">
                  <i v-for="index in 17" :key="index" />
                </span>
                <span>
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.description }}</small>
                </span>
              </button>
            </div>
          </template>
          <div v-if="currentVisualizerFamily == 'wave'" :class="$style.rangeControl">
            <label for="immersive_visualizer_height">
              {{ $t('setting__play_detail_immersive_audio_visualization_height', { value: appSetting['playDetail.immersiveAudioVisualizationHeight'] }) }}
            </label>
            <base-slider-bar
              id="immersive_visualizer_height"
              :value="appSetting['playDetail.immersiveAudioVisualizationHeight']"
              :min="48"
              :max="220"
              :step="4"
              @change="updateSetting({ 'playDetail.immersiveAudioVisualizationHeight': $event })"
            />
          </div>
        </div>
      </section>

      <section
        v-show="activeTab == 'background'"
        id="immersive-panel-background"
        :class="$style.tabPanel"
        role="tabpanel"
        aria-labelledby="immersive-tab-background"
      >
        <p :class="$style.panelTip">{{ $t('setting__play_detail_immersive_background_tip') }}</p>
        <div :class="$style.backgroundOptions">
          <button
            v-for="item in backgroundOptions"
            :key="item.id"
            type="button"
            :class="[$style.backgroundOption, { [$style.active]: appSetting['playDetail.immersiveBackground'] == item.id }]"
            :aria-pressed="appSetting['playDetail.immersiveBackground'] == item.id"
            @click="updateSetting({ 'playDetail.immersiveBackground': item.id })"
          >
            <span :class="[$style.backgroundPreview, $style[`backgroundPreview-${item.id}`]]" aria-hidden="true">
              <i />
            </span>
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.description }}</small>
            </span>
          </button>
        </div>
        <div v-if="appSetting['playDetail.immersiveBackground'] == 'blur'" :class="$style.rangeControl">
          <label for="immersive_background_blur">
            {{ $t('setting__play_detail_immersive_background_blur_amount', { value: appSetting['playDetail.immersiveBackgroundBlur'] }) }}
          </label>
          <base-slider-bar
            id="immersive_background_blur"
            :value="appSetting['playDetail.immersiveBackgroundBlur']"
            :min="8"
            :max="64"
            :step="2"
            @change="updateSetting({ 'playDetail.immersiveBackgroundBlur': $event })"
          />
        </div>
      </section>
    </div>
  </material-modal>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getImmersiveEffectOptions } from './immersiveEffects'

defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:show'])
const close = () => { emit('update:show', false) }
const activeTab = ref('lyrics')
const tabs = [
  { id: 'lyrics', name: window.i18n.t('setting__play_detail_immersive_tab_lyrics') },
  { id: 'visualizer', name: window.i18n.t('setting__play_detail_immersive_tab_visualizer') },
  { id: 'background', name: window.i18n.t('setting__play_detail_immersive_tab_background') },
]
const lyricStyleOptions = getImmersiveEffectOptions(key => window.i18n.t(key))
const visualizerFamilies = [
  {
    id: 'wave',
    name: window.i18n.t('setting__play_detail_immersive_audio_visualization_family_wave'),
    description: window.i18n.t('setting__play_detail_immersive_audio_visualization_family_wave_desc'),
  },
  {
    id: 'ambient',
    name: window.i18n.t('setting__play_detail_immersive_audio_visualization_family_ambient'),
    description: window.i18n.t('setting__play_detail_immersive_audio_visualization_family_ambient_desc'),
  },
]
const waveStyleOptions = [
  {
    id: 'wave',
    name: window.i18n.t('setting__play_detail_immersive_audio_visualization_wave'),
    description: window.i18n.t('setting__play_detail_immersive_audio_visualization_wave_desc'),
  },
  {
    id: 'bars',
    name: window.i18n.t('setting__play_detail_immersive_audio_visualization_bars'),
    description: window.i18n.t('setting__play_detail_immersive_audio_visualization_bars_desc'),
  },
]
const lastWaveStyle = ref(appSetting['playDetail.immersiveAudioVisualizationStyle'] == 'bars' ? 'bars' : 'wave')
const currentVisualizerFamily = computed(() => (
  appSetting['playDetail.immersiveAudioVisualizationStyle'] == 'ambient' ? 'ambient' : 'wave'
))
const selectVisualizerFamily = id => {
  updateSetting({
    'playDetail.immersiveAudioVisualizationStyle': id == 'ambient' ? 'ambient' : lastWaveStyle.value,
  })
}
const selectWaveStyle = id => {
  lastWaveStyle.value = id
  updateSetting({ 'playDetail.immersiveAudioVisualizationStyle': id })
}
const backgroundOptions = [
  {
    id: 'aura',
    name: window.i18n.t('setting__play_detail_background_aura'),
    description: window.i18n.t('setting__play_detail_background_aura_desc'),
  },
  {
    id: 'blur',
    name: window.i18n.t('setting__play_detail_background_blur'),
    description: window.i18n.t('setting__play_detail_background_blur_desc'),
  },
  {
    id: 'mv',
    name: window.i18n.t('setting__play_detail_background_mv'),
    description: window.i18n.t('setting__play_detail_background_mv_desc'),
  },
]
</script>

<style lang="less" module>
.frame {
  width: min(820px, calc(100vw - 48px)) !important;
  max-width: calc(100vw - 48px) !important;
  max-height: calc(100vh - 48px) !important;
  min-width: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 22px !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: auto !important;
}

.panel {
  --color-font: rgba(248, 250, 255, .96);
  --color-font-label: rgba(203, 211, 224, .72);
  --color-divider: rgba(255, 255, 255, .14);
  --slider-track-color: rgba(255, 255, 255, .18);
  --slider-fill-color: rgba(185, 215, 255, .92);
  width: 100%;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  padding: 20px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 22px;
  color: rgba(248, 250, 255, .96);
  background: rgba(15, 19, 29, .96);
  box-shadow: 0 24px 64px rgba(0, 0, 0, .46);
  backdrop-filter: blur(24px) saturate(132%);
  overflow: auto;
}

.panel,
.tabPanel {
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

.panel :global(*) {
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  strong,
  small {
    display: block;
  }

  strong {
    font-size: 17px;
  }

  small {
    max-width: 390px;
    margin-top: 4px;
    color: rgba(203, 211, 224, .72);
    font-size: 12px;
    line-height: 1.45;
  }
}

.close {
  width: 36px;
  height: 36px;
  flex: none;
  padding: 9px;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, .82);
  background: rgba(255, 255, 255, .1);
  cursor: pointer;

  &:hover {
    color: white;
    background: rgba(255, 255, 255, .18);
  }

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 16px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 13px;
  background: rgba(255, 255, 255, .045);

  button {
    min-width: 0;
    min-height: 38px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 9px;
    color: rgba(203, 211, 224, .68);
    background: transparent;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    transition: color .18s ease, border-color .18s ease, background-color .18s ease, box-shadow .18s ease;

    &:hover {
      color: rgba(248, 250, 255, .94);
      background: rgba(255, 255, 255, .055);
    }

    &.active {
      border-color: rgba(169, 207, 255, .82);
      color: #fff;
      background: rgba(169, 207, 255, .12);
      box-shadow: 0 0 0 2px rgba(169, 207, 255, .14);
    }

    &:focus-visible {
      outline: 2px solid rgba(185, 215, 255, .92);
      outline-offset: 2px;
    }
  }
}

.tabPanel {
  min-height: 300px;
  max-height: calc(100vh - 212px);
  padding: 2px 4px 6px 2px;
  overflow: auto;
}

.panelTip {
  margin: 0 0 12px;
  color: rgba(203, 211, 224, .7);
  font-size: 12px;
  line-height: 1.5;
}

.lyricStyleGrid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.effectCard {
  min-width: 0;
  padding: 0 0 8px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, .13);
  border-radius: 12px;
  color: rgba(248, 250, 255, .92);
  background: rgba(255, 255, 255, .045);
  text-align: left;
  cursor: pointer;
  transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease, transform .18s ease;

  &:hover {
    border-color: rgba(255, 255, 255, .34);
    background: rgba(255, 255, 255, .075);
    transform: translateY(-1px);
  }

  &.active {
    border-color: rgba(169, 207, 255, .84);
    background: rgba(169, 207, 255, .1);
    box-shadow: 0 0 0 2px rgba(169, 207, 255, .18);
  }

  &:focus-visible {
    outline: 2px solid rgba(185, 215, 255, .92);
    outline-offset: 3px;
  }

  strong,
  small {
    display: block;
  }

  strong {
    font-size: 12px;
  }

  small {
    display: -webkit-box;
    margin-top: 3px;
    overflow: hidden;
    color: rgba(203, 211, 224, .7);
    font-size: 10px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
}

.effectPreview {
  position: relative;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow: hidden;
  border-radius: 0;
  background:
    radial-gradient(circle at 40% 50%, rgba(126, 183, 255, .34), transparent 38%),
    linear-gradient(135deg, #253149, #11151f);

  i {
    color: rgba(255, 255, 255, .92);
    font-size: clamp(16px, 1.4vw, 22px);
    font-style: normal;
    font-weight: 750;
    text-shadow: 0 0 14px rgba(139, 194, 255, .8);
  }
}

.effectPreview-classic {
  background:
    radial-gradient(circle at 50% 50%, rgba(132, 193, 255, .46), transparent 38%),
    linear-gradient(135deg, #2b3955, #101522);
}

.effectPreview-cadenza {
  background:
    linear-gradient(155deg, transparent 48%, rgba(148, 196, 255, .3) 49%, transparent 51%),
    linear-gradient(135deg, #3d284c, #101522);
}

.effectPreview-partita {
  background:
    linear-gradient(160deg, transparent 43%, rgba(152, 255, 219, .55) 44% 45%, transparent 46%),
    linear-gradient(135deg, #233d3c, #101522);
}

.effectPreview-fume {
  background:
    radial-gradient(circle at 22% 24%, rgba(255, 194, 132, .38), transparent 24%),
    radial-gradient(circle at 78% 72%, rgba(168, 138, 255, .34), transparent 28%),
    linear-gradient(135deg, #3b2b2d, #151521);
}

.effectPreview-cappella {
  background:
    radial-gradient(circle at 20% 35%, rgba(174, 207, 255, .54) 0 7%, transparent 8%),
    radial-gradient(circle at 50% 62%, rgba(255, 180, 202, .46) 0 8%, transparent 9%),
    radial-gradient(circle at 78% 28%, rgba(182, 255, 218, .42) 0 7%, transparent 8%),
    linear-gradient(135deg, #2c3d5a, #141523);
}

.effectPreview-tilt {
  background: linear-gradient(120deg, #44344a, #111522);

  i {
    transform: rotate(-11deg) skewX(-9deg);
  }
}

.effectPreview-claddagh {
  background: radial-gradient(circle, #41516c 0 22%, #172031 23% 56%, #0e121d 57%);

  &::before,
  &::after {
    position: absolute;
    border: 1px solid rgba(184, 214, 255, .5);
    border-radius: 50%;
    content: '';
  }

  &::before { width: 52%; height: 78%; transform: rotate(28deg); }
  &::after { width: 72%; height: 36%; transform: rotate(-18deg); }
}

.effectPreview-diorama {
  background:
    linear-gradient(120deg, rgba(120, 194, 255, .22), transparent 44%),
    linear-gradient(135deg, #24364b, #0c101a);
}

.effectPreview-monet {
  background:
    radial-gradient(circle at 22% 38%, rgba(255, 174, 174, .46), transparent 24%),
    radial-gradient(circle at 72% 72%, rgba(152, 201, 255, .42), transparent 30%),
    linear-gradient(135deg, #584751, #192b3b);
}

.effectPreview-pendolo {
  background:
    radial-gradient(circle at 50% 22%, rgba(255, 216, 143, .34), transparent 31%),
    #181c29;

  &::before {
    position: absolute;
    top: -18%;
    left: 50%;
    width: 1px;
    height: 66%;
    content: '';
    background: rgba(255, 235, 186, .64);
    transform: rotate(12deg);
  }
}

.effectBody {
  display: block;
  min-width: 0;
  padding: 7px 8px 0;
}

.visualizerSection {
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 14px;
  background: rgba(255, 255, 255, .035);
}

.backgroundOptions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.backgroundOption {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: 14px;
  color: rgba(248, 250, 255, .92);
  background: rgba(255, 255, 255, .045);
  text-align: left;
  cursor: pointer;
  transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease;

  &:hover {
    border-color: rgba(255, 255, 255, .3);
    background: rgba(255, 255, 255, .075);
  }

  &.active {
    border: 2px solid rgba(169, 207, 255, .84);
    background: rgba(169, 207, 255, .1);
    box-shadow: 0 0 0 2px rgba(169, 207, 255, .18);
  }

  &:focus-visible {
    outline: 2px solid rgba(185, 215, 255, .92);
    outline-offset: 3px;
  }

  strong,
  small {
    display: block;
  }

  strong {
    margin-top: 10px;
    font-size: 13px;
  }

  small {
    margin-top: 4px;
    color: rgba(203, 211, 224, .68);
    font-size: 11px;
    line-height: 1.4;
  }
}

.backgroundPreview {
  position: relative;
  height: 112px;
  display: block;
  overflow: hidden;
  border-radius: 10px;
  background: #111722;

  i {
    position: absolute;
    inset: 0;
    display: block;
  }
}

.backgroundPreview-aura i {
  inset: -28%;
  background:
    radial-gradient(circle at 24% 28%, rgba(114, 164, 255, .72), transparent 34%),
    radial-gradient(circle at 78% 72%, rgba(187, 111, 255, .52), transparent 38%),
    linear-gradient(145deg, #1a2335, #0b0e15);
  filter: blur(14px) saturate(1.18);
  transform: rotate(-8deg) scale(1.16);
}

.backgroundPreview-blur i {
  inset: -12%;
  background:
    linear-gradient(90deg, rgba(82, 105, 139, .88), rgba(28, 33, 46, .9)),
    radial-gradient(circle at 42% 45%, #7d93b8, #111722 62%);
  filter: blur(12px) saturate(.82);
  transform: scale(1.12);
}

.backgroundPreview-mv i {
  inset: -16%;
  background:
    radial-gradient(circle at 30% 28%, rgba(249, 196, 122, .7), transparent 28%),
    linear-gradient(135deg, rgba(54, 120, 183, .9), rgba(20, 26, 39, .98) 58%, rgba(186, 72, 124, .78));
  filter: blur(8px) saturate(1.25);
  transform: scale(1.15);

  &::after {
    position: absolute;
    inset: 0;
    content: '';
    background: repeating-linear-gradient(90deg, transparent 0 12px, rgba(255, 255, 255, .1) 13px 15px);
    opacity: .7;
  }
}

.visualizerHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  strong,
  small {
    display: block;
  }

  strong {
    color: rgba(248, 250, 255, .94);
    font-size: 14px;
  }

  small {
    margin-top: 4px;
    color: rgba(203, 211, 224, .68);
    font-size: 11px;
    line-height: 1.4;
  }
}

.visualizerFamilies {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.visualizerFamily {
  min-width: 0;
  padding: 9px;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: 13px;
  color: rgba(248, 250, 255, .92);
  background: rgba(255, 255, 255, .045);
  text-align: left;
  cursor: pointer;
  transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease;

  &:hover {
    border-color: rgba(255, 255, 255, .3);
    background: rgba(255, 255, 255, .075);
  }

  &.active {
    border: 2px solid rgba(169, 207, 255, .84);
    background: rgba(169, 207, 255, .1);
    box-shadow: 0 0 0 2px rgba(169, 207, 255, .18);
  }

  &:focus-visible {
    outline: 2px solid rgba(185, 215, 255, .92);
    outline-offset: 3px;
  }

  strong,
  small {
    display: block;
  }

  strong {
    margin-top: 8px;
    font-size: 13px;
  }

  small {
    margin-top: 4px;
    color: rgba(203, 211, 224, .68);
    font-size: 11px;
    line-height: 1.4;
  }
}

.familyPreview {
  position: relative;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  overflow: hidden;
  border-radius: 9px;
  background: linear-gradient(155deg, rgba(35, 44, 64, .8), rgba(10, 13, 21, .96));
}

.familyPreview-wave {
  i {
    width: 3px;
    height: 35px;
    border-radius: 99px;
    background: rgba(185, 215, 255, .9);
    box-shadow: 0 0 8px rgba(145, 197, 255, .48);
  }

  i:nth-child(3n + 1) { transform: scaleY(.28); }
  i:nth-child(4n + 2) { transform: scaleY(.58); }
  i:nth-child(5n + 3) { transform: scaleY(.92); }
  i:nth-child(6n + 4) { transform: scaleY(.42); }
}

.familyPreview-ambient {
  &::before {
    position: absolute;
    inset: 5px;
    padding: 5px;
    border-radius: 7px;
    content: '';
    background: conic-gradient(from 24deg, #ff648f, #8b7cff, #4bc8ff, #52efb3, #ffd268, #ff648f);
    filter: drop-shadow(0 0 7px rgba(105, 174, 255, .66));
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }

  i {
    width: 58%;
    height: 34%;
    border-radius: 50%;
    background: rgba(126, 171, 255, .12);
    filter: blur(9px);
  }
}

.visualizerOptions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.visualizerOption {
  min-width: 0;
  display: block;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: 12px;
  color: rgba(248, 250, 255, .92);
  background: rgba(255, 255, 255, .05);
  text-align: left;
  cursor: pointer;

  &.active {
    border: 2px solid rgba(169, 207, 255, .84);
    box-shadow: 0 0 0 2px rgba(169, 207, 255, .18);
    background: rgba(169, 207, 255, .1);
  }

  strong,
  small {
    display: block;
  }

  strong {
    font-size: 13px;
  }

  small {
    margin-top: 4px;
    color: rgba(203, 211, 224, .68);
    font-size: 11px;
    line-height: 1.4;
  }
}

.wavePreview {
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  overflow: hidden;
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(35, 44, 64, .72), rgba(13, 17, 26, .9));

  i {
    width: 3px;
    height: 28px;
    border-radius: 99px;
    background: rgba(185, 215, 255, .88);
    box-shadow: 0 0 8px rgba(145, 197, 255, .42);
  }

  i:nth-child(3n + 1) { transform: scaleY(.34); }
  i:nth-child(4n + 2) { transform: scaleY(.62); }
  i:nth-child(5n + 3) { transform: scaleY(.9); }
  i:nth-child(6n + 4) { transform: scaleY(.48); }
}

.wavePreview-wave {
  i:nth-child(1),
  i:nth-child(17) { transform: scaleY(.12); }
  i:nth-child(2),
  i:nth-child(16) { transform: scaleY(.26); }
  i:nth-child(3),
  i:nth-child(15) { transform: scaleY(.48); }
  i:nth-child(4),
  i:nth-child(14) { transform: scaleY(.72); }
  i:nth-child(5),
  i:nth-child(13) { transform: scaleY(.42); }
}

.wavePreview-bars {
  align-items: flex-end;
  padding-bottom: 8px;
  background:
    linear-gradient(rgba(255, 255, 255, .055) 1px, transparent 1px) 0 0 / 100% 12px,
    linear-gradient(180deg, rgba(35, 44, 64, .72), rgba(13, 17, 26, .9));

  i {
    width: 4px;
    transform-origin: bottom;
    border-radius: 2px 2px 0 0;
  }

  i:nth-child(3n + 1) { transform: scaleY(.32); }
  i:nth-child(4n + 2) { transform: scaleY(.64); }
  i:nth-child(5n + 3) { transform: scaleY(.94); }
  i:nth-child(6n + 4) { transform: scaleY(.5); }
}

.sectionTitle {
  margin: 18px 0 10px;
  color: rgba(238, 243, 251, .88);
  font-size: 13px;
  font-weight: 650;
}

.rangeControl {
  display: block;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 12px;
  background: rgba(255, 255, 255, .035);
  color: rgba(222, 228, 238, .82);
  font-size: 12px;

  label {
    display: block;
    margin-bottom: 8px;
  }
}

.rangeControl :global(.base-slider-bar) {
  width: 100%;
}

@media (max-width: 760px) {
  .lyricStyleGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

}

@media (max-width: 620px) {
  .frame {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
  }

  .panel {
    padding: 16px;
  }

  .effectCard,
  .backgroundOptions,
  .visualizerFamilies,
  .visualizerOptions {
    grid-template-columns: 1fr;
  }

  .lyricStyleGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 380px) {
  .lyricStyleGrid {
    grid-template-columns: 1fr;
  }
}
</style>
