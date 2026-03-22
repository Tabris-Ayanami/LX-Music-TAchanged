<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }, appSetting['common.controlBtnPosition'] == 'left' ? $style.controlBtnLeft : $style.controlBtnRight]">
    <div :class="$style.searchSlot">
      <SearchInput />
    </div>
    <div :class="$style.actions">
      <router-link to="/setting" :class="$style.settingBtn" :aria-label="t('setting')">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 493.23 436.47" width="16" height="16" space="preserve">
          <use xlink:href="#icon-setting" />
        </svg>
      </router-link>
      <ControlBtns v-if="appSetting['common.controlBtnPosition'] != 'left'" />
    </div>
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { useI18n } from '@renderer/plugins/i18n'
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
  gap: 10px;
  padding: 0 4px;
  -webkit-app-region: drag;
  z-index: 2;
  color: var(--shell-text, var(--color-font));

  &.fullscreen {
    -webkit-app-region: no-drag;
  }

  &.controlBtnLeft {
    .actions {
      justify-content: flex-end;
    }
  }

  &.controlBtnRight {
    justify-content: flex-start;
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
  gap: 10px;
  -webkit-app-region: no-drag;
}

.settingBtn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-text, var(--color-font));
  background: var(--shell-surface, rgba(255, 255, 255, 0.68));
  transition: @transition-fast;
  transition-property: transform, opacity, background-color;

  &:hover {
    opacity: .86;
    transform: translateY(-1px);
  }
}

</style>
