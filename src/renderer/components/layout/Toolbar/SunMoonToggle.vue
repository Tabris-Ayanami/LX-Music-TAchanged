<template>
  <button
    type="button"
    :class="[$style.hitArea, { [$style.night]: isNight }]"
    :aria-label="isNight ? t('theme_selector_modal__light_title') : t('theme_selector_modal__dark_title')"
    :aria-pressed="isNight"
    @click="toggleTheme"
  >
    <span :class="$style.switch" aria-hidden="true">
      <span :class="$style.sky">
        <span :class="$style.stars">
          <span v-for="star in stars" :key="star.id" :class="$style.star" :style="star.style" />
        </span>
        <span :class="$style.clouds">
          <span v-for="cloud in clouds" :key="cloud.id" :class="$style.cloud" :style="cloud.style" />
        </span>
      </span>
      <span :class="$style.halo" />
      <span :class="$style.orb">
        <span :class="$style.moon">
          <span :class="$style.crater" />
          <span :class="$style.crater" />
          <span :class="$style.crater" />
        </span>
      </span>
    </span>
  </button>
</template>

<script setup>
import { useI18n } from '@renderer/plugins/i18n'
import { shellIsDark } from '@renderer/store'

const t = useI18n()

const stars = [
  { id: 1, style: { top: '22%', left: '18%', '--scale': '.72' } },
  { id: 2, style: { top: '38%', left: '31%', '--scale': '.46' } },
  { id: 3, style: { top: '21%', left: '48%', '--scale': '.56' } },
  { id: 4, style: { top: '63%', left: '22%', '--scale': '.42' } },
  { id: 5, style: { top: '68%', left: '44%', '--scale': '.64' } },
]

const clouds = [
  { id: 1, style: { '--size': '13px', right: '2px', bottom: '-4px' } },
  { id: 2, style: { '--size': '16px', right: '13px', bottom: '-7px' } },
  { id: 3, style: { '--size': '11px', right: '28px', bottom: '-5px' } },
]

const isNight = shellIsDark

const toggleTheme = () => {
  shellIsDark.value = !shellIsDark.value
}
</script>

<style lang="less" module>
.hitArea {
  width: 64px;
  height: 44px;
  border: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 64px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--shell-accent, var(--color-primary)) 72%, white);
    outline-offset: 2px;
    border-radius: 14px;
  }

  &:hover .switch {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(33, 46, 76, 0.22);
  }

  &:active .switch {
    transform: translateY(0) scale(0.96);
  }
}

.switch {
  --toggle-height: 24px;
  --toggle-width: 58px;
  --orb-size: 20px;
  --orb-offset: 2px;

  position: relative;
  width: var(--toggle-width);
  height: var(--toggle-height);
  display: block;
  overflow: hidden;
  border-radius: 999px;
  background: #5fa8e8;
  box-shadow: inset 0 1px 3px rgba(8, 20, 34, 0.32), 0 5px 12px rgba(33, 46, 76, 0.16);
  transition: transform .22s ease-out, box-shadow .22s ease-out, background-color .26s ease-out;
}

.sky,
.stars,
.clouds,
.halo,
.orb,
.moon {
  position: absolute;
  inset: 0;
}

.sky {
  transition: background-color .26s ease-out;
}

.stars {
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity .22s ease-out, transform .26s cubic-bezier(.2, .9, .2, 1);
}

.star {
  position: absolute;
  width: 4px;
  height: 4px;
  transform: scale(var(--scale));

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
  }

  &::after {
    transform: scaleX(0.34) scaleY(1.8);
  }
}

.clouds {
  transform: translateY(0);
  transition: transform .28s cubic-bezier(.2, .9, .2, 1), opacity .22s ease-out;
}

.cloud {
  position: absolute;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: -9px 3px 0 rgba(255, 255, 255, 0.82), 8px 4px 0 rgba(213, 233, 250, 0.78);
}

.halo {
  width: 32px;
  height: 32px;
  top: 50%;
  left: var(--orb-offset);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  transform: translateY(-50%);
  transition: transform .28s cubic-bezier(.2, .9, .2, 1);
}

.orb {
  width: var(--orb-size);
  height: var(--orb-size);
  top: 2px;
  left: var(--orb-offset);
  border-radius: 50%;
  overflow: hidden;
  background: #ffd860;
  box-shadow: inset 3px 3px 4px rgba(255, 255, 255, 0.72), inset -3px -4px 7px rgba(119, 75, 21, 0.32), 2px 3px 7px rgba(13, 25, 43, 0.26);
  transform: translateX(0);
  transition: transform .28s cubic-bezier(.2, .9, .2, 1), background-color .18s ease-out;
  z-index: 2;
}

.moon {
  opacity: 0;
  background: #cdd4df;
  border-radius: 50%;
  transform: translateX(70%);
  transition: opacity .18s ease-out, transform .2s ease-out;
}

.crater {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #9aa5b4;
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.28);

  &:nth-child(1) {
    top: 5px;
    left: 8px;
  }

  &:nth-child(2) {
    width: 6px;
    height: 6px;
    top: 11px;
    left: 4px;
  }

  &:nth-child(3) {
    top: 12px;
    left: 13px;
  }
}

.night {
  .switch {
    background: #1d2744;
  }

  .stars {
    opacity: 1;
    transform: translateY(0);
  }

  .clouds {
    opacity: 0;
    transform: translateY(12px);
  }

  .halo {
    transform: translate(calc(var(--toggle-width) - 34px), -50%);
  }

  .orb {
    background: #cdd4df;
    transform: translateX(calc(var(--toggle-width) - var(--orb-size) - (var(--orb-offset) * 2)));
  }

  .moon {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hitArea *,
  .hitArea *::before,
  .hitArea *::after {
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
