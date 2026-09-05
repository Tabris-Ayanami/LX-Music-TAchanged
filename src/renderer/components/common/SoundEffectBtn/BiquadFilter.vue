<template>
  <div :class="$style.content">
    <div :class="$style.header">
      <h3>{{ $t('player__sound_effect_biquad_filter') }}</h3>
      <div :class="$style.headerBtns">
        <RackEngravedBtn @click="handleReset">{{ $t('player__sound_effect_biquad_filter_reset_btn') }}</RackEngravedBtn>
        <RackEngravedBtn :class="{ [$style.justSaved]: justSaved }" @click="handleSave">{{ justSaved ? $t('player__sound_effect_biquad_filter_state_saved_btn') : $t('player__sound_effect_biquad_filter_state_save_btn') }}</RackEngravedBtn>
      </div>
    </div>
    <div :class="$style.eqList">
      <div v-for="(v, i) in freqs" :key="v" :class="$style.eqColumn">
        <span :class="$style.freqLabel">{{ labels[i] }}</span>
        <div :class="$style.faderSlot">
          <RackFader
            :value="appSetting[`player.soundEffect.biquadFilter.hz${v}`]"
            :min="-15"
            :max="15"
            :step="1"
            :center-value="0"
            :aria-label="`${labels[i]}Hz`"
            @change="handleUpdate(v, $event)"
          />
        </div>
        <span :class="$style.lcd">{{ appSetting[`player.soundEffect.biquadFilter.hz${v}`] }}dB</span>
      </div>
    </div>
    <div :class="$style.saveList">
      <RackLedBtn v-for="item in freqsPreset" :key="item.name" :active="isPresetActive(item)" @click="handleSetPreset(item)">{{ $t(`player__sound_effect_biquad_filter_preset_${item.name}`) }}</RackLedBtn>
      <RackLedBtn v-for="item in userPresetList" :key="item.id" :active="isPresetActive(item)" @click="handleSetPreset(item)" @contextmenu="handleRemovePreset(item.id)">{{ item.name }}</RackLedBtn>
      <AddEQPresetBtn v-if="userPresetList.length < 31" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from '@common/utils/vueTools'
import { freqs, freqsPreset, setMediaDeviceId } from '@renderer/plugins/player'
import { appSetting, saveMediaDeviceId, updateSetting } from '@renderer/store/setting'
import AddEQPresetBtn from './AddEQPresetBtn.vue'
import RackEngravedBtn from './RackEngravedBtn.vue'
import RackFader from './RackFader.vue'
import RackLedBtn from './RackLedBtn.vue'
import { getUserEQPresetList, removeUserEQPreset, saveUserEQPreset } from '@renderer/store/soundEffect'


const labels = freqs.map(num => num < 1000 ? num : `${num / 1000}k`)

const handleUpdate = async(key, value) => {
  if (appSetting['player.mediaDeviceId'] != 'default') {
    await setMediaDeviceId('default').catch(_ => _)
    saveMediaDeviceId('default')
  }

  value = Math.round(value)
  updateSetting({ [`player.soundEffect.biquadFilter.hz${key}`]: value })
}

const captureCurrentFreqs = () => {
  const snapshot = {}
  for (const key of freqs) {
    snapshot[key] = appSetting[`player.soundEffect.biquadFilter.hz${key}`]
  }
  return snapshot
}

const capturePresetFreqs = item => {
  const snapshot = {}
  for (const key of freqs) {
    snapshot[key] = item[`hz${key}`]
  }
  return snapshot
}

// 当前选中的预设：内置预设用 `builtin:${name}`，用户预设用 `user:${id}`
// 选中后调整 EQ 数值不会取消选中态，直到切换其他预设
const selectedPresetKey = ref('')
const getPresetKey = item => (item.id ? `user:${item.id}` : `builtin:${item.name}`)

const selectedPreset = computed(() => {
  if (!selectedPresetKey.value) return null
  if (selectedPresetKey.value.startsWith('builtin:')) {
    return freqsPreset.find(item => getPresetKey(item) == selectedPresetKey.value) ?? null
  }
  for (const preset of userPresetList.value) {
    if (getPresetKey(preset) == selectedPresetKey.value) return preset
  }
  return null
})

// 重置基准值：选中预设时的原始数值（保存后更新为当前数值）
const savedFreqs = ref(null)
const justSaved = ref(false)
let savedTimer

