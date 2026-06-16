<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }]">
    <div :class="$style.searchSlot">
      <SearchInput />
    </div>
    <div :class="$style.actions">
      <SunMoonToggle />
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
import ControlBtns from './ControlBtns.vue'
import SearchInput from './SearchInput.vue'
import SunMoonToggle from './SunMoonToggle.vue'

const t = useI18n()
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.toolbar {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 16px 7px 18px;
  -webkit-app-region: drag;
  z-index: 2;
  color: var(--shell-text, var(--color-font));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--shell-surface-strong, rgba(255, 255, 255, 0.88)) 78%, transparent), color-mix(in srgb, var(--shell-surface-soft, rgba(246, 249, 255, 0.78)) 52%, transparent)),
    linear-gradient(90deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.04));
  border-bottom: 1px solid color-mix(in srgb, var(--shell-text, #182236) 8%, rgba(255, 255, 255, 0.32));
  box-shadow: 0 10px 26px rgba(45, 62, 92, 0.08);
  backdrop-filter: blur(34px) saturate(170%);
  -webkit-backdrop-filter: blur(34px) saturate(170%);

  &.fullscreen {
    -webkit-app-region: no-drag;
  }
}

.searchSlot {
  flex: 0 1 360px;
  max-width: 380px;
  min-width: 0;
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0;
  -webkit-app-region: no-drag;
}

.settingBtn {
  width: 30px;
  height: 30px;
  border-radius: 11px;
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
