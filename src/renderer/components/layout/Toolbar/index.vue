<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }]">
    <div :class="$style.searchSlot">
      <SearchInput />
    </div>
    <div :class="$style.actions">
      <LiquidGlassLayer variant="capsule" :interactive="true" :active="!isFullscreen" />
      <router-link to="/setting" :class="$style.settingBtn" :aria-label="t('setting')">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 493.23 436.47" width="16" height="16" space="preserve">
          <use xlink:href="#icon-setting" />
        </svg>
      </router-link>
      <ControlBtns />
    </div>
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { useI18n } from '@renderer/plugins/i18n'
import LiquidGlassLayer from '@renderer/components/common/liquidGlass/LiquidGlassLayer.vue'
import ControlBtns from './ControlBtns.vue'
import SearchInput from './SearchInput.vue'

const t = useI18n()
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.toolbar {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px 12px;
  -webkit-app-region: drag;
  z-index: 2;
  color: var(--shell-text, var(--color-font));

  &.fullscreen {
    -webkit-app-region: no-drag;
  }
}

.searchSlot {
  flex: auto;
  min-width: 0;
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  min-height: 54px;
  padding: 8px 12px 8px 14px;
  border-radius: 999px;
  overflow: hidden;
  isolation: isolate;
  -webkit-app-region: no-drag;

  > * {
    position: relative;
    z-index: 1;
  }
}

.settingBtn {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-text, var(--color-font));
  background: rgba(255, 255, 255, 0.06);
  box-shadow: none;
  transition: transform .22s ease-out, opacity .22s ease-out, background-color .22s ease-out;

  &:hover {
    opacity: .86;
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.14);
  }
}

</style>
