<template>
  <div
    ref="domNav"
    :class="[
      $style.nav,
      $style[`align_${align}`],
      {
        [$style.empty]: !items.length,
        [$style.floating]: pillFloating,
        [$style.reduced]: lowPerformance,
      },
    ]"
    role="tablist"
    @mouseleave="handleMouseLeave"
  >
    <div
      v-show="pillVisible"
      :class="$style.pill"
      :style="pillStyle"
      aria-hidden="true"
    />

    <button
      v-for="(item, index) in items"
      :key="String(item.value)"
      ref="itemRefs"
      type="button"
      :class="[
        $style.item,
        {
          [$style.active]: item.value === modelValue,
          [$style.disabled]: item.disabled,
        },
      ]"
      role="tab"
      :tabindex="item.disabled ? -1 : 0"
      :disabled="item.disabled"
      :aria-selected="item.value === modelValue"
      :aria-disabled="item.disabled || undefined"
      @mouseenter="handleMouseEnter(index)"
      @focus="handleMouseEnter(index)"
      @blur="handleMouseLeave"
      @click="handleClick(item)"
      @keydown="handleKeydown($event, index)"
    >
      <span :class="$style.label">{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type { LiquidGlassSegmentedNavItem } from './types'

defineOptions({
  name: 'LiquidGlassSegmentedNav',
})

const props = defineProps({
  items: {
    type: Array as PropType<LiquidGlassSegmentedNavItem[]>,
    default: () => [],
  },
  modelValue: {
    type: [String, Number] as PropType<string | number | null>,
    default: null,
  },
  align: {
    type: String as PropType<'left' | 'center' | 'right'>,
    default: 'left',
  },
  lowPerformance: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | number): void
  (event: 'change', value: string | number, item: LiquidGlassSegmentedNavItem): void
}>()

const domNav = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])
const hoverTargetIndex = ref(-1)
const pillRect = ref({ x: 0, y: 0, width: 0, height: 0 })
const pillVisible = ref(false)
const pillFloating = computed(() => hoverTargetIndex.value > -1 && hoverTargetIndex.value !== getSelectedIndex())

let resizeObserver: ResizeObserver | null = null
let updateFrame = 0

const pillStyle = computed(() => ({
  width: `${pillRect.value.width}px`,
  height: `${pillRect.value.height}px`,
  transform: `translate3d(${pillRect.value.x}px, ${pillRect.value.y}px, 0) ${pillFloating.value ? 'translateY(-2px) scale(1.025)' : 'translateY(0) scale(1)'}`,
}))

const normalizeIndex = (index: unknown) => typeof index === 'number' ? index : Number(index)

const getSelectedIndex = () => props.items.findIndex((item: LiquidGlassSegmentedNavItem) => item.value === props.modelValue && !item.disabled)

const getFallbackIndex = () => props.items.findIndex((item: LiquidGlassSegmentedNavItem) => !item.disabled)

const getCurrentTargetIndex = () => {
  if (hoverTargetIndex.value > -1) return hoverTargetIndex.value
  const selectedIndex = getSelectedIndex()
  return selectedIndex > -1 ? selectedIndex : getFallbackIndex()
}

const updatePillToIndex = (index: number) => {
  const navEl = domNav.value
  const itemEl = itemRefs.value[index]
  if (!navEl || !itemEl) {
    pillVisible.value = false
    return
  }

  const navRect = navEl.getBoundingClientRect()
  const itemRect = itemEl.getBoundingClientRect()
  pillRect.value = {
    x: itemRect.left - navRect.left,
    y: itemRect.top - navRect.top,
    width: itemRect.width,
    height: itemRect.height,
  }
  pillVisible.value = true
}

const requestPillUpdate = () => {
  if (updateFrame) window.cancelAnimationFrame(updateFrame)
  updateFrame = window.requestAnimationFrame(() => {
    updateFrame = 0
    updatePillToIndex(getCurrentTargetIndex())
  })
}

const handleMouseEnter = (index: unknown) => {
  const itemIndex = normalizeIndex(index)
  const item = props.items[itemIndex]
  if (!item || item.disabled) return
  hoverTargetIndex.value = itemIndex
  requestPillUpdate()
}

const handleMouseLeave = () => {
  hoverTargetIndex.value = -1
  requestPillUpdate()
}

const handleClick = (item: LiquidGlassSegmentedNavItem) => {
  if (item.disabled ?? false) return
  if (item.value === props.modelValue) return
  emit('update:modelValue', item.value)
  emit('change', item.value, item)
}

