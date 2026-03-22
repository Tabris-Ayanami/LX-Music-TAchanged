<template>
  <div :class="$style.footer">
    <div :class="$style.mainRow">
      <div :class="$style.playControl">
        <div :class="$style.playBtn" :aria-label="$t('player__prev')" @click="playPrev()">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-prevMusic" />
          </svg>
        </div>
        <div :class="$style.playBtn" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
          <svg v-if="isPlay" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-pause" />
          </svg>
          <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-play" />
          </svg>
        </div>
        <div :class="$style.playBtn" :aria-label="$t('player__next')" @click="playNext()">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-nextMusic" />
          </svg>
        </div>
      </div>
    </div>
    <div :class="$style.progressRow">
      <div :class="$style.progressContainer">
        <div :class="$style.progressContent">
          <common-progress-bar
            :class-name="$style.progress"
            :progress="progress"
            :handle-transition-end="handleTransitionEnd"
            :is-active-transition="isActiveTransition"
          />
        </div>
      </div>
    </div>
    <div :class="$style.timeRow">
      <div :class="$style.timeLabel">
        <span>{{ nowPlayTimeStr }}</span>
        <span :class="$style.timeSplit">/</span>
        <span>{{ maxPlayTimeStr }}</span>
      </div>
    </div>
    <div :class="$style.extraRow">
      <control-btns mode="extra" />
    </div>
  </div>
</template>

<script setup>
import { playNext, playPrev, togglePlay } from '@renderer/core/player'
import { isPlay } from '@renderer/store/player/state'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import ControlBtns from './components/ControlBtns.vue'

const {
  nowPlayTimeStr,
  maxPlayTimeStr,
  progress,
  isActiveTransition,
  handleTransitionEnd,
} = usePlayProgress()
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footer {
  display: grid;
  grid-template-rows: auto auto auto auto;
  gap: 8px;
  padding-top: 6px;
}

.mainRow,
.progressRow,
.timeRow,
.extraRow {
  width: 100%;
}

.mainRow {
  display: flex;
  justify-content: center;
  align-items: center;
}

.progressRow {
  display: block;
}

.timeRow {
  display: flex;
  justify-content: center;
  align-items: center;
}

.extraRow {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px;
}

.progressContainer {
  width: 100%;
  min-width: 0;
}

.progressContent {
  position: relative;
  height: 12px;
  padding: 2px 0;
  width: 100%;
}

.progress {
  height: 100%;
}

.timeLabel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.82);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.26);

  span {
    font-size: 11px;
  }
}

.timeSplit {
  opacity: .7;
}

.playControl {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--color-button-font);
}

.playBtn {
  width: 42px;
  height: 42px;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.95);
  transition: background-color .2s ease, transform .2s ease, opacity .2s ease;

  svg {
    width: 48%;
    fill: currentColor;
    overflow: visible;
    filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.18));
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.14);
  }

  &:active {
    opacity: .86;
    transform: scale(.96);
  }

  &:nth-child(2) {
    width: 58px;
    height: 58px;
    background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 68%, white 32%));
    color: #fff;
    box-shadow: 0 20px 40px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 28%, transparent);

    svg {
      width: 44%;
      filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.18));
      transform: translateX(2px);
    }
  }
}

@media (max-width: 920px) {
  .mainRow {
    justify-content: center;
  }

  .progressRow {
    width: 100%;
  }

  .playBtn {
    width: 38px;
    height: 38px;

    &:nth-child(2) {
      width: 52px;
      height: 52px;
    }
  }
}
</style>
