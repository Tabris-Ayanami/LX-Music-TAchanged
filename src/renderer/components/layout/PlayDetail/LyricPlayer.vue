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
        <div :class="$style.skipControl">
          <div ref="dom_skip_line" :class="$style.line" />
          <base-btn :class="$style.skipBtn" @mouseenter="handleSkipMouseEnter" @mouseleave="handleSkipMouseLeave" @click="handleSkipPlay">
            {{ timeStr }}
          </base-btn>
        </div>
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
  --skip-guide-line-width: 72px;
  position: absolute;
  top: calc(38% + var(--playDetail-lrc-font-size, 16px) + 4px);
  left: 0;
  width: 100%;
  pointer-events: none;

  .skipControl {
    position: absolute;
    top: 0;
    right: 30px;
    display: flex;
    align-items: center;
    pointer-events: none;
    transform: translateY(-50%);
  }

  .line {
    width: var(--skip-guide-line-width);
    height: 1px;
    flex: 0 0 var(--skip-guide-line-width);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, .84));
    box-shadow: 0 0 8px rgba(255, 255, 255, .16);
  }

  .skipBtn {
    min-width: 0;
    width: auto;
    height: 18px;
    padding: 0 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none !important;
    border-radius: 999px;
    background: rgba(255, 255, 255, .96) !important;
    color: rgba(22, 24, 32, .84) !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, .18);
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: initial;
    transition: @transition-fast;
    transition-property: background-color, color, opacity, box-shadow;

    &:hover {
      background: #fff !important;
      color: rgba(13, 16, 24, .94) !important;
      box-shadow: 0 3px 14px rgba(0, 0, 0, .22);
    }

    &:active {
      opacity: .86;
    }
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
