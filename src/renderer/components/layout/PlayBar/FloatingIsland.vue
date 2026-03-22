<template>
  <div :class="$style.player">
    <button type="button" :class="$style.cover" :aria-label="$t('player__pic_tip')" @click="showPlayerDetail" @contextmenu.prevent="handleToMusicLocation">
      <img v-if="musicInfo.pic" :src="musicInfo.pic" decoding="async" @error="imgError">
      <div v-else :class="$style.emptyPic">L<span>X</span></div>
    </button>

    <div :class="$style.contentCluster">
      <div :class="$style.topRow">
        <div :class="$style.trackMeta">
          <span :class="$style.kicker">{{ metaLine }}</span>
          <button type="button" :class="$style.title" @click="handleToMusicLocation">
            {{ displayTitle }}
          </button>
          <span :class="$style.subtitle">{{ subtitle }}</span>
        </div>

        <div :class="$style.controls">
          <button type="button" :class="$style.iconBtn" :aria-label="$t('player__prev')" @click="playPrev()">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="18" height="18" viewBox="0 0 1024 1024" space="preserve">
              <use xlink:href="#icon-prevMusic" />
            </svg>
          </button>
          <button type="button" :class="[$style.iconBtn, $style.playBtn]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
            <svg v-if="isPlay" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="18" height="18" viewBox="0 0 1024 1024" space="preserve">
              <use xlink:href="#icon-pause" />
            </svg>
            <svg v-else :class="$style.playGlyph" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="18" height="18" viewBox="0 0 1024 1024" space="preserve">
              <use xlink:href="#icon-play" />
            </svg>
          </button>
          <button type="button" :class="$style.iconBtn" :aria-label="$t('player__next')" @click="playNext()">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="18" height="18" viewBox="0 0 1024 1024" space="preserve">
              <use xlink:href="#icon-nextMusic" />
            </svg>
          </button>
        </div>

        <div :class="$style.utilityCluster">
          <button type="button" :class="$style.utilityBtn" :aria-label="$t('player__add_music_to')" @click="addMusicTo">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="14" height="14" viewBox="0 0 512 512" space="preserve">
              <use xlink:href="#icon-add-2" />
            </svg>
          </button>
          <button type="button" :class="$style.utilityBtn" :aria-label="toggleDesktopLyricBtnTitle" @click="toggleDesktopLyric" @contextmenu.prevent="toggleLockDesktopLyric">
            <svg v-show="appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="14" height="14" viewBox="0 0 512 512" space="preserve">
              <use xlink:href="#icon-desktop-lyric-on" />
            </svg>
            <svg v-show="!appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="14" height="14" viewBox="0 0 512 512" space="preserve">
              <use xlink:href="#icon-desktop-lyric-off" />
            </svg>
          </button>
          <div :class="$style.utilityBtn">
            <common-toggle-play-mode-btn />
          </div>
          <div :class="$style.utilityBtn">
            <PlayQueueBtn />
          </div>
          <div :class="$style.utilityBtn">
            <common-volume-btn />
          </div>
        </div>
      </div>

      <div :class="$style.progressRow">
        <span :class="$style.timeText">{{ nowPlayTimeStr }}</span>
        <div :class="$style.progressWrap">
          <common-progress-bar :class-name="$style.progressBar" :progress="progress" :handle-transition-end="handleTransitionEnd" :is-active-transition="isActiveTransition" />
        </div>
        <span :class="$style.timeText">{{ maxPlayTimeStr }}</span>
      </div>
    </div>

    <common-list-add-modal v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo" />
  </div>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { LIST_IDS } from '@common/constants'
import { togglePlay, playNext, playPrev } from '@renderer/core/player'
import { setMusicInfo, setShowPlayerDetail } from '@renderer/store/player/action'
import { musicInfo, isPlay, playInfo, playMusicInfo, statusText } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
import PlayQueueBtn from '@renderer/components/layout/PlayDetail/components/PlayQueueBtn.vue'

