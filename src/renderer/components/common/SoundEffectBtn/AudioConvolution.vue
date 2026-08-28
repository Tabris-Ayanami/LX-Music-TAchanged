<template>
  <div :class="$style.content">
    <div :class="$style.header">
      <h3>{{ $t('player__sound_effect_convolution') }}</h3>
    </div>
    <div :class="$style.convList">
      <RackLedBtn
        v-for="item in convolutions"
        :key="item.name"
        :active="selected == item.source"
        :aria-pressed="selected == item.source"
        @click="updateConvolution(selected == item.source ? '' : item.source)"
      >
        {{ $t(`player__sound_effect_convolution_file_${item.name}`) }}
      </RackLedBtn>
    </div>
    <div :class="$style.saveList">
      <RackLedBtn v-for="item in userPresetList" :key="item.id" :active="isPresetActive(item)" @click="handleSetPreset(item)" @contextmenu="handleRemovePreset(item.id)">{{ item.name }}</RackLedBtn>
      <AddConvolutionPresetBtn v-if="userPresetList.length < 31" :disabled="disabledConvolution" />
    </div>
    <div :class="[$style.gainRow, { [$style.disabled]: disabledConvolution }]">
      <div :class="$style.gainColumn">
        <span :class="$style.gainLabel">{{ $t('player__sound_effect_convolution_main_gain') }}</span>
        <div :class="$style.faderSlot">
          <RackFader
            :value="appSetting['player.soundEffect.convolution.mainGain']"
            :min="0"
            :max="50"
            :step="1"
            :disabled="disabledConvolution"
            :aria-label="$t('player__sound_effect_convolution_main_gain')"
            @change="handleUpdateMainGain"
          />
        </div>
        <span :class="$style.lcd">{{ appSetting['player.soundEffect.convolution.mainGain'] * 10 }}%</span>
      </div>
      <div :class="$style.gainColumn">
        <span :class="$style.gainLabel">{{ $t('player__sound_effect_convolution_send_gain') }}</span>
        <div :class="$style.faderSlot">
          <RackFader
            :value="appSetting['player.soundEffect.convolution.sendGain']"
            :min="0"
            :max="50"
            :step="1"
            :disabled="disabledConvolution"
            :aria-label="$t('player__sound_effect_convolution_send_gain')"
            @change="handleUpdateSendGain"
          />
        </div>
        <span :class="$style.lcd">{{ appSetting['player.soundEffect.convolution.sendGain'] * 10 }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from '@common/utils/vueTools'
import { appSetting, saveMediaDeviceId, updateSetting } from '@renderer/store/setting'
import { convolutions, setMediaDeviceId } from '@renderer/plugins/player'
import AddConvolutionPresetBtn from './AddConvolutionPresetBtn.vue'
import RackFader from './RackFader.vue'
import RackLedBtn from './RackLedBtn.vue'
import { getUserConvolutionPresetList, removeUserConvolutionPreset } from '@renderer/store/soundEffect'

const selected = computed(() => appSetting['player.soundEffect.convolution.fileName'])

const updateConvolution = async val => {
  if (appSetting['player.mediaDeviceId'] != 'default') {
    await setMediaDeviceId('default').catch(_ => _)
    saveMediaDeviceId('default')
  }
  const target = convolutions.find(c => c.source == val)
  const setting = {
    'player.soundEffect.convolution.fileName': val,
  }
  if (target) {
    setting['player.soundEffect.convolution.mainGain'] = target.mainGain * 10
    setting['player.soundEffect.convolution.sendGain'] = target.sendGain * 10
  }
  updateSetting(setting)
}

const handleUpdateMainGain = (value) => {
  updateSetting({ 'player.soundEffect.convolution.mainGain': Math.round(value) })
}
const handleUpdateSendGain = (value) => {
  updateSetting({ 'player.soundEffect.convolution.sendGain': Math.round(value) })
}

const handleSetPreset = (item) => {
  if (appSetting['player.mediaDeviceId'] != 'default') saveMediaDeviceId('default')
  updateSetting({
    'player.soundEffect.convolution.fileName': item.source,
    'player.soundEffect.convolution.mainGain': item.mainGain,
    'player.soundEffect.convolution.sendGain': item.sendGain,
  })
}
const isPresetActive = item => {
  return appSetting['player.soundEffect.convolution.fileName'] == item.source &&
    appSetting['player.soundEffect.convolution.mainGain'] == item.mainGain &&
    appSetting['player.soundEffect.convolution.sendGain'] == item.sendGain
}
const userPresetList = ref([])
const handleRemovePreset = id => {
  void removeUserConvolutionPreset(id)
}

const disabledConvolution = computed(() => {
  return !appSetting['player.soundEffect.convolution.fileName']
})

onMounted(() => {
  void getUserConvolutionPresetList().then(list => {
    userPresetList.value = list
  })
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@monoFont: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;

.content {
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--shell-divider);
  border-radius: 12px;
  background: var(--shell-surface-strong);
  box-shadow: inset 0 1px 0 var(--shell-edge-light), inset 0 1px 4px var(--shell-edge-shadow);
}

.header {
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;

  h3 {
    margin: 0;
    color: var(--shell-muted);
    font-size: 13px;
    font-weight: 600;
  }
}

.convList {
  display: flex;
  flex-flow: row wrap;
  gap: 8px;
}

.gainRow {
  display: flex;
  flex-flow: row nowrap;
  justify-content: center;
  gap: 24px;
  transition: opacity @transition-normal;

  &.disabled {
    opacity: .4;
  }
}

.gainColumn {
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 6px;
  width: 92px;
}

.gainLabel {
  color: var(--shell-muted);
  font-size: 11px;
  text-align: center;
}

.faderSlot {
  width: 100%;
  height: 120px;
}

.lcd {
  flex: none;
  min-width: 44px;
  padding: 2px 4px;
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

.saveList {
  display: flex;
  flex-flow: row wrap;
  gap: 8px;
}
</style>
