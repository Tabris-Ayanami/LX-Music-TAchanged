<template>
  <video
    v-if="active && src"
    :key="src"
    :src="src"
    :poster="poster || undefined"
    muted
    playsinline
    loop
    autoplay
    preload="metadata"
    disablepictureinpicture
    @error="handleError"
  />
</template>

<script setup lang="ts">
import { ref, watch } from '@common/utils/vueTools'

const props = withDefaults(defineProps<{
  src: string | null
  poster?: string | null
  active: boolean
}>(), {
  poster: null,
})

const emit = defineEmits<{
  (event: 'error'): void
}>()

const failedSource = ref('')

watch(() => props.src, () => {
  failedSource.value = ''
})

const handleError = () => {
  if (!props.src || failedSource.value == props.src) return
  failedSource.value = props.src
  emit('error')
}
</script>
