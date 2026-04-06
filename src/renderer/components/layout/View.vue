<template>
  <div :class="$style.view">
    <router-view v-slot="{ Component }">
      <keep-alive :max="10">
        <component :is="Component" :key="routeViewKey" class="view-container" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'

const route = useRoute()
const routeViewKey = computed(() => {
  const query = route.query ? JSON.stringify(route.query) : ''
  return `${route.path}::${query}`
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.view {
  position: relative;
  z-index: 1;
  > :global(.view-container) {
    position: absolute !important;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
  }
  // background: #fff;
  // overflow: hidden;
}

</style>
