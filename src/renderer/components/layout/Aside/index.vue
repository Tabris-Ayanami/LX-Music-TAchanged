<template>
  <div :class="[$style.aside, { [$style.fullscreen]: isFullscreen, [$style.collapsed]: isSidebarCollapsed }]">
    <div :class="$style.topTools">
      <ControlBtns v-if="appSetting['common.controlBtnPosition'] == 'left'" />
    </div>
    <NavBar />
    <div :class="$style.bottomTools">
      <button type="button" :class="$style.brandButton" :title="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="toggleSidebarCollapsed">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32" width="18" height="18" space="preserve">
          <use xlink:href="#icon-list-order" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { isSidebarCollapsed, toggleSidebarCollapsed } from '@renderer/store/ui'

import ControlBtns from './ControlBtns.vue'
import NavBar from './NavBar.vue'
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.aside {
  -webkit-app-region: drag;
  -webkit-user-select: none;
  display: flex;
  flex-flow: column nowrap;
  min-width: 0;
  overflow-x: hidden;
  padding: 12px 10px;
  gap: 12px;
  border-radius: 18px;
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18));
  background: var(--shell-surface, rgba(255, 255, 255, 0.6));
  box-shadow: 0 14px 36px rgba(31, 48, 78, 0.1);
  backdrop-filter: blur(22px);

  &.fullscreen {
    -webkit-app-region: no-drag;

    .topTools {
      display: none;
    }
  }
}

.collapsed {
  padding-left: 8px;
  padding-right: 8px;
}

.topTools {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.bottomTools {
  margin-top: auto;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-top: 4px;
  -webkit-app-region: no-drag;
}

.brandButton {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-text, var(--color-font));
  background: var(--shell-surface-strong, rgba(255, 255, 255, 0.82));
  cursor: pointer;
  transition: @transition-fast;
  transition-property: transform, opacity, background-color, border-color;

  &:hover {
    opacity: .88;
    transform: translateY(-1px);
  }

  &:active {
    opacity: .7;
    transform: translateY(0);
  }
}
</style>
