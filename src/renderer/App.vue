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
    <layout-change-log-modal v-if="isShowChangeLog" />
    <layout-update-modal v-if="versionInfo.showModal" />
    <layout-pact-modal v-if="!appSetting['common.isAgreePact'] || isShowPact" />
    <layout-sync-mode-modal v-if="sync.isShowSyncMode" />
    <layout-sync-auth-code-modal v-if="sync.isShowAuthCodeModal" />
    <layout-play-detail v-if="isPlayDetailMounted" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from '@common/utils/vueTools'
// import BubbleCursor from '@common/utils/effects/cursor-effects/bubbleCursor'
// import '@common/utils/effects/snow.min'
import useApp from '@renderer/core/useApp'
import { isShowChangeLog, isShowPact, shellIsDark, sync, versionInfo } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { isShowPlayerDetail } from '@renderer/store/player/state'
import { isSidebarCollapsed } from '@renderer/store/ui'

useApp()

const isPlayDetailMounted = ref(isShowPlayerDetail.value)

watch(isShowPlayerDetail, show => {
  if (show) isPlayDetailMounted.value = true
})

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
    radial-gradient(ellipse at 18% 0%, var(--shell-album-wash-a), transparent 38%),
    radial-gradient(ellipse at 84% 92%, var(--shell-album-wash-b), transparent 42%),
    linear-gradient(180deg, var(--shell-grain-top), transparent 46%),
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
  z-index: 1;
  padding: 0;
  background:
    radial-gradient(120% 90% at 0% 0%, var(--shell-sidebar-glow), transparent 58%),
    linear-gradient(155deg, var(--shell-sidebar-highlight), transparent 52%),
    var(--shell-sidebar-panel, var(--shell-panel)),
    linear-gradient(90deg, var(--shell-edge-light), transparent 68%);
  backdrop-filter: blur(38px) saturate(156%);
  -webkit-backdrop-filter: blur(38px) saturate(156%);
  box-shadow: var(--shell-panel-shadow);
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
    linear-gradient(180deg, var(--shell-glass-sheen), transparent 30%, transparent 76%, var(--shell-glass-foot)),
    linear-gradient(90deg, var(--shell-edge-light), transparent 14%, transparent 88%, var(--shell-edge-shadow));
  mask-image:
    linear-gradient(180deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px)),
    linear-gradient(90deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px));
  mask-composite: intersect;
  -webkit-mask-image:
    linear-gradient(180deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px)),
    linear-gradient(90deg, #000 0 14px, transparent 40px calc(100% - 40px), #000 calc(100% - 14px));
  -webkit-mask-composite: source-in;
  opacity: var(--shell-panel-sheen-opacity);
  pointer-events: none;
}
#left::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background:
    linear-gradient(180deg, transparent 0, var(--shell-divider) 12%, var(--shell-divider) 88%, transparent 100%);
  opacity: .62;
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
  z-index: 2;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--shell-surface, rgba(255, 255, 255, 0.82)) 34%, transparent), transparent 28%),
    linear-gradient(90deg, var(--shell-stage-edge), transparent 14%);
}
#right::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 0;
  width: 4px;
  background:
    linear-gradient(90deg, var(--shell-main-edge-highlight), transparent 1px),
    linear-gradient(90deg, var(--shell-main-edge-shadow), transparent 100%);
  pointer-events: none;
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
  filter: blur(18px);
  pointer-events: none;
  z-index: 0;
  opacity: var(--shell-ambient-opacity);
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
  opacity: var(--shell-grid-opacity);
  pointer-events: none;
  background-image:
    linear-gradient(var(--shell-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--shell-grid-line) 1px, transparent 1px);
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
  --shell-app-start: #f4f7fb;
  --shell-app-end: #eaf0f8;
  --shell-grain-top: rgba(255, 255, 255, 0.64);
  --shell-panel: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(244, 248, 253, 0.9));
  --shell-panel-highlight: rgba(255, 255, 255, 0.56);
  --shell-panel-shadow: inset -2px 0 4px rgba(76, 96, 128, 0.08), inset -1px 0 0 rgba(69, 88, 118, 0.1), inset 1px 0 0 rgba(255, 255, 255, 0.36);
  --shell-sidebar-panel: linear-gradient(180deg, rgba(232, 240, 251, 0.74), rgba(217, 228, 243, 0.66));
  --shell-sidebar-highlight: rgba(255, 255, 255, 0.46);
  --shell-sidebar-glow: color-mix(in srgb, var(--color-primary) 16%, rgba(141, 170, 210, 0.18));
  --shell-panel-sheen-opacity: .72;
  --shell-surface: rgba(255, 255, 255, 0.72);
  --shell-surface-strong: rgba(255, 255, 255, 0.9);
  --shell-surface-soft: rgba(246, 249, 253, 0.78);
  --shell-stroke: rgba(255, 255, 255, 0.76);
  --shell-text: #1e2736;
  --shell-muted: rgba(58, 73, 96, 0.7);
  --shell-soft-text: rgba(68, 84, 106, 0.86);
  --shell-divider: rgba(73, 92, 122, 0.18);
  --shell-edge-light: rgba(255, 255, 255, 0.26);
  --shell-edge-shadow: rgba(92, 112, 144, 0.08);
  --shell-glass-sheen: rgba(255, 255, 255, 0.34);
  --shell-glass-foot: rgba(255, 255, 255, 0.12);
  --shell-stage-edge: rgba(255, 255, 255, 0.1);
  --shell-main-edge-highlight: rgba(255, 255, 255, 0.34);
  --shell-main-edge-shadow: rgba(78, 99, 132, 0.08);
  --shell-accent: var(--color-primary);
  --shell-accent-glow: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 34%, transparent), transparent 72%);
  --shell-secondary-glow: radial-gradient(circle, rgba(102, 155, 218, 0.34), rgba(102, 155, 218, 0));
  --shell-album-wash-a: color-mix(in srgb, var(--color-primary) 20%, rgba(255, 255, 255, 0.1));
  --shell-album-wash-b: rgba(100, 143, 198, 0.22);
  --shell-ambient-opacity: .72;
  --shell-grid-opacity: .18;
  --shell-grid-line: rgba(71, 92, 120, 0.08);
  --shell-player-shadow: 0 20px 52px rgba(76, 99, 133, 0.16);
  --shell-search-surface: rgba(255, 255, 255, 0.68);
  --shell-search-border: rgba(255, 255, 255, 0.78);
  --shell-card: rgba(255, 255, 255, 0.66);
  --shell-card-strong: rgba(255, 255, 255, 0.86);
  --shell-card-border: rgba(255, 255, 255, 0.7);
  --shell-card-shadow: 0 14px 34px rgba(74, 94, 126, 0.13), inset 0 1px 0 rgba(255, 255, 255, 0.55);
  --shell-control: color-mix(in srgb, var(--color-primary) 10%, rgba(255, 255, 255, 0.82));
  --shell-control-border: color-mix(in srgb, var(--color-primary) 20%, rgba(255, 255, 255, 0.72));
  --shell-button-bg: rgba(255, 255, 255, 0.76);
  --shell-button-bg-hover: rgba(255, 255, 255, 0.92);
  --shell-button-text: #182236;
  --shell-list-hover: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.72));
  --shell-list-active: color-mix(in srgb, var(--color-primary) 26%, rgba(255, 255, 255, 0.78));
  --shell-scroll-track: rgba(255, 255, 255, 0.18);
  --shell-scroll-thumb: rgba(70, 92, 126, 0.32);
  --shell-scroll-thumb-hover: rgba(70, 92, 126, 0.48);
}

