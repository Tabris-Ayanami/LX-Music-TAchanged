<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }]">
    <div :class="$style.searchSlot">
      <SearchInput />
    </div>
    <div :class="$style.lyricSlot" :title="currentLyric">
      <span v-if="currentLyric">{{ currentLyric }}</span>
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
import { computed } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { lyric } from '@renderer/store/player/lyric'
import { useI18n } from '@renderer/plugins/i18n'
import ControlBtns from './ControlBtns.vue'
import SearchInput from './SearchInput.vue'
import SunMoonToggle from './SunMoonToggle.vue'

const t = useI18n()
const currentLyric = computed(() => {
  return lyric.text.trim()
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) auto;
  min-height: 48px;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 7px 18px;
  -webkit-app-region: drag;
  z-index: 2;
  color: var(--shell-text, var(--color-font));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--shell-surface-strong, rgba(255, 255, 255, 0.88)) 82%, transparent), color-mix(in srgb, var(--shell-surface-soft, rgba(246, 249, 255, 0.78)) 58%, transparent)),
    linear-gradient(90deg, var(--shell-edge-light, rgba(255, 255, 255, 0.22)), transparent);
  border-bottom: 1px solid var(--shell-divider, color-mix(in srgb, var(--shell-text, #182236) 8%, rgba(255, 255, 255, 0.32)));
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(34px) saturate(170%);
  -webkit-backdrop-filter: blur(34px) saturate(170%);

  &.fullscreen {
    -webkit-app-region: no-drag;
  }
}

.searchSlot {
  width: 100%;
  max-width: 300px;
  min-width: 0;
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.lyricSlot {
  min-width: 0;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  color: color-mix(in srgb, var(--shell-text, var(--color-font)) 52%, transparent);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  text-align: center;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.22);
  pointer-events: none;
  overflow: hidden;

  span {
    display: block;
    max-width: min(100%, 560px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0;
  -webkit-app-region: no-drag;
}

:global(.themeShellDark) {
  .lyricSlot {
    color: color-mix(in srgb, var(--shell-text, var(--color-font)) 45%, transparent);
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  }
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
  background: var(--shell-button-bg, rgba(255, 255, 255, 0.06));
  box-shadow: none;
  transition: transform .22s ease-out, opacity .22s ease-out, background-color .22s ease-out;

  &:hover {
    opacity: .86;
    transform: translateY(-1px);
    background: var(--shell-button-bg-hover, rgba(255, 255, 255, 0.14));
  }
}

</style>
