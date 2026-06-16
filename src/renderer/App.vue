<template>
  <div
    id="container"
    class="view-container"
    :class="[shellIsDark ? 'themeShellDark' : 'themeShellLight', { sidebarCollapsed: isSidebarCollapsed }]"
    :style="{
      '--sidebar-width': isSidebarCollapsed ? '80px' : '196px',
      '--player-window-gutter': '22px',
    }"
  >
    <div class="shellOrb shellOrbA" />
    <div class="shellOrb shellOrbB" />
    <div class="shellGrid" />
    <layout-aside id="left" />
    <div id="right">
      <layout-toolbar id="toolbar" />
      <div id="viewStage">
        <layout-view id="view" />
      </div>
    </div>
    <layout-play-bar id="player" />
    <layout-icons />
    <layout-change-log-modal />
    <layout-update-modal />
    <layout-pact-modal />
    <layout-sync-mode-modal />
    <layout-sync-auth-code-modal />
    <layout-play-detail />
  </div>
</template>

<script setup>
import { onMounted } from '@common/utils/vueTools'
// import BubbleCursor from '@common/utils/effects/cursor-effects/bubbleCursor'
// import '@common/utils/effects/snow.min'
import useApp from '@renderer/core/useApp'
import { shellIsDark } from '@renderer/store'
import { isSidebarCollapsed } from '@renderer/store/ui'

useApp()

onMounted(() => {
  document.getElementById('root').style.display = 'block'

  // const styles = getComputedStyle(document.documentElement)
  // window.lxData.bubbleCursor = new BubbleCursor({
  //   fillStyle: styles.getPropertyValue('--color-primary-alpha-900'),
  //   strokeStyle: styles.getPropertyValue('--color-primary-alpha-700'),
  // })
})

// onBeforeUnmount(() => {
//   window.lxData.bubbleCursor?.destroy()
// })

</script>


<style lang="less">
@import './assets/styles/index.less';
@import './assets/styles/layout.less';

html {
  height: 100vh;
}
html, body {
  // overflow: hidden;
  box-sizing: border-box;
}

body {
  user-select: none;
  height: 100%;
}
#root {
  height: 100%;
  position: relative;
  overflow: hidden;
  color: var(--color-font);
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  transition: background-color @transition-normal;
  background-color: var(--color-content-background);
  box-sizing: border-box;
}

.disableAnimation * {
  transition: none !important;
  animation: none !important;
}

.transparent {
  background: transparent;
  padding: @shadow-app;
  // #waiting-mask {
  //   border-radius: @radius-border;
  //   left: @shadow-app;
  //   right: @shadow-app;
  //   top: @shadow-app;
  //   bottom: @shadow-app;
  // }
  #body {
    border-radius: @radius-border;
  }
  #root {
    box-shadow: 0 0 @shadow-app rgba(0, 0, 0, 0.5);
    border-radius: @radius-border;
  }
  // #container {
    // border-radius: @radius-border;
    // background-color: transparent;
  // }
}
.disableTransparent {
  background-color: var(--color-content-background);

  #body {
    border: 1Px solid var(--color-primary-light-500);
  }

  #right {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  // #view { // 偏移5px距离解决非透明模式下右侧滚动条无法拖动的问题
  //   margin-right: 5Px;
  // }
}
.fullscreen {
  background-color: var(--color-content-background);

  #right {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
}

#container {
  position: relative;
  display: flex;
  gap: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  color: var(--shell-text);
  background-color: var(--shell-app-end, var(--color-content-background));
  background:
    radial-gradient(circle at top left, rgba(255, 151, 185, 0.26), transparent 30%),
    radial-gradient(circle at bottom right, rgba(82, 168, 255, 0.24), transparent 34%),
    linear-gradient(140deg, var(--shell-app-start), var(--shell-app-end));
}

#left {
  flex: none;
  width: var(--sidebar-width);
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  min-height: 0;
  z-index: 3;
  padding: 0;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--shell-accent) 24%, rgba(255, 255, 255, 0.26)), transparent 42%),
    radial-gradient(circle at 14% 82%, rgba(255, 255, 255, 0.22), transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--shell-surface-strong, rgba(255, 255, 255, 0.92)) 94%, transparent), color-mix(in srgb, var(--shell-surface-soft, rgba(241, 246, 255, 0.92)) 84%, transparent)),
    linear-gradient(90deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08) 62%, rgba(255, 255, 255, 0.02));
  backdrop-filter: blur(34px) saturate(142%);
  contain: layout style;
  will-change: width;
  transition: width .46s cubic-bezier(.2, 0, 0, 1);
}
#left::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.06) 18%, transparent 26%, transparent 76%, rgba(255, 255, 255, 0.1)),
    linear-gradient(90deg, rgba(255, 255, 255, 0.16), transparent 12%, transparent 88%, rgba(255, 255, 255, 0.06));
  mask-image:
    linear-gradient(180deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px)),
    linear-gradient(90deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px));
  mask-composite: intersect;
  -webkit-mask-image:
    linear-gradient(180deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px)),
    linear-gradient(90deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px));
  -webkit-mask-composite: source-in;
  opacity: .7;
  pointer-events: none;
}
#left::after {
  content: '';
  position: absolute;
  top: 12px;
  right: 0;
  bottom: 12px;
  width: 1px;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--shell-text) 12%, rgba(255, 255, 255, 0.3)), transparent);
  opacity: .12;
  pointer-events: none;
}
#right {
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  gap: 0;
  min-width: 0;
  min-height: 0;
  padding-bottom: 0;
  position: relative;
  z-index: 1;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--shell-surface, rgba(255, 255, 255, 0.82)) 26%, transparent), transparent 24%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04), transparent 12%);
}
#toolbar, #player {
  flex: none;
}
#toolbar {
  position: relative;
  z-index: 5;
}
#viewStage {
  position: relative;
  flex: auto;
  min-height: 0;
  z-index: 1;
  padding: 0;
}
#view {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}
#player {
  position: absolute;
  left: 50%;
  right: auto;
  bottom: 24px;
  width: min(calc(100% - (var(--player-window-gutter) * 2)), 1180px);
  z-index: 4;
  transform: translateX(-50%);
  transition: left @transition-normal, width @transition-normal, transform @transition-normal;
  pointer-events: auto;
}

