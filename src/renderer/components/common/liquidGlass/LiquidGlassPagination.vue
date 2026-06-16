<template>
  <LiquidGlassSegmentedNav
    v-if="maxPage > 1"
    :model-value="activeValue"
    :items="navItems"
    align="center"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LiquidGlassSegmentedNavItem } from './types'
import LiquidGlassSegmentedNav from './LiquidGlassSegmentedNav.vue'

defineOptions({
  name: 'LiquidGlassPagination',
})

const props = withDefaults(defineProps<{
  count?: number
  limit?: number
  page?: number
  btnLength?: number
}>(), {
  count: 0,
  limit: 10,
  page: 1,
  btnLength: 7,
})

const emit = defineEmits<(event: 'btn-click', page: number) => void>()

const maxPage = computed(() => Math.ceil(props.count / props.limit) || 1)
const pageEvg = computed(() => Math.floor(props.btnLength / 2))
const activeValue = computed(() => `page:${props.page}`)
const pages = computed(() => {
  if (maxPage.value <= props.btnLength) return Array.from({ length: maxPage.value }, (_, i) => i + 1)
  const start = props.page - pageEvg.value > 1
    ? maxPage.value - props.page < pageEvg.value + 1
      ? maxPage.value - (props.btnLength - 1)
      : props.page - pageEvg.value
    : 1
  return Array.from({ length: props.btnLength }, (_, i) => start + i)
})

const navItems = computed<LiquidGlassSegmentedNavItem[]>(() => {
  const items: LiquidGlassSegmentedNavItem[] = [
    {
      label: '<',
      value: `prev:${props.page - 1}`,
      disabled: props.page <= 1,
    },
  ]

  if (maxPage.value > props.btnLength && props.page > pageEvg.value + 1) {
    items.push({
      label: '1',
      value: 'page:1',
    })
  }

  pages.value.forEach(page => {
    items.push({
      label: page.toString(),
      value: `page:${page}`,
    })
  })

  if (maxPage.value > props.btnLength && maxPage.value - props.page > pageEvg.value) {
    items.push({
      label: maxPage.value.toString(),
      value: `page:${maxPage.value}`,
    })
  }

  items.push({
    label: '>',
    value: `next:${props.page + 1}`,
    disabled: props.page >= maxPage.value,
  })

  return items
})

const handleChange = (value: string | number) => {
  const [, rawPage] = String(value).split(':')
  const page = Number(rawPage)
  if (!Number.isFinite(page) || page < 1 || page > maxPage.value || page === props.page) return
  emit('btn-click', page)
}
</script>
