<template>
  <div ref="host" class="folia-visualizer-root" aria-live="polite" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { createFoliaRenderer } from './FoliaVisualizerBridge'

const props = defineProps({
  effect: {
    type: String,
    default: 'classic',
  },
  lines: {
    type: Array,
    default: () => [],
  },
  currentLineIndex: {
    type: Number,
    default: 0,
  },
  playing: {
    type: Boolean,
    default: false,
  },
  coverUrl: {
    type: String,
    default: '',
  },
  songTitle: {
    type: String,
    default: '',
  },
  songArtist: {
    type: String,
    default: '',
  },
  songAlbum: {
    type: String,
    default: '',
  },
  seed: {
    type: [String, Number],
    default: '',
  },
})

const host = ref()
let renderer

const normalizeColor = (value, fallback) => {
  const color = String(value ?? '').trim()
  if (!color) return fallback
  if (/^\d+(?:\.\d+)?\s*,/.test(color)) return `rgb(${color})`
  return CSS.supports('color', color) ? color : fallback
}

const createTheme = () => {
  const style = getComputedStyle(host.value)
  return {
    name: 'LX Music',
    // Folia uses this channel for contrast calculations, Three.js fog and
    // the foreground text on filled bubbles. `transparent` is not a valid
    // Three.js Color and also makes Cappella's right-hand text invisible.
    backgroundColor: normalizeColor(style.getPropertyValue('--detail-color-deep'), '#0b0f18'),
    primaryColor: normalizeColor(style.getPropertyValue('--detail-color-text'), '#f5f7ff'),
    accentColor: normalizeColor(
      style.getPropertyValue('--detail-color-light') || style.getPropertyValue('--color-theme'),
      '#a9c9ff',
    ),
    secondaryColor: 'rgba(235, 240, 255, .5)',
    fontStyle: 'sans',
    fontFamily: 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif',
    fontFamilyStack: ['system-ui', 'Microsoft YaHei', 'PingFang SC', 'sans-serif'],
    fontWeight: 600,
    animationIntensity: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'calm' : 'normal',
  }
}

const render = () => {
  if (!renderer || !host.value) return
  renderer.render({
    effect: props.effect,
    lines: props.lines,
    currentLineIndex: props.currentLineIndex,
    playing: props.playing,
    coverUrl: props.coverUrl || null,
    songTitle: props.songTitle || null,
    songArtist: props.songArtist || null,
    songAlbum: props.songAlbum || null,
    seed: props.seed,
    theme: createTheme(),
  })
}

watch(
  () => [
    props.effect,
    props.lines,
    props.currentLineIndex,
    props.playing,
    props.coverUrl,
    props.songTitle,
    props.songArtist,
    props.songAlbum,
    props.seed,
  ],
  () => {
    void nextTick(render)
  },
)

onMounted(() => {
  renderer = createFoliaRenderer(host.value)
  render()
})

onBeforeUnmount(() => {
  renderer?.unmount()
  renderer = null
})
</script>
