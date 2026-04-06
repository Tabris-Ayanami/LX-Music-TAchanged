<template>
  <div
    ref="playerRef"
    :class="[$style.player, { [$style.compact]: isFloatingIslandCompact }]"
    data-play-floating-island="true"
  >
    <button
      type="button"
      :class="$style.coverTrigger"
      :aria-label="$t('player__pic_tip')"
      @click.stop="showPlayerDetail"
      @contextmenu.prevent="handleToMusicLocation"
    >
      <div data-play-floating-cover="true" :class="$style.cover">
        <img v-if="musicInfo.pic" :src="musicInfo.pic" decoding="async" @error="imgError">
        <div v-else :class="$style.emptyPic">L<span>X</span></div>
      </div>
    </button>

    <div :class="$style.contentCluster">
      <div :class="$style.expandedContent">
        <div :class="$style.topRow">
          <div :class="$style.trackMeta">
            <span :class="$style.kicker">{{ metaLine }}</span>
            <button type="button" data-play-floating-title-link="true" :class="$style.title" @click.stop="handleToMusicLocation">
              {{ displayTitle }}
            </button>
            <span :class="$style.subtitle">{{ subtitle }}</span>
          </div>

          <div :class="$style.controls">
            <button type="button" :class="$style.iconBtn" :aria-label="$t('player__prev')" @click="playPrev()">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
                <use xlink:href="#icon-prev-amll" />
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
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
                <use xlink:href="#icon-next-amll" />
              </svg>
            </button>
          </div>

          <div :class="$style.utilityCluster">
            <button type="button" :class="$style.utilityBtn" :aria-label="$t('player__add_music_to')" @click="addMusicTo">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="14" height="14" viewBox="0 0 512 512" space="preserve">
                <use xlink:href="#icon-add-2" />
              </svg>
            </button>
            <button type="button" :class="$style.utilityBtn" :aria-label="$t('download')" @click="isShowDownloadModal = true">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
                <use xlink:href="#icon-download-modern" />
              </svg>
            </button>
            <div :class="$style.utilityBtn">
              <common-toggle-play-mode-btn />
            </div>
            <div :class="$style.utilityBtn">
              <PlayQueueBtn placement="right" variant="floating" />
            </div>
            <div :class="$style.utilityBtn">
              <common-volume-btn />
            </div>
            <button type="button" :class="$style.utilityBtn" :aria-label="$t('player__floating_compact')" @click.stop="toggleFloatingIslandCompact">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
                <use xlink:href="#icon-chevron-left-modern" />
              </svg>
            </button>
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

      <div :class="$style.compactControls">
        <button type="button" :class="[$style.iconBtn, $style.playBtn, $style.compactPlayBtn]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
          <svg v-if="isPlay" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="18" height="18" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-pause" />
          </svg>
          <svg v-else :class="$style.playGlyph" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="18" height="18" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-play" />
          </svg>
        </button>
        <button type="button" :class="$style.compactToggleBtn" :aria-label="$t('player__floating_expand')" @click.stop="toggleFloatingIslandCompact">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-chevron-right-modern" />
          </svg>
        </button>
      </div>
    </div>

    <common-list-add-modal v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo" />
    <DownloadModal v-model:show="isShowDownloadModal" :music-info="playMusicInfo.musicInfo" />
  </div>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { LIST_IDS } from '@common/constants'
import { togglePlay, playNext, playPrev } from '@renderer/core/player'
import { setMusicInfo, setShowPlayerDetail } from '@renderer/store/player/action'
import { musicInfo, isPlay, playInfo, playMusicInfo, statusText } from '@renderer/store/player/state'
import { isFloatingIslandCompact, toggleFloatingIslandCompact } from '@renderer/store/ui'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import { capturePlayDetailOrigin } from '@renderer/utils/playDetailTransition'
import PlayQueueBtn from '@renderer/components/layout/PlayDetail/components/PlayQueueBtn.vue'
import DownloadModal from '@renderer/components/common/DownloadModal.vue'

