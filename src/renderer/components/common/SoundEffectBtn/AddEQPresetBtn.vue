<template>
  <RackEngravedBtn :class="[$style.newPreset, {[$style.editing]: isEditing}]" :aria-label="$t('player__sound_effect_biquad_filter_save_btn')" @click="handleEditing($event)">
    <span :class="$style.addLabel">
      <span :class="$style.plus" aria-hidden="true">+</span>{{ $t('player__sound_effect_preset_add_btn') }}
    </span>
    <base-input ref="input" :class="$style.newPresetInput" :value="newPresetName" :placeholder="$t('player__sound_effect_biquad_filter_save_input')" @keyup.enter="handleSave($event)" @blur="handleSave($event)" />
  </RackEngravedBtn>
</template>

<script setup>
import { ref, nextTick } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { saveUserEQPreset } from '@renderer/store/soundEffect'
import RackEngravedBtn from './RackEngravedBtn.vue'

const isEditing = ref(false)
const input = ref(false)
const newPresetName = ref('')

const handleEditing = () => {
  if (isEditing.value) return
  isEditing.value = true
  void nextTick(() => {
    input.value.$el.focus()
  })
}

const handleSave = (event) => {
  let name = event.target.value.trim()
  newPresetName.value = event.target.value = ''
  isEditing.value = false
  if (!name) return
  if (name.length > 20) name = name.substring(0, 20)
  void saveUserEQPreset({
    id: Date.now().toString(),
    name,
    hz31: appSetting['player.soundEffect.biquadFilter.hz31'],
    hz62: appSetting['player.soundEffect.biquadFilter.hz62'],
    hz125: appSetting['player.soundEffect.biquadFilter.hz125'],
    hz250: appSetting['player.soundEffect.biquadFilter.hz250'],
    hz500: appSetting['player.soundEffect.biquadFilter.hz500'],
    hz1000: appSetting['player.soundEffect.biquadFilter.hz1000'],
    hz2000: appSetting['player.soundEffect.biquadFilter.hz2000'],
    hz4000: appSetting['player.soundEffect.biquadFilter.hz4000'],
    hz8000: appSetting['player.soundEffect.biquadFilter.hz8000'],
    hz16000: appSetting['player.soundEffect.biquadFilter.hz16000'],
  })
}

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@monoFont: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;

.newPreset {
  position: relative;
  padding: 5px 12px;

  &.editing {
    min-width: 90px;

    .addLabel {
      display: none;
    }
  }

  // 提高优先级覆盖 base-input 自带 display:inline-block（样式注入顺序不可靠）
  .newPresetInput {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    padding: 0 3px;
    border: none;
    border-radius: inherit;
    background: none !important;
    color: inherit;
    font-size: 12px;
    text-align: center;
    font-family: inherit;
    box-sizing: border-box;

    &::placeholder {
      font-size: 12px;
    }
  }

  &.editing .newPresetInput {
    display: block;
  }
}

.addLabel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.plus {
  font-family: @monoFont;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
</style>
