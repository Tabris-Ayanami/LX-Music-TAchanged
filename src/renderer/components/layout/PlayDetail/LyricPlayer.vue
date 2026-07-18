<template>
  <div :class="['right', $style.right]" :style="lrcFontSize">
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div
        v-show="!isShowLrcSelectContent"
        ref="dom_lyric"
        :class="['lyric', $style.lyric, { [$style.draging]: isMsDown }, { [$style.lrcActiveZoom]: isZoomActiveLrc }]" :style="lrcStyles"
        @wheel="handleWheel" @mousedown="handleLyricMouseDown" @touchstart="handleLyricTouchStart"
        @contextmenu.stop="handleShowLyricMenu"
      >
        <div :class="['pre', $style.lyricSpace]" />
        <div ref="dom_lyric_text" />
        <div :class="$style.lyricSpace" />
      </div>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLyricProgressSetting" v-show="isStopScroll && !isShowLrcSelectContent" :class="$style.skip">
        <div ref="dom_skip_line" :class="$style.line" />
        <base-btn
          :class="$style.skipBtn"
          :aria-label="`跳转到 ${timeStr}`"
          :title="`跳转到 ${timeStr}`"
          @mouseenter="handleSkipMouseEnter"
          @mouseleave="handleSkipMouseLeave"
          @click="handleSkipPlay"
        >
          <span :class="$style.skipTime">{{ timeStr }}</span>
        </base-btn>
      </div>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLrcSelectContent" ref="dom_lrc_select_content" tabindex="-1" :class="[$style.lyricSelectContent, 'select', 'scroll', 'lyricSelectContent']" @contextmenu="handleCopySelectText">
        <div v-for="(info, index) in lyric.lines" :key="index" :class="[$style.lyricSelectline, { [$style.lrcActive]: lyric.line == index }]">
          <span>{{ info.text }}</span>
          <template v-for="(lrc, i) in info.extendedLyrics" :key="i">
            <br>
            <span :class="$style.lyricSelectlineExtended">{{ lrc }}</span>
          </template>
        </div>
      </div>
    </transition>
    <LyricMenu v-model="lyricMenuVisible" :xy="lyricMenuXY" :lyric-info="lyricInfo" @update-lyric="handleUpdateLyric" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { lyric } from '@renderer/store/player/lyric'
import { playProgress } from '@renderer/store/player/playProgress'
import { isFullscreen } from '@renderer/store'
import {
  isPlay,
  isShowLrcSelectContent,
  musicInfo as playerMusicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setMusicInfo,
} from '@renderer/store/player/action'
import { onMounted, onBeforeUnmount, computed, reactive, ref, nextTick, watch } from '@common/utils/vueTools'
import useLyric from '@renderer/utils/compositions/useLyric'
import LyricMenu from './components/LyricMenu.vue'
import { appSetting } from '@renderer/store/setting'
import { setLyricOffset } from '@renderer/core/lyric'
import useSelectAllLrc from './useSelectAllLrc'

