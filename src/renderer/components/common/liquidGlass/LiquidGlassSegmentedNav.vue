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
    >
      <div v-if="lowPerformance" :class="$style.fallbackGlass">
        <span :class="$style.fallbackTint" />
        <span :class="$style.fallbackEdge" />
        <span :class="$style.fallbackGloss" />
      </div>
      <LiquidGlassLayer
        v-else
        variant="capsule"
        active
        interactive
        :displacement-scale="pillFloating ? 28 : 22"
        :blur-amount="pillFloating ? 1.25 : 1"
        corner-radius="inherit"
      />
    </div>

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
import LiquidGlassLayer from './LiquidGlassLayer.vue'

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
  border: 1px solid color-mix(in srgb, var(--shell-control-border, rgba(255, 255, 255, .22)) 72%, transparent);
  border-radius: 999px;
  background:
    radial-gradient(120% 160% at 8% 0%, rgba(255, 255, 255, .22), rgba(255, 255, 255, 0) 58%),
    color-mix(in srgb, var(--shell-control, rgba(255, 255, 255, .18)) 84%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .3),
    0 10px 24px rgba(18, 28, 44, .08);
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
    transform 260ms cubic-bezier(.2, .9, .22, 1.12),
    width 230ms cubic-bezier(.2, .85, .24, 1),
    height 230ms cubic-bezier(.2, .85, .24, 1),
    filter 220ms ease,
    box-shadow 220ms ease;
  filter: saturate(1.18);
  box-shadow:
    0 12px 28px rgba(16, 26, 44, .14),
    0 2px 8px rgba(255, 255, 255, .18);
}

.floating .pill {
  filter: saturate(1.35);
  box-shadow:
    0 18px 38px rgba(13, 23, 42, .2),
    0 4px 14px rgba(255, 255, 255, .22);
}

.item {
  position: relative;
  z-index: 1;
  min-height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: color-mix(in srgb, var(--color-theme, var(--color-primary)) 52%, var(--color-font, #23262f));
  font-size: 12px;
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
  color: var(--color-primary);
  outline: none;
}

.item:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 32%, transparent);
}

.active {
  color: color-mix(in srgb, var(--color-primary) 82%, #10131a);
  text-shadow: 0 1px 0 rgba(255, 255, 255, .34);
}

.disabled {
  color: color-mix(in srgb, var(--color-font, #23262f) 36%, transparent);
  cursor: default;
}

.label {
  position: relative;
  z-index: 1;
}

.fallbackGlass {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background: rgba(255, 255, 255, .2);
  backdrop-filter: blur(14px) saturate(1.18);
  -webkit-backdrop-filter: blur(14px) saturate(1.18);
}

.fallbackTint,
.fallbackEdge,
.fallbackGloss {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.fallbackTint {
  background:
    radial-gradient(105% 85% at 18% 0%, rgba(255, 255, 255, .52), rgba(255, 255, 255, 0) 58%),
    linear-gradient(135deg, rgba(255, 255, 255, .24), rgba(255, 255, 255, .08));
}

.fallbackEdge {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .76),
    inset 0 -1px 0 rgba(0, 0, 0, .13),
    inset 1px 0 0 rgba(255, 255, 255, .34),
    inset -1px 0 0 rgba(255, 255, 255, .18);
}

.fallbackGloss {
  opacity: .62;
  background:
    linear-gradient(100deg, rgba(255, 255, 255, .38), rgba(255, 255, 255, 0) 34% 72%, rgba(255, 255, 255, .24)),
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, .72), rgba(255, 255, 255, 0) 70%);
  mix-blend-mode: screen;
}

@media (prefers-reduced-motion: reduce) {
  .pill,
  .item {
    transition-duration: 1ms;
  }
}
</style>
