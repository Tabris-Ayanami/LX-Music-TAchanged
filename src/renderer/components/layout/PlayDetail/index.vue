<template lang="pug">
transition(enter-active-class="animated slideInUp" leave-active-class="animated slideOutDown" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave")
  div(v-if="isShowPlayerDetail" :class="[$style.container, { fullscreen: isFullscreen }]" @contextmenu="handleContextMenu")
    div(:class="$style.bg")
    div(:class="$style.bgTint")
    div(:class="$style.bgGlow")
    ControlBtnsLeftHeader(v-if="appSetting['common.controlBtnPosition'] == 'left'")
    ControlBtnsRightHeader(v-else)
    div(:class="[$style.main, {[$style.showComment]: isShowPlayComment}]")
      section.left(:class="$style.left")
        div(:class="$style.leftInner")
          div(:class="$style.artworkWrap")
            img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
            div(v-else :class="$style.imgPlaceholder")
              svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
                use(xlink:href="#icon-album")
          div(:class="$style.metaCard")
            div(:class="$style.meta")
              h1(:class="$style.title") {{ musicInfo.name || $t('player__music_name') }}
              div(v-if="musicArtistLine" :class="$style.metaSubline") {{ musicArtistLine }}
              div(v-if="musicInfoLine" :class="$style.metaTiny") {{ musicInfoLine }}
          div(:class="$style.controlsWrap")
            play-bar(v-if="visibled")

      transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
        LyricPlayer(v-if="visibled")
      music-comment(v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment")
    transition(enter-active-class="animated-slow fadeIn" leave-active-class="animated-slow fadeOut")
      common-audio-visualizer(v-if="appSetting['player.audioVisualization'] && visibled")
</template>


<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  musicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import LyricPlayer from './LyricPlayer.vue'
import PlayBar from './PlayBar.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsLeftHeader,
    ControlBtnsRightHeader,
    LyricPlayer,
    PlayBar,
    MusicComment,
  },
  setup() {
    const visibled = ref(false)

    const musicArtistLine = computed(() => {
      const info = playMusicInfo.musicInfo
      if (!info) return ''
      const items = []
      if (musicInfo.singer) items.push(musicInfo.singer)
      if (info.meta?.albumName) items.push(info.meta.albumName)
      return items.join(' / ')
    })
    const musicInfoLine = computed(() => {
      const info = playMusicInfo.musicInfo
      if (!info) return ''
      const items = []
      if (info.source === 'local' && info.meta?.ext) items.push(String(info.meta.ext).toUpperCase())
      const quality = info.meta?._qualitys ? Object.keys(info.meta._qualitys).find(key => info.meta?._qualitys?.[key]) : null
      if (quality) items.push(quality.replace('bit', 'BIT').toUpperCase())
      if (info.interval) items.push(info.interval)
      return items.join(' / ')
    })

    let clickTime = 0

    const hide = () => {
      setShowPlayerDetail(false)
    }
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      hide()
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()

      visibled.value = true
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      visibled.value = false

      unregisterAutoHideMounse()
    }

    watch(isFullscreen, isFullscreen => {
      (isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })


    return {
      appSetting,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      musicInfo,
      musicArtistLine,
      musicInfoLine,
      hide,
      handleContextMenu,
      hideComment,
      handleAfterEnter,
      handleAfterLeave,
      visibled,
      isFullscreen,
      fullscreenExit() {
        void setFullScreen(false).then((fullscreen) => {
          isFullscreen.value = fullscreen
        })
      },
      min() {
        minWindow()
      },
      max() {
        maxWindow()
      },
      close() {
        closeWindow()
      },
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * .26;

.container {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background-color: var(--color-content-background);
  z-index: 10;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  -webkit-app-region: no-drag;
  contain: strict;

  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
}
.bg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  opacity: .7;
  z-index: -1;
}
.bgTint,
.bgGlow {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
.bgTint {
  background:
    linear-gradient(135deg, rgba(248, 249, 244, 0.82) 0%, rgba(240, 242, 236, 0.54) 34%, rgba(24, 31, 40, 0.56) 100%);
}
.bgGlow {
  background:
    radial-gradient(circle at 18% 24%, color-mix(in srgb, var(--color-primary-alpha-700) 58%, transparent) 0%, transparent 42%),
    radial-gradient(circle at 80% 18%, rgba(255, 255, 255, 0.12) 0%, transparent 30%),
    radial-gradient(circle at 72% 80%, rgba(0, 0, 0, 0.38) 0%, transparent 42%);
  backdrop-filter: blur(22px) saturate(120%);
}

.main {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  gap: clamp(24px, 3vw, 48px);
  padding: clamp(26px, 3vw, 40px) clamp(24px, 3vw, 42px) clamp(22px, 2.4vw, 34px);
  position: relative;

  &.showComment {
    :global {
      .left {
        flex-basis: min(43%, 540px);
      }
      .right {
        flex-basis: 29%;
      }
      .comment {
        opacity: 1;
        transform: scaleX(1);
      }
    }
  }
}
.left {
  position: relative;
  z-index: 1;
  flex: 0 0 min(46%, 580px);
  display: flex;
  min-width: 340px;
  overflow: hidden;
  transition: flex-basis @transition-normal;
}

.leftInner {
  display: grid;
  grid-template-rows: auto auto auto;
  align-content: start;
  gap: 10px;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 2px 0 6px;
}
.artworkWrap {
  position: relative;
  width: min(100%, 390px);
  max-height: min(46vh, 390px);
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  flex: none;
}
.img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.30), 0 0 0 1px rgba(255, 255, 255, 0.08);
  border-radius: 28px;
}
.imgPlaceholder {
  width: 100%;
  height: 100%;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.84);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04)),
    color-mix(in srgb, var(--color-primary-alpha-600) 45%, rgba(12, 16, 22, 0.82));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.30);

  svg {
    width: 26%;
    height: 26%;
  }
}
.meta {
  width: min(100%, 390px);
  margin: 0 auto;
}
.metaCard {
  width: min(100%, 390px);
  margin: 0 auto;
  padding: 2px 4px 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}
