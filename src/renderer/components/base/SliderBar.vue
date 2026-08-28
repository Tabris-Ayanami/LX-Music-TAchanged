<template>
  <div :class="[$style.sliderContent, { [$style.disabled]: disabled, [$style.dragging]: isDragging }, className]">
    <div :class="[$style.slider]">
      <div ref="dom_sliderBar" :class="$style.sliderBar" :style="{ transform: `scaleX(${(value - min) / (max - min) || 0})` }" />
    </div>
    <div :class="$style.sliderThumb" :style="{ '--slider-ratio': ratio }" />
    <div
      :class="$style.sliderMask"
      role="slider"
      :tabindex="disabled ? -1 : 0"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="value"
      :aria-disabled="disabled"
      @keydown="handleKeyDown"
      @mousedown="handleSliderMsDown"
    />
  </div>
</template>

<script>
import { computed, ref, onBeforeUnmount } from '@common/utils/vueTools'
// import { player as eventPlayerNames } from '@renderer/event/names'

export default {
  props: {
    className: {
      type: String,
      default: '',
    },
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
  },
  emits: ['change'],
  setup(props, { emit }) {
    const sliderEvent = {
      isMsDown: false,
      msDownX: 0,
      msDownRatio: 0,
    }
    const dom_sliderBar = ref(null)
    const isDragging = ref(false)
    const ratio = computed(() => {
      const range = props.max - props.min
      return range > 0 ? Math.max(0, Math.min(1, (props.value - props.min) / range)) : 0
    })

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
    const getSliderWidth = () => dom_sliderBar.value?.clientWidth || 0
    const getRange = () => props.max - props.min
    const emitSteppedValue = rawValue => {
      const value = getSteppedValue(rawValue)
      emit('change', value)
      return value
    }

    const handleSliderMsDown = event => {
      if (props.disabled) return
      const width = getSliderWidth()
      if (!width) return

      sliderEvent.isMsDown = true
      isDragging.value = true
      sliderEvent.msDownX = event.clientX
      document.addEventListener('mousemove', handleSliderMsMove)
      document.addEventListener('mouseup', handleSliderMsUp)

      const rawValue = (event.offsetX / width) * getRange() + props.min
      const value = emitSteppedValue(rawValue)
      sliderEvent.msDownRatio = getRange() === 0 ? 0 : (value - props.min) / getRange()
    }
    const handleSliderMsUp = () => {
      sliderEvent.isMsDown = false
      isDragging.value = false
      document.removeEventListener('mousemove', handleSliderMsMove)
      document.removeEventListener('mouseup', handleSliderMsUp)
    }
    const handleSliderMsMove = event => {
      if (!sliderEvent.isMsDown || props.disabled) return
      const width = getSliderWidth()
      if (!width) return

      const ratio = sliderEvent.msDownRatio + (event.clientX - sliderEvent.msDownX) / width
      const rawValue = ratio * getRange() + props.min
      emitSteppedValue(rawValue)
    }

    const handleKeyDown = event => {
      if (props.disabled) return
      let nextValue
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          nextValue = props.value - props.step
          break
        case 'ArrowRight':
        case 'ArrowUp':
          nextValue = props.value + props.step
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
      emitSteppedValue(nextValue)
    }

    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleSliderMsMove)
      document.removeEventListener('mouseup', handleSliderMsUp)
    })

    return {
      handleSliderMsDown,
      handleKeyDown,
      dom_sliderBar,
      isDragging,
      ratio,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.sliderContent {
  container-type: inline-size;
  flex: none;
  position: relative;
  width: 100px;
  padding: 5px 0;
  // margin-right: 10px;
  display: flex;
  align-items: center;
  opacity: .72;
  transition: opacity @transition-normal;
  &:hover,
  &.dragging,
  &:focus-within {
    opacity: 1;

    .slider {
      transform: scaleY(1);
    }

    .sliderThumb {
      opacity: 1;
      transform: var(--slider-thumb-shift) scale(1);
    }
  }
  &.disabled {
    opacity: .3;
    .sliderMask {
      cursor: default;
    }
  }
}

.slider {
  // cursor: pointer;
  width: 100%;
  height: 5px;
  border-radius: 20px;
  overflow: hidden;
  transition: @transition-normal;
  transition-property: background-color, opacity;
  background-color: var(--slider-track-color, color-mix(in srgb, var(--color-primary) 20%, transparent));
  // background-color: #f5f5f5;
  position: relative;
  transform: scaleY(.8);
  transition: transform @transition-fast, background-color @transition-fast, opacity @transition-fast;
  // border-radius: @radius-progress-border;
}

// .muted {
//   opacity: .5;
// }

.sliderBar {
  position: absolute;
  left: 0;
  top: 0;
  transform: scaleX(0);
  transform-origin: 0;
  transition-property: transform;
  transition-timing-function: var(--motion-ease-out);
  width: 100%;
  height: 100%;
  // border-radius: @radius-progress-border;
  transition-duration: 0.2s;
  background-color: var(--slider-fill-color, var(--color-primary));
}

.sliderThumb {
  --slider-thumb-shift: translateX(calc(var(--slider-ratio, 0) * (100cqw - var(--slider-thumb-width, 12px)))) translateY(-50%);
  position: absolute;
  left: 0;
  top: 50%;
  width: var(--slider-thumb-width, 12px);
  height: var(--slider-thumb-height, 12px);
  border-radius: var(--slider-thumb-radius, 50%);
  opacity: 0;
  background: var(--slider-thumb-color, var(--color-primary));
  box-shadow: var(--slider-thumb-shadow, 0 0 0 2px var(--shell-surface-elevated, var(--color-main-background)), 0 2px 8px rgba(0, 0, 0, .2));
  transform: var(--slider-thumb-shift) scale(.76);
  transition: opacity @transition-fast, transform @transition-fast;
  pointer-events: none;
}

.sliderMask {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

</style>