export default {
  name: 'FloatingIslandBar',
  components: {
    PlayQueueBtn,
  },
  setup() {
    const router = useRouter()
    const isShowAddMusicTo = ref(false)
    const {
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
    } = usePlayProgress()
    const {
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
    } = useToggleDesktopLyric()

    const showPlayerDetail = () => {
      if (!playMusicInfo.musicInfo) return
      setShowPlayerDetail(true)
    }

    const imgError = () => {
      setMusicInfo({ pic: null })
    }

    const handleToMusicLocation = () => {
      const listId = playMusicInfo.listId
      if (!listId || listId == LIST_IDS.DOWNLOAD || !playMusicInfo.musicInfo) return
      if (playInfo.playIndex == -1) return
      void router.push({
        path: '/list',
        query: {
          id: listId,
          scrollIndex: playInfo.playIndex,
        },
      })
    }

    const addMusicTo = () => {
      if (!musicInfo.id) return
      isShowAddMusicTo.value = true
    }

    const displayTitle = computed(() => musicInfo.name || 'Not Playing')
    const subtitle = computed(() => {
      const singer = musicInfo.singer?.trim()
      const albumName = musicInfo.album?.trim()
      return [singer, albumName].filter(Boolean).join(' · ') || statusText.value || 'Choose a song to start playback.'
    })
    const metaLine = computed(() => {
      const source = playMusicInfo.musicInfo?.source
      const interval = playMusicInfo.musicInfo?.interval
      return [source?.toUpperCase?.(), interval].filter(Boolean).join(' • ') || 'Floating Player'
    })

    return {
      appSetting,
      musicInfo,
      isPlay,
      playMusicInfo,
      isShowAddMusicTo,
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
      showPlayerDetail,
      imgError,
      handleToMusicLocation,
      addMusicTo,
      displayTitle,
      subtitle,
      metaLine,
      togglePlay,
      playNext,
      playPrev,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.player {
  height: auto;
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: 22px;
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18));
  background: color-mix(in srgb, var(--shell-surface-strong, rgba(255, 255, 255, 0.9)) 76%, transparent);
  box-shadow: var(--shell-player-shadow, 0 20px 40px rgba(91, 113, 153, 0.18));
  backdrop-filter: blur(28px);
  color: var(--shell-text, var(--color-font));

  * {
    box-sizing: border-box;
  }
}

.cover {
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 10px;
  overflow: hidden;
  background: transparent;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(27, 39, 65, 0.12);

  img,
  .emptyPic {
    width: 100%;
    height: 100%;
  }

  img {
    display: block;
    object-fit: cover;
  }
}

.emptyPic {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 24%, transparent);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: .08em;

  span {
    padding-left: 2px;
  }
}

.contentCluster {
  min-width: 0;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  gap: 7px;
}

.topRow {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding-right: 2px;
}

.trackMeta {
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 2px;
}

.kicker {
  font-size: 9px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--shell-muted, var(--color-font-label));
}

.title {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 15px;
  line-height: 1.1;
  font-weight: 700;
  text-align: left;
  color: inherit;
  cursor: pointer;
  .mixin-ellipsis-1();
}

.subtitle {
  font-size: 11px;
  line-height: 1.2;
  color: var(--shell-soft-text, var(--color-font-label));
  .mixin-ellipsis-1();
}

.controls {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 1;
}

.iconBtn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--shell-text, var(--color-button-font));
  cursor: pointer;
  transition: @transition-fast;
  transition-property: transform, opacity, background-color;

  &:hover {
    opacity: .84;
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.08);
  }

  &:active {
    opacity: .68;
    transform: translateY(0);
  }

  svg {
    fill: currentColor;
  }
}

.playBtn {
  width: 34px;
  height: 34px;
  color: #fff;
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 68%, white 32%));
  box-shadow: 0 12px 22px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 24%, transparent);
}

.playGlyph {
  transform: translateX(1px);
  transform-origin: center;
}

.utilityCluster {
  grid-column: 2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.utilityBtn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: var(--shell-text, var(--color-button-font));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: @transition-fast;
  transition-property: transform, opacity, background-color;

  &:hover {
    opacity: .86;
    transform: translateY(-1px);
  }

  &:active {
    opacity: .68;
    transform: translateY(0);
  }

  :global(button) {
    background: transparent;
    border: none;
  }

  svg {
    fill: currentColor;
  }
}

.progressRow {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.timeText {
  font-size: 10px;
  color: var(--shell-muted, var(--color-font-label));
}

.progressWrap {
  position: relative;
  width: 100%;
  height: 8px;
  display: flex;
  align-items: center;
}

.progressBar {
  height: 3px;
}

@media (max-width: 980px) {
  .player {
    padding: 10px 12px;
  }

  .topRow {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .controls,
  .utilityCluster {
    justify-content: flex-start;
  }
}

</style>
