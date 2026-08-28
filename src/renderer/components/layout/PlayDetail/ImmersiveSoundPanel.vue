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
    <div :class="$style.rack">
      <span v-for="pos in screwPositions" :key="pos" :class="[$style.screw, $style[pos]]" aria-hidden="true" />
      <header :class="$style.header">
        <div :class="$style.titles">
          <span :class="$style.decoTitle" aria-hidden="true">Analog Master Suite</span>
          <strong :class="$style.title">{{ $t('player__sound_effect') }}</strong>
        </div>
        <button type="button" :class="$style.close" :aria-label="$t('close')" @click="close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-close" /></svg>
        </button>
      </header>

      <div :class="[$style.card, $style.masterRow]">
        <span :class="$style.masterLabel">{{ $t('player__volume') }}</span>
        <button type="button" :class="[$style.muteBtn, { [$style.muted]: isMute }]" :aria-label="isMute ? 'Unmute' : 'Mute'" @click="toggleMute">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-sound-modern" /></svg>
        </button>
        <RackFader direction="horizontal" :value="volume" :min="0" :max="1" :step="0.01" :aria-label="$t('player__volume')" @change="handleUpdateVolume" />
        <span :class="$style.lcd">{{ Math.round(volume * 100) }}%</span>
      </div>

      <div :class="$style.rackBody">
        <nav :class="$style.moduleNav" role="tablist" :aria-label="$t('player__sound_effect')" @keydown="handleNavKeyDown">
          <button
            v-for="(item, index) in modules"
            :key="item.id"
            :ref="el => { tabRefs[index] = el }"
            type="button"
            role="tab"
            :aria-selected="activeModule === item.id"
            :tabindex="activeModule === item.id ? 0 : -1"
            :class="[$style.moduleTab, { [$style.moduleTabActive]: activeModule === item.id }]"
            @click="activeModule = item.id"
          >
            <span :class="$style.moduleDeco" aria-hidden="true">{{ item.deco }}</span>
            <span :class="$style.moduleName">{{ $t(item.labelKey) }}</span>
          </button>
        </nav>
        <section :class="[$style.moduleView, 'scroll']" role="tabpanel" :aria-label="$t(activeModuleMeta.labelKey)">
          <BiquadFilter v-if="activeModule === 'eq'" />
          <div v-else-if="activeModule === 'fx'" :class="$style.fxView">
            <div :class="$style.card">
              <div :class="$style.cardHead">
                <h3 :class="$style.cardTitle">{{ $t('player__playback_rate') }}</h3>
                <RackEngravedBtn @click="handleUpdatePlaybackRate(100)">{{ $t('player__playback_rate_reset_btn') }}</RackEngravedBtn>
              </div>
              <div :class="$style.playbackControls">
                <RackFader direction="horizontal" :class="$style.rateFader" :value="playbackRate * 100" :min="50" :max="200" :aria-label="$t('player__playback_rate')" @change="handleUpdatePlaybackRate" />
                <span :class="$style.lcd">{{ playbackRate.toFixed(2) }}x</span>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="appSetting['player.preservesPitch']"
                  :class="[$style.switchBtn, { [$style.switchOn]: appSetting['player.preservesPitch'] }]"
                  @click="updatePreservesPitch(!appSetting['player.preservesPitch'])"
                >
                  <span :class="$style.led" aria-hidden="true" />
                  {{ $t('player__playback_preserves_pitch') }}
                </button>
              </div>
            </div>
            <PitchShifter />
            <AudioConvolution />
          </div>
          <AudioPanner v-else />
        </section>
      </div>

      <footer :class="$style.statusBar" aria-hidden="true">
        <span>VOL {{ Math.round(volume * 100) }}%</span>
        <span>RATE {{ playbackRate.toFixed(2) }}X</span>
        <span>REV {{ reverbOn ? 'ON' : 'OFF' }}</span>
        <span>3D {{ pannerOn ? 'ON' : 'OFF' }}</span>
      </footer>
    </div>
  </material-modal>
</template>

<script setup>
import { computed, nextTick, ref } from '@common/utils/vueTools'
import AudioConvolution from '@renderer/components/common/SoundEffectBtn/AudioConvolution.vue'
import AudioPanner from '@renderer/components/common/SoundEffectBtn/AudioPanner.vue'
import BiquadFilter from '@renderer/components/common/SoundEffectBtn/BiquadFilter.vue'
import PitchShifter from '@renderer/components/common/SoundEffectBtn/PitchShifter.vue'
import RackEngravedBtn from '@renderer/components/common/SoundEffectBtn/RackEngravedBtn.vue'
import RackFader from '@renderer/components/common/SoundEffectBtn/RackFader.vue'
import { playbackRate } from '@renderer/store/player/playbackRate'
import { isMute, volume } from '@renderer/store/player/volume'
import { appSetting, saveVolumeIsMute, updateSetting } from '@renderer/store/setting'

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
const handleUpdatePlaybackRate = value => { window.app_event.setPlaybackRate(Math.round(value) / 100) }
const updatePreservesPitch = enabled => { updateSetting({ 'player.preservesPitch': enabled }) }

