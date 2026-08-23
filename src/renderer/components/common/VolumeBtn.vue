<template>
  <div :class="[$style.volumeShell, { [$style.dragging]: isDragging }]" @wheel.prevent="handleWheel">
    <div :class="$style.sliderPane" @mousedown.stop="handleSliderDown">
      <div :class="$style.sliderTrack" data-volume-track>
        <div :class="$style.sliderFill" :style="{ transform: `scaleY(${displayVolume})` }" />
      </div>
    </div>
    <button
      ref="buttonRef"
      type="button"
      :class="[$style.btn, { [$style.muted]: isMute || volume == 0 }]"
      :aria-label="isMute ? $t('player__volume_muted') : $t('player__volume')"
      @click.stop="toggleMute"
    >
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use :xlink:href="icon" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from '@common/utils/vueTools'
import { volume, isMute } from '@renderer/store/player/volume'

const buttonRef = ref(null)
const lastAudibleVolume = ref(0.7)
const isDragging = ref(false)

const displayVolume = computed(() => isMute.value ? 0 : volume.value)

const setVolumeFromClientY = clientY => {
  const root = buttonRef.value?.parentElement
  const track = root?.querySelector?.('[data-volume-track]')
  const target = track || root
  const rect = target?.getBoundingClientRect?.()
  if (!rect?.height) return
  const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height))
  window.app_event.setVolume(Math.round(ratio * 100) / 100)
  if (ratio > 0) lastAudibleVolume.value = ratio
  if (isMute.value && ratio > 0) window.app_event.setVolumeIsMute(false)
}

const handleSliderDown = event => {
  isDragging.value = true
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  setVolumeFromClientY(event.clientY)
}

const handleMouseMove = event => {
  if (!isDragging.value) return
  setVolumeFromClientY(event.clientY)
}

const handleMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

const handleWheel = event => {
  const nextVolume = Math.max(0, Math.min(1, volume.value + (-event.deltaY / 100 * 0.02)))
  window.app_event.setVolume(Math.round(nextVolume * 100) / 100)
  if (nextVolume > 0) lastAudibleVolume.value = nextVolume
  if (isMute.value && nextVolume > 0) window.app_event.setVolumeIsMute(false)
}

const toggleMute = () => {
  if (isMute.value || volume.value == 0) {
    if (volume.value == 0) window.app_event.setVolume(lastAudibleVolume.value || 0.7)
    window.app_event.setVolumeIsMute(false)
    return
  }
  if (volume.value > 0) lastAudibleVolume.value = volume.value
  window.app_event.setVolumeIsMute(true)
}

const icon = computed(() => {
  return isMute.value
    ? '#icon-volume-mute-outline'
    : volume.value == 0
      ? '#icon-volume-off-outline'
      : volume.value < 0.3
        ? '#icon-volume-low-outline'
        : volume.value < 0.7
          ? '#icon-volume-medium-outline'
          : '#icon-volume-high-outline'
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.volumeShell {
  --volume-shell-size: 30px;
  flex: none;
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  transform-origin: 50% 100%;
  width: var(--volume-shell-size);
  height: var(--volume-shell-size);
  border-radius: 999px;
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  z-index: 12;
  background:
    radial-gradient(circle at 50% 8%, rgba(255, 255, 255, .62), rgba(255, 255, 255, 0) 44%),
    linear-gradient(180deg, rgba(255, 255, 255, .42), rgba(237, 246, 255, .2));
  border: 1px solid rgba(255, 255, 255, .38);
  box-shadow:
    0 18px 28px rgba(28, 41, 68, .16),
    0 6px 10px rgba(28, 41, 68, .12),
    0 1px 0 rgba(255, 255, 255, .72) inset,
    0 0 0 1px rgba(255, 255, 255, .2) inset;
  backdrop-filter: blur(22px) saturate(178%);
  -webkit-backdrop-filter: blur(22px) saturate(178%);
  transition: height 140ms var(--motion-ease-out), border-radius 140ms var(--motion-ease-out), box-shadow 140ms var(--motion-ease-out);

  &:hover,
  &.dragging {
    height: 142px;
    border-radius: 999px;
    transition-duration: 220ms;
    box-shadow:
      0 24px 42px rgba(28, 41, 68, .2),
      0 10px 16px rgba(28, 41, 68, .14),
      0 1px 0 rgba(255, 255, 255, .76) inset,
      0 0 0 1px rgba(255, 255, 255, .28) inset;
  }
}

.sliderPane {
  position: absolute;
  left: 0;
  right: 0;
  top: 11px;
  bottom: 36px;
  display: flex;
  justify-content: center;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 120ms var(--motion-ease-out), transform 140ms var(--motion-ease-out);
  cursor: pointer;

  .volumeShell:hover &,
  .dragging & {
    opacity: 1;
    transform: translateY(0);
    transition-duration: 180ms;
  }
}

.sliderTrack {
  width: 4px;
  height: 100%;
  border-radius: 999px;
  background: rgba(255, 255, 255, .34);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, .18) inset;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}

.sliderFill {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 72%, white 28%), var(--color-primary));
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-primary) 46%, transparent);
  transform-origin: 50% 100%;
  transition: transform 100ms linear;
}

.btn {
  position: absolute;
  left: 0;
  bottom: 0;
  transform: none;
  z-index: 1;
  width: var(--volume-shell-size);
  height: var(--volume-shell-size);
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--shell-text, var(--color-button-font));
  cursor: pointer;
  line-height: 0;
  transition: transform @transition-fast, color @transition-fast;

  svg {
    width: 17px;
    height: 17px;
    fill: currentColor;
    opacity: .82;
    transition: opacity @transition-fast;
    transform: none;
  }

  &:hover svg {
    opacity: 1;
  }

  &:active {
    transform: scale(.92);
  }
}

.volumeShell > .btn {
  width: var(--volume-shell-size);
  height: var(--volume-shell-size);
  min-width: var(--volume-shell-size);
  min-height: var(--volume-shell-size);
  max-width: var(--volume-shell-size);
  max-height: var(--volume-shell-size);
  left: 0;
  right: auto;
  bottom: 0;
  align-self: flex-end;
}

.muted {
  color: rgba(104, 114, 130, .82);
}
</style>