const handleReset = () => {
  const setting = {}
  for (const key of freqs) {
    setting[`player.soundEffect.biquadFilter.hz${key}`] = savedFreqs.value?.[key] ?? 0
  }
  updateSetting(setting)
}

const handleSave = () => {
  const current = captureCurrentFreqs()
  const preset = selectedPreset.value
  if (preset?.id) {
    // 用户预设：直接把当前数值写回该预设
    void saveUserEQPreset({ ...preset, ...current })
  } else if (preset) {
    // 内置预设：直接修改原对象（内存中生效，重启后恢复出厂值）
    Object.assign(preset, current)
  }
  // 未选中预设时，仅把当前数值作为重置基准
  savedFreqs.value = current
  justSaved.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    justSaved.value = false
  }, 1200)
}

const handleSetPreset = (item) => {
  selectedPresetKey.value = getPresetKey(item)
  savedFreqs.value = capturePresetFreqs(item)
  updateSetting({
    'player.soundEffect.biquadFilter.hz31': item.hz31,
    'player.soundEffect.biquadFilter.hz62': item.hz62,
    'player.soundEffect.biquadFilter.hz125': item.hz125,
    'player.soundEffect.biquadFilter.hz250': item.hz250,
    'player.soundEffect.biquadFilter.hz500': item.hz500,
    'player.soundEffect.biquadFilter.hz1000': item.hz1000,
    'player.soundEffect.biquadFilter.hz2000': item.hz2000,
    'player.soundEffect.biquadFilter.hz4000': item.hz4000,
    'player.soundEffect.biquadFilter.hz8000': item.hz8000,
    'player.soundEffect.biquadFilter.hz16000': item.hz16000,
  })
}

// 选中态优先；未选中任何预设时，若当前数值与某一预设一致则点亮其指示灯
const isPresetActive = item => {
  if (selectedPresetKey.value) return selectedPresetKey.value == getPresetKey(item)
  return freqs.every(key => appSetting[`player.soundEffect.biquadFilter.hz${key}`] == item[`hz${key}`])
}

const userPresetList = ref([])

const handleRemovePreset = id => {
  if (selectedPresetKey.value == `user:${id}`) selectedPresetKey.value = ''
  void removeUserEQPreset(id)
}

onMounted(() => {
  savedFreqs.value = captureCurrentFreqs()
  void getUserEQPresetList().then(list => {
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

.headerBtns {
  display: flex;
  flex-flow: row nowrap;
  gap: 8px;
}

.justSaved {
  color: var(--shell-text);
}

.eqList {
  display: grid;
  grid-template-columns: repeat(10, minmax(30px, 1fr));
  gap: 4px;
  padding: 12px 6px 10px;
  border-radius: 8px;
  background: var(--shell-surface-soft);
  box-shadow: inset 0 1px 3px var(--shell-edge-shadow);
  overflow-x: auto;
}

.eqColumn {
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.freqLabel {
  flex: none;
  color: var(--shell-muted);
  font-family: @monoFont;
  font-size: 10px;
  letter-spacing: .06em;
}

.faderSlot {
  width: 100%;
  height: 170px;
}

.lcd {
  flex: none;
  min-width: 40px;
  padding: 2px 4px;
  border: 1px solid var(--shell-divider);
  border-radius: 4px;
  background:
    repeating-linear-gradient(0deg, rgba(70, 90, 60, .06) 0 1px, transparent 1px 3px),
    linear-gradient(180deg, color-mix(in srgb, #e6ecdd 92%, var(--color-primary) 8%), color-mix(in srgb, #c9d4bd 90%, var(--color-primary) 10%));
  box-shadow:
    inset 0 1px 2px rgba(60, 80, 50, .28),
    inset 0 -1px 0 rgba(255, 255, 255, .45),
    0 1px 0 var(--shell-edge-light);
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
    box-shadow:
      inset 0 1px 3px rgba(0, 0, 0, .8),
      inset 0 -1px 0 rgba(255, 255, 255, .08),
      0 1px 0 var(--shell-edge-light);
    color: color-mix(in srgb, var(--color-primary) 62%, #e8f0dd 38%);
    text-shadow: 0 0 6px color-mix(in srgb, var(--color-primary) 45%, transparent);
  }
}

.saveList {
  display: flex;
  flex-flow: row wrap;
  gap: 8px;
}

@media (max-width: 760px) {
  .faderSlot {
    height: 130px;
  }

  .eqList {
    grid-template-columns: repeat(10, minmax(26px, 1fr));
  }
}
</style>
