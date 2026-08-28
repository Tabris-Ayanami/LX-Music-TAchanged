<template>
  <div :class="[$style.fader, { [$style.horizontal]: isHorizontal, [$style.disabled]: disabled, [$style.dragging]: isDragging }]" @wheel.prevent="handleWheel">
    <div
      ref="dom_track"
      :class="$style.track"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-label="ariaLabel"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="value"
      :aria-disabled="disabled"
      :aria-orientation="direction"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @keydown="handleKeyDown"
    >
      <div v-if="center != null" :class="$style.centerMark" :style="centerMarkStyle" />
      <div :class="$style.fill" :style="fillStyle" />
      <div :class="$style.thumb" :style="thumbStyle" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'

const props = defineProps({
  value: {
    type: Number,
    required: true,
  },
  min: {
    type: Number,
    required: true,
  },
  max: {
    type: Number,
    required: true,
  },
  step: {
    type: Number,
    default: 1,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  centerValue: {
    type: Number,
    default: null,
  },
  direction: {
    type: String,
    default: 'vertical',
  },
})
const emit = defineEmits(['change'])

const dom_track = ref(null)
const isDragging = ref(false)

const isHorizontal = computed(() => props.direction === 'horizontal')
const range = computed(() => props.max - props.min)
const ratio = computed(() => (range.value > 0 ? Math.max(0, Math.min(1, (props.value - props.min) / range.value)) : 0))

const center = computed(() => {
  if (typeof props.centerValue !== 'number') return null
  if (props.centerValue < props.min || props.centerValue > props.max) return null
  return props.centerValue
})
const centerRatio = computed(() => (center.value === null || range.value <= 0 ? 0 : (center.value - props.min) / range.value))

const clampValue = val => {
  if (val < props.min) return props.min
  if (val > props.max) return props.max
  return val
}
const getSteppedValue = val => {
  const step = props.step > 0 ? props.step : 1
  const stepped = Math.round((val - props.min) / step) * step + props.min
  return clampValue(Number(stepped.toFixed(10)))
}

const thumbStyle = computed(() => (isHorizontal.value ? { left: `${ratio.value * 100}%` } : { bottom: `${ratio.value * 100}%` }))
const centerMarkStyle = computed(() => (isHorizontal.value ? { left: `${centerRatio.value * 100}%` } : { bottom: `${centerRatio.value * 100}%` }))

const fillStyle = computed(() => {
  if (range.value <= 0) return {}
  const toRatio = v => Math.max(0, Math.min(1, (v - props.min) / range.value))
  const base = center.value ?? props.min
  const low = toRatio(Math.min(base, props.value))
  const high = toRatio(Math.max(base, props.value))
  if (isHorizontal.value) {
    return {
      left: `${low * 100}%`,
      width: `${(high - low) * 100}%`,
    }
  }
  return {
    bottom: `${low * 100}%`,
    height: `${(high - low) * 100}%`,
  }
})

const emitValueFromPointer = event => {
  const track = dom_track.value
  if (!track) return
  const rect = track.getBoundingClientRect()
  const extent = isHorizontal.value ? rect.width : rect.height
  if (!extent) return
  const rawValue = isHorizontal.value
    ? ((event.clientX - rect.left) / rect.width) * range.value + props.min
    : ((rect.bottom - event.clientY) / rect.height) * range.value + props.min
  emit('change', getSteppedValue(rawValue))
}

const handlePointerDown = event => {
  if (props.disabled) return
  const track = dom_track.value
  if (!track) return
  event.preventDefault()
  track.setPointerCapture(event.pointerId)
  track.focus({ preventScroll: true })
  isDragging.value = true
  emitValueFromPointer(event)
}
const handlePointerMove = event => {
  if (!isDragging.value || props.disabled) return
  emitValueFromPointer(event)
}
const handlePointerUp = event => {
  if (!isDragging.value) return
  isDragging.value = false
  const track = dom_track.value
  if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId)
}

