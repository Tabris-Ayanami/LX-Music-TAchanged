<template>
  <div :class="$style.content">
    <div :class="$style.header">
      <h3>
        {{ $t('player__sound_effect_pitch_shifter') }}
        <svg-icon class="help-icon" name="information-slab-circle-outline" :aria-label="$t('player__sound_effect_pitch_shifter_tip')" />
      </h3>
      <RackEngravedBtn @click="handleSetPreset(1)">{{ $t('player__sound_effect_pitch_shifter_reset_btn') }}</RackEngravedBtn>
    </div>
    <div :class="$style.faderRow">
      <RackFader
        direction="horizontal"
        :class="$style.fader"
        :value="playbackRate * 100"
        :min="50"
        :max="150"
        :step="1"
        :center-value="100"
        :aria-label="$t('player__sound_effect_pitch_shifter')"
        @change="handleUpdatePlaybackRate"
      />
      <span :class="$style.lcd">{{ playbackRate.toFixed(2) }}x</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { appSetting, saveMediaDeviceId, updateSetting } from '@renderer/store/setting'
import RackEngravedBtn from './RackEngravedBtn.vue'
import RackFader from './RackFader.vue'

const playbackRate = computed(() => appSetting['player.soundEffect.pitchShifter.playbackRate'])

const handleSetPreset = async(value) => {
  if (appSetting['player.mediaDeviceId'] != 'default') {
    await setMediaDeviceId('default').catch(_ => _)
    saveMediaDeviceId('default')
  }
  updateSetting({ 'player.soundEffect.pitchShifter.playbackRate': value })
}

const handleUpdatePlaybackRate = (value) => {
  value = parseFloat((Math.round(value) / 100).toFixed(2))
  void handleSetPreset(value)
}
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

.faderRow {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 12px;

  .fader {
    flex: 1 1 auto;
    min-width: 0;
  }
}

.lcd {
  flex: none;
  min-width: 52px;
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
</style>
