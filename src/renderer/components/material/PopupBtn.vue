<template>
  <div ref="dom_btn" :class="$style.content" @click="handleShowPopup" @mouseenter="handlMsEnter" @mouseleave="handlMsLeave">
    <slot />
    <base-popup
      v-model:visible="visible"
      :btn-el="dom_btn"
      :panel-class="popupClass"
      :list-class="listClass"
      :no-arrow="noArrow"
      @mouseenter="handlMsEnter"
      @mouseleave="handlMsLeave"
    >
      <slot name="content" />
    </base-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from '@common/utils/vueTools'

defineProps({
  popupClass: {
    type: String,
    default: '',
  },
  listClass: {
    type: String,
    default: '',
  },
  noArrow: {
    type: Boolean,
    default: false,
  },
})

const visible = ref(false)
const dom_btn = ref<HTMLElement | null>(null)
let isUnmounted = false

const handleShowPopup = (evt: MouseEvent) => {
  if (isUnmounted) return
  if (visible.value) {
    evt.stopPropagation()
    handlMsLeave()
  } else handlMsEnter()
  // setTimeout(() => {
  //   // if (!)
  //   visible.value = !visible.value
  // }, 50)
}

let timeout: number | null = null
const handlMsEnter = () => {
  if (isUnmounted) return
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  if (visible.value) return
  timeout = setTimeout(() => {
    if (isUnmounted) return
    visible.value = true
  }, 100) as unknown as number
}
const handlMsLeave = () => {
  if (isUnmounted) return
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  if (!visible.value) return
  timeout = setTimeout(() => {
    if (isUnmounted) return
    timeout = null
    visible.value = false
  }, 100) as unknown as number
}

onBeforeUnmount(() => {
  isUnmounted = true
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  visible.value = false
})

defineExpose({
  hide() {
    if (isUnmounted) return
    visible.value = false
  },
})

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.content {
  position: relative;
  display: inline-block;
}

</style>
