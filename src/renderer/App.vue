<template>
  <div
    id="container"
    class="view-container"
    :class="[themeShouldUseDarkColors ? 'themeShellDark' : 'themeShellLight', { sidebarCollapsed: isSidebarCollapsed }]"
    :style="{ '--sidebar-width': isSidebarCollapsed ? '64px' : '136px' }"
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
import { themeShouldUseDarkColors } from '@renderer/store'
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
  gap: 12px;
  padding: 12px;
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
  position: relative;
  z-index: 3;
}
#right {
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding-bottom: 116px;
  position: relative;
  z-index: 1;
}
#toolbar, #player {
  flex: none;
}
#viewStage {
  position: relative;
  flex: auto;
  min-height: 0;
  z-index: 1;
}
#view {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--shell-stroke);
  background: var(--shell-panel);
  box-shadow: var(--shell-panel-shadow);
}
#player {
  position: absolute;
  left: calc(var(--sidebar-width) + 24px);
  right: 12px;
  bottom: 28px;
  width: auto;
  z-index: 4;
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
  transition: opacity @transition-normal;
}
#root.show-modal > .view-container {
  opacity: .9;
}
#view.show-modal > .view-container {
  opacity: .2;
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
}

.themeShellDark {
  --shell-app-start: #09110f;
  --shell-app-end: #101a18;
  --shell-panel: linear-gradient(180deg, rgba(14, 22, 21, 0.96), rgba(10, 17, 16, 0.985));
  --shell-panel-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
  --shell-surface: rgba(19, 28, 27, 0.9);
  --shell-surface-strong: rgba(21, 31, 29, 0.96);
  --shell-surface-soft: rgba(25, 36, 34, 0.86);
  --shell-stroke: rgba(255, 255, 255, 0.08);
  --shell-text: #f4f7f5;
  --shell-muted: rgba(216, 225, 221, 0.68);
  --shell-soft-text: rgba(235, 243, 239, 0.84);
  --shell-accent: var(--color-primary);
  --shell-accent-glow: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 72%);
  --shell-secondary-glow: radial-gradient(circle, rgba(74, 163, 255, 0.3), rgba(74, 163, 255, 0));
  --shell-player-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
  --shell-search-surface: rgba(255, 255, 255, 0.05);
  --shell-search-border: rgba(255, 255, 255, 0.08);
}

</style>
