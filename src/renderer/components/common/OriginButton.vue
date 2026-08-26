<template>
  <button
    :class="$style.button"
    :type="type"
    :disabled="disabled"
    @click="$emit('click', $event)"
    @pointerenter="handleEnter"
    @pointerleave="handleLeave"
    @pointermove="handleMove"
    @pointerdown="handleDown"
  >
    <span :class="$style.fill" :style="fillStyle" aria-hidden="true" />
    <span :class="$style.label"><slot /></span>
  </button>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'

defineProps({
  type: {
    type: String,
    default: 'button',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})
defineEmits(['click'])

const origin = ref({ x: 0, y: 0 })
const size = ref(0)
const show = ref(false)

const getCoverDiameter = (w, h, x, y) => Math.ceil(2 * Math.max(
  Math.hypot(x, y),
  Math.hypot(w - x, y),
  Math.hypot(x, h - y),
  Math.hypot(w - x, h - y),
))

const updateOrigin = event => {
  const rect = event.currentTarget.getBoundingClientRect()
  origin.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  size.value = getCoverDiameter(rect.width, rect.height, origin.value.x, origin.value.y)
}

const handleEnter = event => {
  if (event.currentTarget.disabled) return
  const rect = event.currentTarget.getBoundingClientRect()
  origin.value = { x: rect.width / 2, y: rect.height / 2 }
  size.value = getCoverDiameter(rect.width, rect.height, origin.value.x, origin.value.y)
  show.value = true
}
const handleLeave = () => { show.value = false }
const handleMove = event => { updateOrigin(event) }
const handleDown = event => { updateOrigin(event) }

const fillStyle = computed(() => ({
  left: `${origin.value.x}px`,
  top: `${origin.value.y}px`,
  width: `${size.value}px`,
  height: `${size.value}px`,
  transform: `translate(-50%, -50%) scale(${show.value && size.value > 0 ? 1 : 0})`,
}))
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  height: 30px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  overflow: hidden;
  color: #fff;
  background: var(--color-primary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px var(--color-primary-alpha-600), inset 0 1px 0 rgba(255, 255, 255, .35);
  transition: transform @transition-fast;

  &:hover:not(:disabled) { transform: translateY(-1px); }
  &:focus-visible { outline: 2px solid var(--color-primary-alpha-300); outline-offset: 2px; }
  &:disabled { opacity: .45; cursor: default; transform: none; }
}

.fill {
  position: absolute;
  border-radius: 50%;
  background: rgba(6, 44, 30, .9);
  pointer-events: none;
  transition: transform .5s cubic-bezier(.16, 1, .3, 1);
}

.label {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  line-height: 1;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .button,
  .fill { transition-duration: .01ms; }
}
</style>
