<template>
  <aside :class="$style.host">
    <div :class="[$style.panel, { [$style.collapsed]: isSidebarCollapsed }]">
      <div :class="$style.brandRow">
        <div :class="$style.brand">
          <button type="button" :class="$style.logoBtn" :title="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="toggleSidebarCollapsed">
            <span :class="$style.logo">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M15.8 3.7c.58-.12 1.12.32 1.12.91v10.48a3.42 3.42 0 1 1-1.96-3.1V7.54L9 8.77v8.8a3.42 3.42 0 1 1-1.96-3.1V7.42c0-.45.32-.85.76-.94l8-1.78Z" />
              </svg>
            </span>
          </button>
          <router-link to="/search" :class="$style.brandLink">
            <strong :class="$style.brandText">LX MUSIC</strong>
          </router-link>
        </div>
      </div>
      <NavBar />
      <NowPlayingList />
    </div>
  </aside>
</template>

<script setup>
import { isSidebarCollapsed, toggleSidebarCollapsed } from '@renderer/store/ui'
import NavBar from './NavBar.vue'
import NowPlayingList from './NowPlayingList.vue'
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
  --sidebar-icon-lane: 44px;
  --sidebar-logo-size: 34px;
  --sidebar-icon-glyph-size: 16px;
  --sidebar-item-height: 40px;
  --sidebar-item-radius: 12px;
  --sidebar-panel-x: 16px;
  --sidebar-motion-duration: .46s;
  --sidebar-motion-curve: cubic-bezier(.2, 0, 0, 1);
  -webkit-app-region: drag;
  display: flex;
  flex-flow: column nowrap;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 22px var(--sidebar-panel-x) 20px;
  box-sizing: border-box;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: hidden;
  contain: layout style;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.brandRow {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: var(--sidebar-icon-lane);
  min-height: var(--sidebar-icon-lane);
  margin-bottom: 22px;
  overflow: visible;
}

.brand {
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-columns: var(--sidebar-icon-lane) minmax(0, 1fr);
  align-items: center;
  height: var(--sidebar-icon-lane);
  min-height: var(--sidebar-icon-lane);
  gap: 12px;
  transition: gap var(--sidebar-motion-duration) var(--sidebar-motion-curve);
}

.brandLink {
  min-width: 0;
  max-width: 100%;
  color: var(--shell-text, var(--color-font));
  text-decoration: none;
  opacity: 1;
  transform: translateX(0);
  transition: max-width var(--sidebar-motion-duration) var(--sidebar-motion-curve), opacity .28s ease, transform var(--sidebar-motion-duration) var(--sidebar-motion-curve);
}

.logoBtn {
  position: relative;
  width: var(--sidebar-icon-lane);
  height: var(--sidebar-icon-lane);
  min-width: var(--sidebar-icon-lane);
  min-height: var(--sidebar-icon-lane);
  box-sizing: border-box;
  line-height: 0;
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  appearance: none;
  flex: none;
  justify-self: start;
}

.logo {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  width: var(--sidebar-logo-size);
  height: var(--sidebar-logo-size);
  min-width: var(--sidebar-logo-size);
  min-height: var(--sidebar-logo-size);
  flex: 0 0 var(--sidebar-logo-size);
  max-width: var(--sidebar-logo-size);
  max-height: var(--sidebar-logo-size);
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  border-radius: var(--sidebar-item-radius);
  corner-shape: squircle;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, color-mix(in srgb, var(--color-primary) 80%, white), color-mix(in srgb, var(--color-primary) 58%, white 42%));
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, rgba(255, 255, 255, 0.76));
  color: #fff;
  overflow: hidden;

  svg {
    width: 18px;
    height: 18px;
    flex: none;
    display: block;
    transform-origin: center;
    fill: currentColor;
  }
}

.brandText {
  display: block;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
}

.collapsed {
  background: transparent;
  box-shadow: none;

  .brand {
    gap: 0;
  }

  .brandLink {
    max-width: 0;
    opacity: 0;
    transform: translateX(-6px);
  }
}
</style>
