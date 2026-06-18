<script setup lang="ts">
import { computed } from 'vue'
import type { VGlassProps } from './types'
import { generateFilterId } from './utils'

defineOptions({
  name: 'VGlass',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<VGlassProps>(), {
  as: 'div',
  blur: 0,
  scale: 20,
  baseFrequency: 0.01,
  xChannelSelector: 'R',
  yChannelSelector: 'G',
  numOctaves: 2,
  disableDistortion: false,
})

const filterId = generateFilterId()

const styles = computed(() => {
  const filterValue = props.disableDistortion
    ? `blur(${Math.min(props.blur, 18)}px)`
    : `url(#${filterId}) blur(${props.blur}px)`

  return {
    backdropFilter: filterValue,
    WebkitBackdropFilter: filterValue,
  }
})

defineExpose({ filterId })
</script>

<template>
  <component :is="as" v-bind="$attrs" :style="styles">
    <slot />
    <svg
      v-if="!disableDistortion"
      aria-hidden="true"
      focusable="false"
      role="presentation"
      style="position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none"
    >
      <filter :id="filterId" color-interpolation-filters="sRGB">
        <feTurbulence
          type="turbulence"
          :baseFrequency="baseFrequency"
          :numOctaves="numOctaves"
          result="turbulence"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="turbulence"
          :scale="scale"
          :xChannelSelector="xChannelSelector"
          :yChannelSelector="yChannelSelector"
        />
      </filter>
    </svg>
  </component>
</template>
