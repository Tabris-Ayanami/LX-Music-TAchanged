<template>
  <div
    ref="playerRef"
    :class="[$style.player, { [$style.compact]: isFloatingIslandCompact }]"
    data-play-floating-island="true"
    :data-floating-compact="isFloatingIslandCompact ? 'true' : 'false'"
  >
    <button
      type="button"
      :class="$style.coverTrigger"
      :aria-label="$t('player__pic_tip')"
      @click.stop="showPlayerDetail"
      @contextmenu.prevent="handleToMusicLocation"
    >
      <div data-play-floating-cover="true" :class="$style.cover">
        <div :class="[$style.coverArt, { [$style.coverArtSpinning]: isFloatingIslandCompact && isPlay && musicInfo.pic }]">
          <img v-if="musicInfo.pic" :src="musicInfo.pic" decoding="async" @error="imgError">
          <div v-else :class="$style.emptyPic">L<span>X</span></div>
        </div>
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
            <button type="button" :class="[$style.iconBtn, $style.playBtn, { [$style.playing]: isPlay }]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
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
        <button type="button" :class="[$style.iconBtn, $style.playBtn, $style.compactPlayBtn, { [$style.playing]: isPlay }]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
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
  max-width: 100%;
  min-height: 82px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--shell-stroke, rgba(255, 255, 255, 0.18)) 84%, rgba(255, 255, 255, 0.72));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(245, 248, 255, 0.82)),
    color-mix(in srgb, var(--shell-surface-strong, rgba(255, 255, 255, 0.92)) 80%, transparent);
  box-shadow:
    0 26px 52px rgba(82, 108, 160, 0.16),
    0 10px 24px rgba(82, 108, 160, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(30px) saturate(132%);
  color: var(--shell-text, var(--color-font));
  transition: width .28s cubic-bezier(0.22, 1, 0.36, 1), height .24s cubic-bezier(0.22, 1, 0.36, 1), padding .24s cubic-bezier(0.22, 1, 0.36, 1), gap .24s cubic-bezier(0.22, 1, 0.36, 1), transform @transition-fast, border-radius @transition-fast, box-shadow @transition-fast;
  transform: translateZ(0);
  backface-visibility: hidden;
  overflow: hidden;
  contain: paint;
  will-change: width, height, transform;
  pointer-events: auto;
  box-sizing: border-box;
  isolation: isolate;

  * {
    box-sizing: border-box;
  }

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
  }

  &::before {
    border: 1px solid rgba(255, 255, 255, 0.32);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.46),
      inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  }

  &::after {
    inset: 1px 1px auto 1px;
    height: 58%;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.08) 52%, rgba(255, 255, 255, 0));
    opacity: .96;
  }

  &.compact {
    width: 152px;
    max-width: 152px;
    min-width: 152px;
    height: 62px;
    min-height: 62px;
    gap: 8px;
    padding: 8px 10px 8px 8px;
    border-radius: 999px;
    justify-content: flex-start;
  }
}

:global(#player) {
  pointer-events: auto;
}

:global(#player[data-floating-compact='true']) {
  left: var(--player-window-gutter);
  transform: none;
  width: 152px;
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
  pointer-events: none;
}

.player:not(.compact) {
  .cover,
  .coverArt {
    border-radius: 10px;
  }

  .coverArt {
    animation: none;
    animation-play-state: paused;
  }
}

.coverArt {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
  transform: translateZ(0);
  transform-origin: center;
  will-change: transform;

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

.coverArtSpinning {
  animation-play-state: running;
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
  align-self: center;
  justify-self: center;
}

.compact .cover {
  width: 42px;
  height: 42px;
  border-radius: 999px;
}

.compact .coverArt {
  border-radius: 999px;
  animation: floatingIslandCoverSpin 15s linear infinite;
  animation-fill-mode: both;
  animation-play-state: paused;
}

.compact .coverArtSpinning {
  animation-play-state: running;
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
  transform-origin: right center;
  transition: min-width .34s cubic-bezier(0.2, 0.9, 0.2, 1), max-width .34s cubic-bezier(0.2, 0.9, 0.2, 1), transform .34s cubic-bezier(0.2, 0.9, 0.2, 1);
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
  transform: translateX(0);
  transform-origin: right center;
  transition: max-width .34s cubic-bezier(0.2, 0.9, 0.2, 1), width .34s cubic-bezier(0.2, 0.9, 0.2, 1), opacity .24s ease, transform .34s cubic-bezier(0.2, 0.9, 0.2, 1);
}

.compactControls {
  width: 0;
  max-width: 0;
  min-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  flex: none;
  transform: translateX(14px);
  transform-origin: right center;
  transition: max-width .34s cubic-bezier(0.2, 0.9, 0.2, 1), width .34s cubic-bezier(0.2, 0.9, 0.2, 1), opacity .24s ease, transform .34s cubic-bezier(0.2, 0.9, 0.2, 1);
  -webkit-app-region: no-drag;
}

.compact .expandedContent {
  max-width: 0;
  width: 0;
  opacity: 0;
  transform: translateX(18px);
  pointer-events: none;
}

.compact .compactControls {
  width: 74px;
  max-width: 74px;
  height: 100%;
  opacity: 1;
  pointer-events: auto;
  overflow: visible;
  position: relative;
  z-index: 9;
  transform: translateX(0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.compact .contentCluster {
  min-width: 0;
  width: 74px;
  max-width: 74px;
  flex: 1 1 auto;
  height: 100%;
  align-self: center;
  justify-content: flex-end;
  align-items: center;
  overflow: visible;
  position: relative;
  z-index: 9;
  -webkit-app-region: no-drag;
}

.compact .compactControls > * {
  pointer-events: auto;
}

.topRow {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 116px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
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
  grid-column: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  justify-self: center;
  width: 116px;
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
  overflow: visible;
  -webkit-app-region: no-drag;

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
    display: block;
    overflow: visible;
    transform-origin: center;
    fill: currentColor;
  }
}

.playBtn {
  width: 34px;
  height: 34px;
  color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 70%, var(--shell-text, #1b2230) 30%);
  border: 1px solid color-mix(in srgb, var(--shell-accent, var(--color-primary)) 20%, rgba(255, 255, 255, 0.72));
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 12%, rgba(255, 255, 255, 0.78)));
  box-shadow: 0 10px 18px rgba(27, 39, 65, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.46);
  transition-property: transform, opacity, background-color, box-shadow, color, border-color;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.94), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 20%, rgba(255, 255, 255, 0.8)));
    box-shadow: 0 12px 22px rgba(27, 39, 65, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.54);
  }

  &:active {
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.88), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 18%, rgba(255, 255, 255, 0.74)));
  }
}

.playing {
  color: rgba(255, 255, 255, 0.96);
  border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 28%, rgba(255, 255, 255, 0.68));
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 72%, white 28%));
  box-shadow: 0 12px 22px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 24%, transparent);

  &:hover {
    background: linear-gradient(135deg, color-mix(in srgb, var(--shell-accent, var(--color-primary)) 90%, white 10%), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 62%, white 38%));
    box-shadow: 0 14px 24px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 26%, transparent);
  }

  &:active {
    background: linear-gradient(135deg, color-mix(in srgb, var(--shell-accent, var(--color-primary)) 88%, black 12%), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 64%, white 36%));
  }
}

.compactPlayBtn {
  flex: none;
  width: 30px;
  height: 30px;
  align-self: center;
  justify-self: center;
  -webkit-app-region: no-drag;

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
  grid-column: 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  min-width: 0;
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
  justify-self: end;
  -webkit-app-region: no-drag;

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

@keyframes floatingIslandCoverSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