.title {
  font-size: clamp(15px, 1.45vw, 20px);
  line-height: 1.18;
  font-weight: 500;
  letter-spacing: -.02em;
  color: rgba(255, 255, 255, 0.92);
  margin: 0;
  overflow-wrap: anywhere;
  text-shadow: 0 3px 14px rgba(0, 0, 0, 0.10);
}
.metaSubline {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.72);
  .mixin-ellipsis-1();
}
.metaTiny {
  margin-top: 4px;
  font-size: 10px;
  line-height: 1.3;
  letter-spacing: .02em;
  color: rgba(255, 255, 255, 0.58);
  .mixin-ellipsis-1();
}
.controlsWrap {
  width: min(100%, 390px);
  margin: 0 auto;
  min-height: 0;
}

.comment {
  position: absolute;
  right: 0;
  top: clamp(26px, 3vw, 40px);
  width: min(36%, 500px);
  height: calc(100% - clamp(26px, 3vw, 40px));
  max-width: 500px;
  transform: scaleX(0);
  z-index: 2;
}

@media (max-width: 1100px) {
  .main {
    gap: 24px;
    padding: 22px;
  }
  .left {
    flex-basis: min(44%, 460px);
    min-width: 260px;
  }
  .artworkWrap {
    width: min(100%, 320px);
    max-height: min(38vh, 320px);
  }
}

@media (max-width: 920px) {
  .main {
    padding: 18px;
    gap: 18px;
  }
  .left {
    flex-basis: min(44%, 320px);
    min-width: 220px;
  }
  .artworkWrap {
    width: min(100%, 240px);
    max-height: min(30vh, 240px);
  }
  .meta {
    width: 100%;
  }
  .metaCard {
    width: 100%;
    padding: 0;
  }
}

</style>