const reverbOn = computed(() => !!appSetting['player.soundEffect.convolution.fileName'])
const pannerOn = computed(() => appSetting['player.soundEffect.panner.enable'])

const screwPositions = ['screw_tl', 'screw_tr', 'screw_bl', 'screw_br']

const modules = [
  { id: 'eq', deco: 'EQ', labelKey: 'player__sound_effect_biquad_filter' },
  { id: 'fx', deco: 'FX', labelKey: 'player__sound_effect_module_effects' },
  { id: 'spatial', deco: '3D', labelKey: 'player__sound_effect_module_spatial' },
]
const activeModule = ref('eq')
const activeModuleMeta = computed(() => modules.find(m => m.id === activeModule.value))
const tabRefs = ref([])

const handleNavKeyDown = event => {
  const ids = modules.map(m => m.id)
  const index = ids.indexOf(activeModule.value)
  let nextIndex
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = (index + 1) % ids.length
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = (index - 1 + ids.length) % ids.length
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = ids.length - 1
      break
    default:
      return
  }
  event.preventDefault()
  activeModule.value = ids[nextIndex]
  void nextTick(() => {
    tabRefs.value[nextIndex]?.focus()
  })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@monoFont: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;

.frame {
  width: min(980px, calc(100vw - 48px)) !important;
  max-width: calc(100vw - 48px) !important;
  max-height: calc(100vh - 48px) !important;
  min-width: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 18px !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: auto !important;
}

.rack {
  position: relative;
  width: 100%;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;
  padding: 20px 24px 10px;
  border: 1px solid var(--shell-elevated-border);
  border-radius: 18px;
  color: var(--shell-text);
  background:
    linear-gradient(180deg, var(--shell-edge-light), transparent 18%),
    var(--shell-modal);
  box-shadow: var(--shell-elevated-shadow);
  overflow: hidden auto;
  font-size: 13px;
}

.rack :global(*) {
  box-sizing: border-box;
}

.screw {
  position: absolute;
  z-index: 2;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, var(--shell-edge-light), var(--shell-button-bg) 60%, var(--shell-edge-shadow));
  box-shadow: inset 0 0 0 1px var(--shell-control-border);

  &::after {
    position: absolute;
    left: 50%;
    top: 1px;
    bottom: 1px;
    width: 1px;
    content: '';
    background: var(--shell-edge-shadow);
    transform: translateX(-50%) rotate(45deg);
  }
}

.screw_tl { top: 8px; left: 8px; }
.screw_tr { top: 8px; right: 8px; }
.screw_bl { bottom: 8px; left: 8px; }
.screw_br { bottom: 8px; right: 8px; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 0 12px;
}

.titles {
  min-width: 0;
}

.decoTitle {
  display: block;
  color: var(--shell-muted);
  font-family: @monoFont;
  font-size: 10px;
  letter-spacing: .3em;
  text-transform: uppercase;
}

.title {
  display: block;
  margin-top: 2px;
  font-size: 17px;
  .mixin-ellipsis-1();
}

.close {
  flex: none;
  width: 30px;
  height: 30px;
  padding: 7px;
  border: 1px solid var(--shell-control-border);
  border-radius: 50%;
  color: var(--shell-muted);
  background: var(--shell-control);
  cursor: pointer;
  transition: color @transition-fast, background-color @transition-fast;

  &:hover {
    color: var(--shell-text);
    background: var(--shell-list-hover);
  }

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}

.card {
  border: 1px solid var(--shell-divider);
  border-radius: 12px;
  background: var(--shell-surface-strong);
  box-shadow: inset 0 1px 0 var(--shell-edge-light), inset 0 1px 4px var(--shell-edge-shadow);
  padding: 12px 14px;
}

.masterRow {
  display: grid;
  grid-template-columns: auto 32px minmax(0, 1fr) 56px;
  align-items: center;
  gap: 12px;
}

.masterLabel {
  color: var(--shell-muted);
  font-size: 12px;
  white-space: nowrap;
}

.muteBtn {
  width: 32px;
  height: 32px;
  padding: 6px;
  border: 1px solid var(--shell-control-border);
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--shell-control);
  cursor: pointer;
  transition: color @transition-fast, background-color @transition-fast;

  &:hover {
    background: var(--shell-list-hover);
  }

  &.muted {
    color: var(--shell-muted);
  }

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}

