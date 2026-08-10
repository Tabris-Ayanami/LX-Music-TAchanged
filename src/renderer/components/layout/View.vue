<template>
  <div :class="$style.view">
    <router-view v-slot="{ Component }">
      <transition name="motion-view">
        <keep-alive :max="6">
          <component :is="Component" v-if="Component" :key="routeViewKey" class="view-container" />
        </keep-alive>
      </transition>
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

:global(.motion-view-enter-active) {
  z-index: 2;
  transition: opacity 160ms var(--motion-ease-out), transform 180ms var(--motion-ease-out);
}
:global(.motion-view-leave-active) {
  z-index: 1;
  pointer-events: none;
  transition: opacity 100ms var(--motion-ease-out), transform 100ms var(--motion-ease-out);
}
:global(.motion-view-enter-from) {
  opacity: 0;
  transform: translate3d(0, 3px, 0);
}
:global(.motion-view-leave-to) {
  opacity: 0;
  transform: translate3d(0, -2px, 0);
}

</style>
