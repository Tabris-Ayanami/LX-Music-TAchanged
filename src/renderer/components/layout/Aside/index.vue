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
  padding: 14px 14px 14px 12px;
  box-sizing: border-box;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
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
  overflow: hidden;
}

.brand {
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.brandLink {
  min-width: 0;
  max-width: 100%;
  color: var(--shell-text, var(--color-font));
  text-decoration: none;
  opacity: 1;
  transform: translateX(0);
  transition: max-width @transition-fast, opacity @transition-fast, transform @transition-fast;
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
  justify-self: start;
}

.logo {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 80%, white), color-mix(in srgb, var(--color-primary) 58%, white 42%));
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, rgba(255, 255, 255, 0.76));
  color: #fff;
  overflow: visible;

  svg {
    width: 20px;
    height: 20px;
    display: block;
    transform-origin: center;
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

  .brandLink {
    max-width: 0;
    opacity: 0;
    transform: translateX(-6px);
  }
}
</style>
