<template>
  <video
    v-if="active && src"
    ref="videoRef"
    :key="src"
    :poster="poster || undefined"
    muted
    playsinline
    loop
    autoplay
    preload="auto"
    disablepictureinpicture
    @error="handleError"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from '@common/utils/vueTools'
import { attachDynamicArtworkSource } from '@renderer/utils/appleDynamicCover/hls'

const props = defineProps<{
  src: string
  poster?: string
  active: boolean
}>()

const emit = defineEmits<{ error: [] }>()

const failedSource = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)
let releaseSource: (() => void) | null = null
let attachGeneration = 0

const releaseVideo = () => {
  attachGeneration++
  releaseSource?.()
  releaseSource = null
}

const keepRelease = (release: () => void) => {
  releaseSource = release
}

const attachVideo = async() => {
  const generation = ++attachGeneration
  releaseSource?.()
  releaseSource = null
  failedSource.value = ''
  const video = videoRef.value
  const source = props.src
  if (!props.active || !video || !source) return

  try {
    const release = await attachDynamicArtworkSource(video, source, {
      onFatalError: handleError,
      onPlaybackError: handleError,
    })
    if (generation != attachGeneration || video != videoRef.value || source != props.src || !props.active) {
      release()
      return
    }
    keepRelease(release)
  } catch (_) {
    if (generation == attachGeneration) handleError()
  }
}

const handleError = () => {
  if (!props.src || failedSource.value == props.src) return
  failedSource.value = props.src
  emit('error')
}

watch([() => props.src, () => props.active, videoRef], () => {
  void attachVideo()
}, { immediate: true, flush: 'post' })

onBeforeUnmount(releaseVideo)
</script>
