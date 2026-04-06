<template>
  <aside :class="$style.host">
    <div :class="[$style.panel, { [$style.collapsed]: isSidebarCollapsed }]">
      <div :class="$style.brandRow">
        <div :class="$style.brand">
          <button type="button" :class="$style.logoBtn" :title="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="toggleSidebarCollapsed">
            <span :class="$style.logo">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
                <use xlink:href="#icon-lx-note" />
              </svg>
            </span>
          </button>
          <router-link to="/search" :class="$style.brandLink">
            <strong :class="$style.brandText">LX Music</strong>
          </router-link>
        </div>
      </div>
      <NavBar />
    </div>
  </aside>
</template>

<script setup>
import { isSidebarCollapsed, toggleSidebarCollapsed } from '@renderer/store/ui'
import NavBar from './NavBar.vue'
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.host {
  -webkit-app-region: drag;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.panel {
  -webkit-app-region: drag;
  display: flex;
  flex-flow: column nowrap;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 14px 12px;
  box-sizing: border-box;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(248, 251, 255, 0.66));
  box-shadow: 0 10px 24px rgba(95, 116, 154, 0.08);
  overflow: hidden;
  contain: layout paint;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.brandRow {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 14px;
}

.brand {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.brandLink {
  min-width: 0;
  color: var(--shell-text, var(--color-font));
  text-decoration: none;
}

.logoBtn {
  width: 42px;
  height: 42px;
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}

.logo {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 82%, white), color-mix(in srgb, var(--color-primary) 54%, white 46%));
  color: #fff;
  box-shadow: 0 14px 28px color-mix(in srgb, var(--color-primary) 18%, transparent);

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
}

.brandText {
  display: block;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -.03em;
  white-space: nowrap;
  overflow: hidden;
}

.collapsed {
  background: transparent;
  box-shadow: none;

  .brandRow {
    justify-content: center;
  }

  .brand {
    justify-content: center;
  }

  .brandLink {
    display: none;
  }
}
</style>
