<template>
  <div :class="$style.content">
    <div :class="$style.header">
      <h3>{{ $t('player__sound_effect_panner') }}</h3>
      <button
        type="button"
        role="switch"
        :aria-checked="appSetting['player.soundEffect.panner.enable'] ? 'true' : 'false'"
        :class="[$style.switchBtn, { [$style.switchOn]: appSetting['player.soundEffect.panner.enable'] }]"
        @click="updateEnabled(!appSetting['player.soundEffect.panner.enable'])"
      >
        <span :class="$style.led" aria-hidden="true" />
        {{ $t('player__sound_effect_panner_enabled') }}
      </button>
    </div>
    <div :class="$style.body">
      <div :class="[$style.radar, { [$style.radarOff]: !appSetting['player.soundEffect.panner.enable'] }]" aria-hidden="true">
        <span :class="$style.sweep" />
        <span :class="$style.centerDot" />
        <span :class="$style.orbitDot" :style="orbitStyle" />
      </div>
      <div :class="$style.faderList">
        <div :class="$style.faderItem">
          <span :class="$style.faderLabel">{{ $t('player__sound_effect_panner_sound_speed') }}</span>
          <RackFader
            direction="horizontal"
            :class="$style.fader"
            :value="appSetting['player.soundEffect.panner.speed']"
            :min="1"
            :max="50"
            :step="1"
            :aria-label="$t('player__sound_effect_panner_sound_speed')"
            @change="handleUpdateSpeed"
          />
          <span :class="[$style.lcd, { [$style.lcdActive]: appSetting['player.soundEffect.panner.speed'] != 25 }]">{{ appSetting['player.soundEffect.panner.speed'] }}</span>
        </div>
        <div :class="$style.faderItem">
          <span :class="$style.faderLabel">{{ $t('player__sound_effect_panner_sound_r') }}</span>
          <RackFader
            direction="horizontal"
            :class="$style.fader"
            :value="appSetting['player.soundEffect.panner.soundR']"
            :min="1"
            :max="30"
            :step="1"
            :aria-label="$t('player__sound_effect_panner_sound_r')"
            @change="handleUpdateSoundR"
          />
          <span :class="[$style.lcd, { [$style.lcdActive]: appSetting['player.soundEffect.panner.soundR'] != 5 }]">{{ appSetting['player.soundEffect.panner.soundR'] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { appSetting, saveMediaDeviceId, updateSetting } from '@renderer/store/setting'
import RackFader from './RackFader.vue'

const orbitStyle = computed(() => {
  const offset = (appSetting['player.soundEffect.panner.soundR'] / 30) * 42
  return {
    left: `${50 + offset * Math.SQRT1_2}%`,
    top: `${50 - offset * Math.SQRT1_2}%`,
  }
})

const updateEnabled = async(enabled) => {
  if (appSetting['player.mediaDeviceId'] != 'default') {
    await setMediaDeviceId('default').catch(_ => _)
    saveMediaDeviceId('default')
  }
  updateSetting({ 'player.soundEffect.panner.enable': enabled })
}

const handleUpdateSoundR = (value) => {
  updateSetting({ 'player.soundEffect.panner.soundR': Math.round(value) })
}
const handleUpdateSpeed = (value) => {
  updateSetting({ 'player.soundEffect.panner.speed': Math.round(value) })
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

.body {
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 16px;
}

.radar {
  position: relative;
  flex: none;
  width: 210px;
  height: 210px;
  overflow: hidden;
  border: 1px solid var(--shell-divider);
  border-radius: 50%;
  background:
    linear-gradient(90deg, transparent calc(50% - .5px), var(--shell-divider) calc(50% - .5px) calc(50% + .5px), transparent calc(50% + .5px)),
    linear-gradient(0deg, transparent calc(50% - .5px), var(--shell-divider) calc(50% - .5px) calc(50% + .5px), transparent calc(50% + .5px)),
    repeating-radial-gradient(circle at 50% 50%, transparent 0 34px, var(--shell-divider) 34px 35px),
    var(--shell-surface-soft);
  box-shadow: inset 0 1px 0 var(--shell-edge-light), inset 0 1px 4px var(--shell-edge-shadow);
  transition: opacity @transition-normal;
}

.radarOff {
  opacity: .5;

  .sweep {
    animation-play-state: paused;
    opacity: 0;
  }
}

.sweep {
  position: absolute;
  inset: -50%;
  background: conic-gradient(from 0deg at 50% 50%, transparent 0%, color-mix(in srgb, var(--color-primary) 16%, transparent) 80%, color-mix(in srgb, var(--color-primary) 55%, transparent) 100%);
  animation: sweepRotate 3s linear infinite;
  pointer-events: none;
}

@keyframes sweepRotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sweep {
    animation: none;
  }
}

.centerDot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 8px;
  translate: -50% -50%;
  border-radius: 50%;
  background: var(--shell-muted);
}

.orbitDot {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  translate: -50% -50%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--color-primary) 55%, white), var(--color-primary));
  box-shadow: 0 0 10px color-mix(in srgb, var(--color-primary) 60%, transparent);
  transition: left @transition-normal;
}

.faderList {
  width: 100%;
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
}

.faderItem {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 10px;

  .fader {
    flex: 1 1 auto;
    min-width: 0;
  }
}

.faderLabel {
  flex: none;
  width: 76px;
  color: var(--shell-muted);
  font-size: 11px;
  white-space: nowrap;
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

.lcdActive {
  color: var(--color-primary);
  text-shadow: 0 1px 0 rgba(255, 255, 255, .5), 0 0 8px color-mix(in srgb, var(--color-primary) 45%, transparent);

  :global(.themeShellDark) & {
    color: color-mix(in srgb, var(--color-primary) 85%, white 15%);
    text-shadow: 0 0 9px color-mix(in srgb, var(--color-primary) 60%, transparent);
  }
}

@media (max-width: 760px) {
  .radar {
    width: 170px;
    height: 170px;
  }
}
</style>