export default {
  name: 'FloatingIslandBar',
  components: {
    PlayQueueBtn,
    DownloadModal,
  },
  setup() {
    const router = useRouter()
    const isShowAddMusicTo = ref(false)
    const isShowDownloadModal = ref(false)
    const playerRef = ref(null)
    const {
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
    } = usePlayProgress()

    const showPlayerDetail = () => {
      if (!playMusicInfo.musicInfo && !musicInfo.id && !musicInfo.name) return
      capturePlayDetailOrigin(playerRef.value)
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
      return [singer, albumName].filter(Boolean).join(' / ') || statusText.value || 'Choose a song to start playback.'
    })
    const metaLine = computed(() => {
      const source = playMusicInfo.musicInfo?.source
      const interval = playMusicInfo.musicInfo?.interval
      return [source?.toUpperCase?.(), interval].filter(Boolean).join(' | ') || 'Floating Player'
    })

    return {
      musicInfo,
      isPlay,
      isFloatingIslandCompact,
      playMusicInfo,
      playerRef,
      isShowAddMusicTo,
      isShowDownloadModal,
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
      showPlayerDetail,
      imgError,
      handleToMusicLocation,
      addMusicTo,
      displayTitle,
      subtitle,
      metaLine,
      toggleFloatingIslandCompact,
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
  position: relative;
  height: 82px;
  width: 100%;
  max-width: min(100%, 1180px);
  min-height: 82px;
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
  transition: width .28s cubic-bezier(0.22, 1, 0.36, 1), height .24s cubic-bezier(0.22, 1, 0.36, 1), padding .24s cubic-bezier(0.22, 1, 0.36, 1), gap .24s cubic-bezier(0.22, 1, 0.36, 1), transform @transition-fast, border-radius @transition-fast, box-shadow @transition-fast;
  transform: translateZ(0);
  backface-visibility: hidden;
  overflow: hidden;
  contain: paint;
  will-change: width, height, transform;
  pointer-events: auto;
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }

  &.compact {
    width: 164px;
    max-width: 164px;
    min-width: 164px;
    height: 62px;
    min-height: 62px;
    gap: 10px;
    padding: 8px 12px 8px 10px;
    border-radius: 999px;
  }
}

:global(#player) {
  pointer-events: auto;
}

.cover {
  display: block;
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 10px;
  overflow: hidden;
  background: transparent;
  line-height: 0;
  box-shadow: 0 8px 18px rgba(27, 39, 65, 0.12);
  pointer-events: none;

  img,
  .emptyPic {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  img {
    display: block;
    object-fit: cover;
  }
}

.coverTrigger {
  flex: none;
  width: 56px;
  height: 56px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.001);
  cursor: pointer;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  -webkit-app-region: no-drag;
}

.compact .coverTrigger {
  width: 42px;
  height: 42px;
  border-radius: 999px;
}

.compact .cover {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  box-shadow: 0 10px 22px rgba(27, 39, 65, 0.14);
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
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  overflow: hidden;
  min-height: 0;
}

.expandedContent {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 7px;
  max-width: 100%;
  width: 100%;
  opacity: 1;
  overflow: hidden;
  transition: max-width .28s cubic-bezier(0.22, 1, 0.36, 1), width .28s cubic-bezier(0.22, 1, 0.36, 1), opacity .18s ease;
}

.compactControls {
  width: 0;
  min-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  flex: none;
  transition: width .28s cubic-bezier(0.22, 1, 0.36, 1), opacity .18s ease;
}

.compact .expandedContent {
  max-width: 0;
  width: 0;
  opacity: 0;
  pointer-events: none;
}

.compact .compactControls {
  width: 64px;
  opacity: 1;
  pointer-events: auto;
  transform: translateX(3px);
}

.compact .contentCluster {
  flex: none;
  width: 64px;
  align-self: center;
  justify-content: flex-end;
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
  display: inline-block;
  width: auto;
  flex: none;
  align-self: flex-start;
  font-size: 15px;
  line-height: 1.1;
  font-weight: 700;
  text-align: left;
  color: inherit;
  max-width: 100%;
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

.iconBtn,
.compactToggleBtn {
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
    width: 18px;
    height: 18px;
    fill: currentColor;
  }
}

.playBtn {
  width: 34px;
  height: 34px;
  color: #fff;
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 68%, white 32%));
  box-shadow: 0 12px 22px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 24%, transparent);

  svg {
    width: 16px;
    height: 16px;
  }
}

.compactPlayBtn {
  flex: none;
  width: 30px;
  height: 30px;
  align-self: center;

  svg {
    width: 14px;
    height: 14px;
  }
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
  gap: 8px;
}

.utilityBtn {
  width: 30px;
  height: 30px;
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
  line-height: 0;

  &:hover {
    opacity: .86;
    transform: translateY(-1px);
  }

  &:active {
    opacity: .68;
    transform: translateY(0);
  }

  :global(button) {
    width: 100%;
    height: 100%;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: inherit;
    line-height: 0;
  }

  svg,
  :global(svg) {
    width: 17px;
    height: 17px;
    display: block;
    opacity: .78;
    flex: none;
  }
}

.compactToggleBtn {
  width: 28px;
  height: 28px;
  flex: none;
  align-self: center;

  svg {
    width: 16px;
    height: 16px;
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