.themeShellDark {
  --shell-app-start: #141820;
  --shell-app-end: #0d1016;
  --shell-grain-top: rgba(255, 255, 255, 0.025);
  --shell-panel: linear-gradient(180deg, rgba(33, 37, 46, 0.82), rgba(19, 22, 29, 0.9));
  --shell-panel-highlight: color-mix(in srgb, var(--color-primary) 12%, rgba(255, 255, 255, 0.06));
  --shell-panel-shadow: inset -2px 0 4px rgba(0, 0, 0, 0.22), inset -1px 0 0 rgba(0, 0, 0, 0.24), inset 1px 0 0 rgba(255, 255, 255, 0.035);
  --shell-sidebar-panel: linear-gradient(180deg, rgba(42, 48, 60, 0.62), rgba(25, 30, 40, 0.72));
  --shell-sidebar-highlight: color-mix(in srgb, var(--color-primary) 16%, rgba(255, 255, 255, 0.045));
  --shell-sidebar-glow: color-mix(in srgb, var(--color-primary) 18%, rgba(62, 84, 112, 0.2));
  --shell-panel-sheen-opacity: .45;
  --shell-surface: rgba(28, 32, 40, 0.72);
  --shell-surface-strong: rgba(37, 42, 52, 0.86);
  --shell-surface-soft: rgba(22, 26, 34, 0.68);
  --shell-stroke: color-mix(in srgb, var(--color-primary) 20%, rgba(255, 255, 255, 0.13));
  --shell-text: #eef3f7;
  --shell-muted: rgba(202, 211, 222, 0.66);
  --shell-soft-text: rgba(219, 226, 234, 0.78);
  --shell-divider: rgba(220, 230, 242, 0.11);
  --shell-edge-light: rgba(255, 255, 255, 0.07);
  --shell-edge-shadow: rgba(0, 0, 0, 0.16);
  --shell-glass-sheen: rgba(255, 255, 255, 0.1);
  --shell-glass-foot: rgba(255, 255, 255, 0.035);
  --shell-stage-edge: rgba(255, 255, 255, 0.03);
  --shell-main-edge-highlight: rgba(255, 255, 255, 0.045);
  --shell-main-edge-shadow: rgba(0, 0, 0, 0.16);
  --shell-accent: var(--color-primary);
  --shell-accent-glow: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 28%, rgba(92, 139, 190, 0.1)), transparent 72%);
  --shell-secondary-glow: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 14%, rgba(116, 151, 193, 0.12)), transparent 70%);
  --shell-album-wash-a: color-mix(in srgb, var(--color-primary) 16%, rgba(57, 82, 112, 0.18));
  --shell-album-wash-b: rgba(42, 58, 78, 0.38);
  --shell-ambient-opacity: .48;
  --shell-grid-opacity: .13;
  --shell-grid-line: rgba(225, 235, 245, 0.04);
  --shell-player-shadow: 0 24px 60px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.035);
  --shell-search-surface: rgba(33, 38, 48, 0.58);
  --shell-search-border: color-mix(in srgb, var(--color-primary) 22%, rgba(255, 255, 255, 0.13));
  --shell-card: rgba(31, 36, 46, 0.66);
  --shell-card-strong: rgba(42, 48, 60, 0.82);
  --shell-card-border: rgba(255, 255, 255, 0.09);
  --shell-card-shadow: 0 16px 40px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  --shell-control: color-mix(in srgb, var(--color-primary) 16%, rgba(255, 255, 255, 0.075));
  --shell-control-border: color-mix(in srgb, var(--color-primary) 34%, rgba(255, 255, 255, 0.12));
  --shell-button-bg: rgba(255, 255, 255, 0.095);
  --shell-button-bg-hover: rgba(255, 255, 255, 0.16);
  --shell-button-text: #f7f8fa;
  --shell-list-hover: color-mix(in srgb, var(--color-primary) 22%, rgba(255, 255, 255, 0.075));
  --shell-list-active: color-mix(in srgb, var(--color-primary) 34%, rgba(255, 255, 255, 0.105));
  --shell-scroll-track: rgba(255, 255, 255, 0.045);
  --shell-scroll-thumb: rgba(235, 242, 249, 0.19);
  --shell-scroll-thumb-hover: rgba(235, 242, 249, 0.31);
}

</style>