.lcd {
  flex: none;
  min-width: 40px;
  padding: 2px 6px;
  border: 1px solid var(--shell-divider);
  border-radius: 4px;
  background:
    repeating-linear-gradient(0deg, rgba(70, 90, 60, .06) 0 1px, transparent 1px 3px),
    linear-gradient(180deg, color-mix(in srgb, #e6ecdd 92%, var(--color-primary) 8%), color-mix(in srgb, #c9d4bd 90%, var(--color-primary) 10%));
  box-shadow: inset 0 1px 2px rgba(60, 80, 50, .28), inset 0 -1px 0 rgba(255, 255, 255, .45), 0 1px 0 var(--shell-edge-light);
  color: color-mix(in srgb, #2e3d28 82%, var(--color-primary) 18%);
  text-shadow: 0 1px 0 rgba(255, 255, 255, .5);
  font-family: @monoFont;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .03em;
  text-align: center;
  white-space: nowrap;

  :global(.themeShellDark) & {
    background:
      repeating-linear-gradient(0deg, color-mix(in srgb, var(--color-primary) 7%, transparent) 0 1px, transparent 1px 3px),
      linear-gradient(180deg, #10160f, #0a0e09);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, .8), inset 0 -1px 0 rgba(255, 255, 255, .08), 0 1px 0 var(--shell-edge-light);
    color: color-mix(in srgb, var(--color-primary) 62%, #e8f0dd 38%);
    text-shadow: 0 0 6px color-mix(in srgb, var(--color-primary) 45%, transparent);
  }
}

.rackBody {
  display: flex;
  gap: 14px;
  min-height: 0;
  flex: auto;
}

.moduleNav {
  flex: none;
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  width: 96px;
}

.moduleTab {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 10px 10px 16px;
  border: 1px solid var(--shell-divider);
  border-radius: 10px;
  background: var(--shell-surface-soft);
  color: var(--shell-muted);
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition: color @transition-fast, background-color @transition-fast, border-color @transition-fast;

  &:hover {
    color: var(--shell-text);
    background: var(--shell-list-hover);
  }

  &::before {
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    content: '';
    background: transparent;
    transition: background-color @transition-fast, box-shadow @transition-fast;
  }
}

.moduleTabActive {
  color: var(--shell-text);
  background: var(--shell-list-active);
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--shell-divider));

  &::before {
    background: var(--color-primary);
    box-shadow: 0 0 8px color-mix(in srgb, var(--color-primary) 60%, transparent);
  }
}

.moduleDeco {
  font-family: @monoFont;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: .18em;
  line-height: 1;
}

.moduleName {
  max-width: 100%;
  font-size: 11px;
  .mixin-ellipsis-1();
}

.moduleView {
  flex: auto;
  min-width: 0;
  min-height: 0;
  padding: 2px;
  overflow: hidden auto;
}

.fxView {
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;
}

.cardHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.cardTitle {
  margin: 0;
  color: var(--shell-muted);
  font-size: 13px;
  font-weight: 600;
}

.playbackControls {
  display: flex;
  align-items: center;
  gap: 12px;

  .rateFader {
    flex: 1 1 auto;
    min-width: 0;
  }
}

.switchBtn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px 5px 8px;
  border: 1px solid var(--shell-control-border);
  border-radius: 20px;
  background: var(--shell-control);
  color: var(--shell-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color @transition-fast, background-color @transition-fast, border-color @transition-fast;

  &:hover {
    color: var(--shell-text);
    background: var(--shell-list-hover);
  }
}

.switchOn {
  color: var(--shell-text);
  border-color: color-mix(in srgb, var(--color-primary) 46%, var(--shell-control-border));
  background: var(--shell-list-active);
}

.led {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--shell-control-border);
  transition: background @transition-fast, box-shadow @transition-fast;

  .switchOn & {
    background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--color-primary) 55%, white), var(--color-primary));
    box-shadow: 0 0 8px color-mix(in srgb, var(--color-primary) 65%, transparent);
  }
}

.statusBar {
  display: flex;
  justify-content: center;
  gap: 22px;
  padding: 2px 12px 4px;
  color: var(--shell-muted);
  font-family: @monoFont;
  font-size: 10px;
  letter-spacing: .14em;

  span {
    white-space: nowrap;
  }
}

@media (max-width: 760px) {
  .frame {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
  }

  .rack {
    padding: 14px 14px 8px;
    gap: 10px;
  }

  .decoTitle,
  .statusBar {
    display: none;
  }

  .masterRow {
    grid-template-columns: 32px minmax(0, 1fr) 56px;
  }

  .masterLabel {
    display: none;
  }

  .rackBody {
    flex-flow: column nowrap;
  }

  .moduleNav {
    flex-flow: row nowrap;
    width: 100%;
  }

  .moduleTab {
    flex: 1 1 0;
    align-items: center;
    padding: 8px 6px;
    text-align: center;

    &::before {
      left: 10px;
      right: 10px;
      top: auto;
      bottom: 0;
      width: auto;
      height: 3px;
      border-radius: 3px 3px 0 0;
    }
  }

  .playbackControls {
    flex-wrap: wrap;
  }
}
</style>
