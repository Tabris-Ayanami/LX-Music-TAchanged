<template>
  <button
    :class="[$style.chip, { [$style.top]: top }]"
    type="button"
    @click="handleClick"
    @pointerenter="handleEnter"
    @pointerleave="handleLeave"
    @pointermove="handleMove"
    @pointerdown="handleDown"
  >
    <span :class="$style.fill" :style="fillStyle" aria-hidden="true" />
    <span :class="$style.label">
      <slot />
    </span>
  </button>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'

const getCoverDiameter = (w, h, x, y) => Math.ceil(2 * Math.max(
  Math.hypot(x, y),
  Math.hypot(w - x, y),
  Math.hypot(x, h - y),
  Math.hypot(w - x, h - y),
))

export default {
  name: 'OriginChip',
  props: {
    top: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  setup(props, { emit }) {
    const origin = ref({ x: 0, y: 0 })
    const size = ref(0)
    const show = ref(false)

    const handleEnter = event => {
      if (event.currentTarget.disabled) return
      const rect = event.currentTarget.getBoundingClientRect()
      origin.value = { x: rect.width / 2, y: rect.height / 2 }
      size.value = getCoverDiameter(rect.width, rect.height, origin.value.x, origin.value.y)
      show.value = true
    }
    const handleLeave = () => {
      show.value = false
    }
    const handleMove = event => {
      const rect = event.currentTarget.getBoundingClientRect()
      origin.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      size.value = getCoverDiameter(rect.width, rect.height, origin.value.x, origin.value.y)
    }
    const handleDown = event => {
      const rect = event.currentTarget.getBoundingClientRect()
      origin.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      size.value = getCoverDiameter(rect.width, rect.height, origin.value.x, origin.value.y)
    }
    const fillStyle = computed(() => ({
      left: `${origin.value.x}px`,
      top: `${origin.value.y}px`,
      width: `${size.value}px`,
      height: `${size.value}px`,
      transform: `translate(-50%, -50%) scale(${show.value && size.value > 0 ? 1 : 0})`,
    }))

    const handleClick = event => {
      emit('click', event)
    }

    return {
      fillStyle,
      handleEnter,
      handleLeave,
      handleMove,
      handleDown,
      handleClick,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: 220px;
  padding: 7px 15px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--shell-control-border, color-mix(in srgb, var(--color-primary) 20%, rgba(255, 255, 255, 0.72)));
  background: var(--shell-control, color-mix(in srgb, var(--color-primary) 10%, rgba(255, 255, 255, 0.82)));
  color: var(--color-font);
  font-size: 13px;
  cursor: pointer;
  transition: transform @transition-fast;

  &:hover {
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary-alpha-300);
    outline-offset: 2px;
  }
}

/* 落点扩散填充：默认灰白 */
.fill {
  position: absolute;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-font-label) 14%, transparent);
  pointer-events: none;
  transition: transform .5s cubic-bezier(.16, 1, .3, 1);
}

.label {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .chip,
  .fill {
    transition-duration: 0.01ms;
  }
}
</style>
