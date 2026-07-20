<template>
  <div :class="$style.control">
    <button type="button" :class="[$style.btn, $style.min]" :aria-label="$t('min')" @click="minWindow">
      <span />
    </button>
    <button
      type="button"
      :class="[$style.btn, $style.fullscreen]"
      :aria-label="$t(isFullscreen ? 'fullscreen_exit' : 'fullscreen')"
      :title="$t(isFullscreen ? 'fullscreen_exit' : 'fullscreen')"
      @click="toggleFullscreen"
    >
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
        <use :xlink:href="isFullscreen ? '#icon-window-restore-2' : '#icon-window-maximize-2'" />
      </svg>
    </button>
    <button type="button" :class="[$style.btn, $style.close]" :aria-label="$t('close_window')" @click="closeWindow">
      <span />
    </button>
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { closeWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'

const toggleFullscreen = () => {
  void setFullScreen(!isFullscreen.value).then(fullscreen => {
    isFullscreen.value = fullscreen
  })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.control {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.btn {
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform @transition-fast, opacity @transition-fast, filter @transition-fast;

  span,
  svg {
    display: block;
  }

  span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.28);
    opacity: 0;
    transition: opacity @transition-fast;
  }

  svg {
    width: 9px;
    height: 9px;
    stroke: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity @transition-fast;
  }

  &:hover {
    transform: translateY(-1px);
    filter: saturate(112%);

    span,
    svg {
      opacity: 1;
    }
  }
}

.min {
  background: #ffbf2f;
}

.fullscreen {
  background: #2ecb4f;
}

.close {
  background: #ff6058;
}
</style>