const handleWheel = event => {
  if (props.disabled) return
  const lines = event.deltaMode === 1
    ? event.deltaY
    : Math.abs(event.deltaY) < 50
      ? Math.sign(event.deltaY)
      : Math.round(event.deltaY / 100)
  if (!lines) return
  emit('change', getSteppedValue(props.value - lines * props.step))
}

const handleKeyDown = event => {
  if (props.disabled) return
  let nextValue
  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      nextValue = props.value + props.step
      break
    case 'ArrowDown':
    case 'ArrowLeft':
      nextValue = props.value - props.step
      break
    case 'PageUp':
      nextValue = props.value + props.step * 10
      break
    case 'PageDown':
      nextValue = props.value - props.step * 10
      break
    case 'Home':
      nextValue = props.min
      break
    case 'End':
      nextValue = props.max
      break
    default:
      return
  }
  event.preventDefault()
  emit('change', getSteppedValue(nextValue))
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.fader {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 26px;
  padding: 9px 0;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
  opacity: .82;
  transition: opacity @transition-normal;

  &:hover,
  &.dragging,
  &:focus-within {
    opacity: 1;
  }
  &.disabled {
    opacity: .35;

    .track {
      cursor: default;
    }
  }
  &.horizontal {
    min-width: 40px;
    height: 32px;
    padding: 0 9px;
    align-items: center;

    .track {
      width: 100%;
      height: 6px;
    }
    .centerMark {
      top: -4px;
      bottom: auto;
      width: 1px;
      height: calc(100% + 8px);
      translate: -50% 0;
    }
    .fill {
      top: 0;
      left: auto;
      bottom: auto;
      width: auto;
      height: 100%;
    }
    .thumb {
      top: 50%;
      bottom: auto;
      left: auto;
      translate: -50% -50%;
      width: 16px;
      height: 26px;

      &::before {
        background: repeating-linear-gradient(0deg, var(--shell-edge-shadow) 0 1px, transparent 1px 3px);
      }
      &::after {
        top: 2px;
        bottom: 2px;
        left: 50%;
        right: auto;
        width: 2px;
        height: auto;
        translate: -50% 0;
      }
    }
  }
}

.track {
  position: relative;
  width: 6px;
  height: 100%;
  border-radius: 20px;
  background-color: var(--shell-surface-soft);
  border: 1px solid var(--shell-divider);
  box-shadow: inset 0 1px 3px var(--shell-edge-shadow);
  touch-action: none;
  cursor: pointer;
  outline: none;
  box-sizing: content-box;

  &:focus-visible {
    box-shadow:
      inset 0 1px 3px var(--shell-edge-shadow),
      0 0 0 2px color-mix(in srgb, var(--color-primary) 50%, transparent);
  }
}

.centerMark {
  position: absolute;
  left: -4px;
  width: calc(100% + 8px);
  height: 1px;
  background-color: var(--color-primary-light-100-alpha-700);
  translate: 0 50%;
  pointer-events: none;
}

.fill {
  position: absolute;
  left: 0;
  width: 100%;
  border-radius: inherit;
  background-color: var(--color-primary);
  opacity: .7;
  pointer-events: none;
}

.thumb {
  position: absolute;
  left: 50%;
  translate: -50% 50%;
  width: 26px;
  height: 16px;
  border-radius: 3px;
  background: linear-gradient(180deg, var(--shell-button-bg-hover), var(--shell-button-bg));
  border: 1px solid var(--shell-control-border);
  box-shadow: 0 2px 6px rgba(0, 0, 0, .25);
  pointer-events: none;

  &::before {
    position: absolute;
    inset: 3px 4px;
    content: '';
    background: repeating-linear-gradient(90deg, var(--shell-edge-shadow) 0 1px, transparent 1px 3px);
    opacity: .5;
    border-radius: 1px;
  }
  &::after {
    position: absolute;
    left: 2px;
    right: 2px;
    top: 50%;
    height: 2px;
    translate: 0 -50%;
    border-radius: 2px;
    background-color: var(--color-primary);
    content: '';
  }
}
</style>