const focusItem = (index: number) => {
  const itemEl = itemRefs.value[index]
  if (itemEl) itemEl.focus()
}

const getEnabledIndexByOffset = (startIndex: number, offset: number) => {
  if (!props.items.length) return -1
  let index = startIndex
  for (let count = 0; count < props.items.length; count++) {
    index = (index + offset + props.items.length) % props.items.length
    if (!props.items[index].disabled) return index
  }
  return -1
}

const handleKeydown = (event: KeyboardEvent, index: unknown) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
  event.preventDefault()

  let targetIndex = -1
  if (event.key === 'Home') targetIndex = props.items.findIndex((item: LiquidGlassSegmentedNavItem) => !item.disabled)
  else if (event.key === 'End') {
    for (let i = props.items.length - 1; i >= 0; i--) {
      if (!props.items[i].disabled) {
        targetIndex = i
        break
      }
    }
  } else targetIndex = getEnabledIndexByOffset(normalizeIndex(index), event.key === 'ArrowLeft' ? -1 : 1)

  if (targetIndex < 0) return
  focusItem(targetIndex)
  handleMouseEnter(targetIndex)
}

const bindResizeObserver = () => {
  if (!window.ResizeObserver || !domNav.value) {
    window.addEventListener('resize', requestPillUpdate)
    return
  }

  resizeObserver = new window.ResizeObserver(requestPillUpdate)
  resizeObserver.observe(domNav.value)
  itemRefs.value.forEach((el: HTMLElement) => resizeObserver?.observe(el))
}

watch(() => props.modelValue, () => {
  hoverTargetIndex.value = -1
  requestPillUpdate()
})

watch(() => props.items, async() => {
  itemRefs.value = []
  hoverTargetIndex.value = -1
  await nextTick()
  resizeObserver?.disconnect()
  bindResizeObserver()
  requestPillUpdate()
}, { deep: true })

onMounted(async() => {
  await nextTick()
  bindResizeObserver()
  requestPillUpdate()
})

onBeforeUnmount(() => {
  if (updateFrame) window.cancelAnimationFrame(updateFrame)
  resizeObserver?.disconnect()
  window.removeEventListener('resize', requestPillUpdate)
})
</script>

<style lang="less" module>
.nav {
  position: relative;
  display: inline-flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 4px;
  border-radius: 999px;
  background:
    color-mix(in srgb, var(--color-primary) 8%, rgba(128, 140, 156, 0.14));
  box-shadow:
    inset 0 1px 2px rgba(20, 28, 44, 0.1);
  isolation: isolate;
  overflow: hidden;
  user-select: none;
}

.align_left {
  justify-content: flex-start;
}

.align_center {
  justify-content: center;
}

.align_right {
  justify-content: flex-end;
}

.empty {
  display: none;
}

.pill {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  border-radius: 999px;
  pointer-events: none;
  will-change: transform, width, height;
  transition:
    transform var(--motion-duration-normal) var(--motion-ease-out),
    width var(--motion-duration-normal) var(--motion-ease-out),
    height var(--motion-duration-normal) var(--motion-ease-out),
    filter var(--motion-duration-normal) var(--motion-ease-out),
    box-shadow var(--motion-duration-normal) var(--motion-ease-out);
  background:
    linear-gradient(180deg, #ffffff, color-mix(in srgb, var(--color-primary) 14%, #f2f5f8));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .98),
    inset 0 -1px 0 rgba(0, 0, 0, .04),
    0 4px 12px rgba(20, 28, 44, .16);
}

.floating .pill {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .98),
    inset 0 -1px 0 rgba(0, 0, 0, .04),
    0 8px 18px rgba(20, 28, 44, .2);
}

.item {
  position: relative;
  z-index: 1;
  min-height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: color-mix(in srgb, var(--shell-text, var(--color-font, #23262f)) 78%, var(--color-primary) 22%);
  font-size: 12px;
  font-weight: 600;
  line-height: 28px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color .18s ease,
    text-shadow .18s ease,
    opacity .18s ease;
}

.item:hover,
.item:focus-visible {
  color: var(--shell-text, var(--color-font));
  outline: none;
}

.item:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 32%, transparent);
}

.active {
  color: var(--color-primary-dark-100, var(--color-primary));
  font-weight: 700;
}

.disabled {
  color: color-mix(in srgb, var(--color-font, #23262f) 36%, transparent);
  cursor: default;
}

.label {
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .pill,
  .item {
    transition-duration: 1ms;
  }
}
</style>