.shellOrb {
  position: absolute;
  filter: blur(12px);
  pointer-events: none;
  z-index: 0;
}
.shellOrbA {
  inset: -12% auto auto -8%;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: var(--shell-accent-glow);
}
.shellOrbB {
  inset: auto -8% -16% auto;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: var(--shell-secondary-glow);
}
.shellGrid {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: .28;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 120px 120px;
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, .75), transparent 78%);
}

.view-container {
  transition: opacity @transition-normal, filter @transition-normal;
}
#root.show-modal > .view-container {
  opacity: .9;
}
#view.show-modal > .view-container {
  opacity: .2;
}
#root.show-modal-blur > .view-container,
#view.show-modal-blur > .view-container {
  opacity: 1;
  filter: blur(10px) saturate(116%);
}

.themeShellLight {
  --shell-app-start: #f5f8ff;
  --shell-app-end: #edf3ff;
  --shell-panel: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(246, 249, 255, 0.96));
  --shell-panel-shadow: 0 16px 34px rgba(108, 129, 167, 0.12);
  --shell-surface: rgba(255, 255, 255, 0.82);
  --shell-surface-strong: rgba(255, 255, 255, 0.94);
  --shell-surface-soft: rgba(248, 250, 255, 0.88);
  --shell-stroke: rgba(255, 255, 255, 0.72);
  --shell-text: #182236;
  --shell-muted: rgba(53, 71, 96, 0.68);
  --shell-soft-text: rgba(77, 92, 116, 0.88);
  --shell-accent: var(--color-primary);
  --shell-accent-glow: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 40%, transparent), transparent 72%);
  --shell-secondary-glow: radial-gradient(circle, rgba(106, 181, 255, 0.44), rgba(106, 181, 255, 0));
  --shell-player-shadow: 0 18px 44px rgba(91, 113, 153, 0.18);
  --shell-search-surface: rgba(255, 255, 255, 0.72);
  --shell-search-border: rgba(255, 255, 255, 0.82);
  --shell-card: rgba(255, 255, 255, 0.72);
  --shell-card-strong: rgba(255, 255, 255, 0.9);
  --shell-control: color-mix(in srgb, var(--color-primary) 12%, rgba(255, 255, 255, 0.86));
  --shell-control-border: color-mix(in srgb, var(--color-primary) 22%, rgba(255, 255, 255, 0.74));
  --shell-button-bg: rgba(255, 255, 255, 0.82);
  --shell-button-bg-hover: rgba(255, 255, 255, 0.94);
  --shell-button-text: #182236;
  --shell-scroll-track: rgba(255, 255, 255, 0.18);
  --shell-scroll-thumb: rgba(70, 92, 126, 0.32);
  --shell-scroll-thumb-hover: rgba(70, 92, 126, 0.48);
}

.themeShellDark {
  --shell-app-start: #050607;
  --shell-app-end: #101112;
  --shell-panel: linear-gradient(180deg, rgba(20, 22, 24, 0.96), rgba(8, 9, 10, 0.985));
  --shell-panel-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
  --shell-surface: rgba(22, 24, 27, 0.9);
  --shell-surface-strong: rgba(28, 30, 34, 0.96);
  --shell-surface-soft: rgba(18, 20, 23, 0.88);
  --shell-stroke: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.08));
  --shell-text: #f6f7f8;
  --shell-muted: rgba(222, 226, 230, 0.68);
  --shell-soft-text: rgba(235, 238, 241, 0.84);
  --shell-accent: var(--color-primary);
  --shell-accent-glow: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 34%, transparent), transparent 72%);
  --shell-secondary-glow: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 70%);
  --shell-player-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
  --shell-search-surface: rgba(255, 255, 255, 0.05);
  --shell-search-border: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.08));
  --shell-card: rgba(24, 26, 30, 0.82);
  --shell-card-strong: rgba(30, 32, 36, 0.94);
  --shell-control: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.055));
  --shell-control-border: color-mix(in srgb, var(--color-primary) 34%, rgba(255, 255, 255, 0.1));
  --shell-button-bg: rgba(255, 255, 255, 0.08);
  --shell-button-bg-hover: rgba(255, 255, 255, 0.13);
  --shell-button-text: #f7f8fa;
  --shell-scroll-track: rgba(255, 255, 255, 0.035);
  --shell-scroll-thumb: rgba(255, 255, 255, 0.18);
  --shell-scroll-thumb-hover: rgba(255, 255, 255, 0.28);
}

</style>