export default {
  components: {
    LyricMenu,
  },
  setup() {
    const isZoomActiveLrc = computed(() => appSetting['playDetail.isZoomActiveLrc'])
    const isShowLyricProgressSetting = computed(() => appSetting['playDetail.isShowLyricProgressSetting'])

    const {
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      isMsDown,
      isStopScroll,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleWheel,
      handleSkipPlay,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      handleScrollLrc,
    } = useLyric({ isPlay, lyric, playProgress, isShowLyricProgressSetting })

    const dom_lrc_select_content = useSelectAllLrc()

    watch(isFullscreen, () => {
      setTimeout(handleScrollLrc, 400)
    })

    const lyricMenuVisible = ref(false)
    const lyricMenuXY = reactive({
      x: 0,
      y: 0,
    })
    const lyricInfo = reactive({
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
      rawlyric: '',
      musicInfo: null,
    })
    const updateMusicInfo = () => {
      lyricInfo.lyric = playerMusicInfo.lrc
      lyricInfo.tlyric = playerMusicInfo.tlrc
      lyricInfo.rlyric = playerMusicInfo.rlrc
      lyricInfo.lxlyric = playerMusicInfo.lxlrc
      lyricInfo.rawlyric = playerMusicInfo.rawlrc
      lyricInfo.musicInfo = playMusicInfo.musicInfo
    }
    const handleShowLyricMenu = event => {
      updateMusicInfo()
      lyricMenuXY.x = event.pageX
      lyricMenuXY.y = event.pageY
      if (lyricMenuVisible.value) return
      void nextTick(() => {
        lyricMenuVisible.value = true
      })
    }
    const handleUpdateLyric = ({ lyric, tlyric, rlyric, lxlyric, offset }) => {
      setMusicInfo({
        lrc: lyric,
        tlrc: tlyric,
        rlrc: rlyric,
        lxlrc: lxlyric,
      })
      console.log(offset)
      setLyricOffset(offset)
    }

    const lrcStyles = computed(() => {
      return {
        textAlign: appSetting['playDetail.style.align'],
      }
    })
    const lrcFontSize = computed(() => {
      let size = appSetting['playDetail.style.fontSize'] / 100
      if (isFullscreen.value) size = size *= 1.4
      return {
        '--playDetail-lrc-font-size': size + 'rem',
      }
    })

    onMounted(() => {
      window.app_event.on('musicToggled', updateMusicInfo)
      window.app_event.on('lyricUpdated', updateMusicInfo)
    })
    onBeforeUnmount(() => {
      window.app_event.off('musicToggled', updateMusicInfo)
      window.app_event.off('lyricUpdated', updateMusicInfo)
    })

    return {
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      dom_lrc_select_content,
      isMsDown,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleWheel,
      handleSkipPlay,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      lyric,
      lrcStyles,
      lrcFontSize,
      isShowLrcSelectContent,
      isShowLyricProgressSetting,
      isZoomActiveLrc,
      isStopScroll,
      lyricMenuVisible,
      lyricMenuXY,
      handleShowLyricMenu,
      handleUpdateLyric,
      lyricInfo,
    }
  },
  methods: {
    handleCopySelectText() {
      let str = window.getSelection().toString()
      str = str.trim()
      if (!str.length) return
      clipboardWriteText(str)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.right {
  flex: 1 1 auto;
  min-width: 0;
  position: relative;
  transition: flex-basis @transition-normal;
}
.lyric {
  position: relative;
  text-align: left;
  height: 100%;
  overflow: auto;
  font-size: var(--playDetail-lrc-font-size, 16px);
  padding: clamp(12px, 2vw, 24px) clamp(18px, 2vw, 34px) clamp(18px, 2vw, 24px);
  -webkit-mask-image: linear-gradient(transparent 0%, #fff 10%,  #fff 90%, transparent 100%);
  cursor: grab;
  scrollbar-width: none;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);

  &::-webkit-scrollbar {
    display: none;
  }

  &.draging {
    cursor: grabbing;
  }
  :global {
    .font-lrc {
      color: rgba(255, 255, 255, 0.82);
    }
    .line-content {
      line-height: 1.22;
      padding: calc(var(--playDetail-lrc-font-size, 16px) * 0.52) 2px;
      overflow-wrap: break-word;
      color: rgba(255, 255, 255, 0.82);
      transition: @transition-normal, opacity @transition-normal;
      transition-property: padding, color, opacity, transform;
      opacity: .82;

      .extended {
        font-size: 0.76em;
        margin-top: 8px;
      }
      &.line-mode {
        .font-lrc {
          transition: @transition-fast;
          transition-property: font-size, color;
        }
      }

      &.active {
        opacity: 1;
        transform: translateX(6px);
      }

      &.line-mode.active .font-lrc, &.font-mode.played .font-lrc {
        color: #ffffff;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.16);
      }
      &.font-mode .extended .font-lrc {
        transition: @transition-slow;
        transition-property: font-size, color;
        color: rgba(255, 255, 255, 0.66);
      }

      &.font-mode > .line > .font-lrc {
        > span {
          transition: @transition-normal;
          transition-property: font-size;
          font-size: 1em;
          background-repeat: no-repeat;
          background-color: rgba(255, 255, 255, 0.82);
          background-image: linear-gradient(90deg, #ffffff, #ffffff);
          -webkit-text-fill-color: transparent;
          -webkit-background-clip: text;
          background-size: 0 100%;
        }
      }
    }
  }
  // p {
  //   padding: 8px 0;
  //   line-height: 1.2;
  //   overflow-wrap: break-word;
  //   transition: @transition-normal !important;
  //   transition-property: color, font-size;
  // }
  // .lrc-active {
  //   color: var(--color-primary);
  //   font-size: 1.2em;
  // }
}
.lrcActiveZoom {
  :global {
    .line-content {
      &.active {
        .extended {
          font-size: .9em;
        }
        .line {
          font-size: 1.12em;
          font-weight: 600;
        }
      }
    }
  }
}

.skip {
  --seek-control-push: clamp(12px, 1.6vw, 28px);
  --seek-capsule-width: 56px;
  --seek-capsule-bg: rgba(255, 255, 255, .96);
  --seek-capsule-color: rgba(12, 14, 18, .96);
  --seek-capsule-border: rgba(15, 18, 24, .12);
  --seek-capsule-shadow: rgba(16, 20, 28, .22);
  --seek-tail-color: rgba(255, 255, 255, .9);
  position: absolute;
  top: calc(38% + var(--playDetail-lrc-font-size, 16px) + 4px);
  left: 0;
  width: calc(100% + var(--seek-control-push));
  height: 28px;
  pointer-events: none;

  .line {
    position: absolute;
    top: 50%;
    right: calc(var(--seek-capsule-width) - 1px);
    width: clamp(72px, 10vw, 124px);
    height: 1px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--seek-tail-color) 18%, transparent) 38%, color-mix(in srgb, var(--seek-tail-color) 64%, transparent) 78%, var(--seek-tail-color) 100%);
    transform: translateY(-50%);
    opacity: .76;
    pointer-events: none;
  }

  .skipBtn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    min-width: var(--seek-capsule-width);
    width: auto;
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--seek-capsule-border);
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    background: var(--seek-capsule-bg) !important;
    color: var(--seek-capsule-color);
    box-shadow: 0 4px 14px var(--seek-capsule-shadow), inset 0 1px 0 rgba(255, 255, 255, .28);
    pointer-events: initial;
    opacity: 1;
    cursor: pointer;
    transition: transform @transition-fast, box-shadow @transition-fast, border-color @transition-fast;

    &::before {
      content: '';
      position: absolute;
      inset: -8px -5px;
      border-radius: inherit;
    }

    &:hover {
      transform: translateY(-50%) scale(1.035);
      box-shadow: 0 6px 18px var(--seek-capsule-shadow), inset 0 1px 0 rgba(255, 255, 255, .34);
    }

    &:active {
      transform: translateY(-50%) scale(.98);
    }

    &:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--seek-capsule-color) 32%, transparent);
      outline-offset: 3px;
    }
  }

  .skipTime {
    position: relative;
    z-index: 1;
    color: inherit;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: .025em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}

:global(.themeShellDark) {
  .skip {
    --seek-capsule-bg: rgba(8, 9, 11, .96);
    --seek-capsule-color: rgba(255, 255, 255, .96);
    --seek-capsule-border: rgba(255, 255, 255, .17);
    --seek-capsule-shadow: rgba(0, 0, 0, .5);
    --seek-tail-color: rgba(8, 9, 11, .92);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skip .skipBtn {
    transition: none;
  }
}
.lyricSelectContent {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  font-size: var(--playDetail-lrc-font-size, 16px);
  z-index: 10;
  color: rgba(255, 255, 255, 0.84);
  padding: clamp(12px, 2vw, 24px) clamp(18px, 2vw, 34px) clamp(18px, 2vw, 24px);

  .lyricSelectline {
    padding: calc(var(--playDetail-lrc-font-size, 16px) * 0.52) 2px;
    overflow-wrap: break-word;
    transition: @transition-normal !important;
    transition-property: color, font-size;
    line-height: 1.3;
  }
  .lyricSelectlineExtended {
    font-size: .76em;
    color: rgba(255, 255, 255, 0.7);
  }
  .lrcActive {
    color: #ffffff;
  }
}

.lyricSpace {
  height: 55%;
}

</style>
