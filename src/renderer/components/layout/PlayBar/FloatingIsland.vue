<template>
  <div
    ref="playerRef"
    :class="[$style.player, { [$style.compact]: isFloatingIslandCompact }]"
    :style="playerStyle"
    data-play-floating-island="true"
    :data-floating-compact="isFloatingIslandCompact ? 'true' : 'false'"
  >
    <LiquidGlassLayer
      variant="island"
      :active="!isFloatingIslandCompact || isPlay"
      :interactive="true"
      :blur-amount="2.05"
      :saturation="214"
      :over-light="true"
    />
    <span :class="$style.coverAura" aria-hidden="true" />
    <button
      type="button"
      :class="$style.coverTrigger"
      :aria-label="$t('player__pic_tip')"
      @click.stop="showPlayerDetail"
      @contextmenu.prevent="handleToMusicLocation"
    >
      <div data-play-floating-cover="true" :class="$style.cover">
        <div :class="[$style.coverArt, { [$style.coverArtSpinning]: isShowAnimation && isFloatingIslandCompact && isPlay && musicInfo.pic }]">
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
            <div :class="[$style.utilityBtn, $style.volumeUtility]">
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
import { isShowAnimation } from '@renderer/store/setting'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import { capturePlayDetailOrigin } from '@renderer/utils/playDetailTransition'
import PlayQueueBtn from '@renderer/components/layout/PlayDetail/components/PlayQueueBtn.vue'
import DownloadModal from '@renderer/components/common/DownloadModal.vue'
import LiquidGlassLayer from '@renderer/components/common/liquidGlass/LiquidGlassLayer.vue'

export default {
  name: 'FloatingIslandBar',
  components: {
    PlayQueueBtn,
    DownloadModal,
    LiquidGlassLayer,
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
    const playerStyle = computed(() => ({
      '--floating-cover-image': musicInfo.pic ? `url("${String(musicInfo.pic).replace(/"/g, '\\"')}")` : 'none',
    }))

    return {
      musicInfo,
      isPlay,
      isShowAnimation,
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
      playerStyle,
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
  border: 1px solid transparent;
  background: transparent;
  box-shadow: var(--shell-player-shadow, 0 26px 54px rgba(82, 108, 160, 0.12));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: var(--shell-text, var(--color-font));
  transition: width .32s cubic-bezier(0.16, 1, 0.3, 1), height .28s cubic-bezier(0.16, 1, 0.3, 1), padding .28s cubic-bezier(0.16, 1, 0.3, 1), gap .28s cubic-bezier(0.16, 1, 0.3, 1), transform .22s ease-out, border-radius .28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .22s ease-out;
  transform: translateZ(0);
  backface-visibility: hidden;
  overflow: visible;
  contain: layout style;
  will-change: width, height, transform;
  pointer-events: auto;
  box-sizing: border-box;
  isolation: isolate;

  * {
    box-sizing: border-box;
  }

  &::before,
  &::after {
    display: none;
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

.coverTrigger,
.coverAura,
.contentCluster {
  position: relative;
  z-index: 1;
}

.coverAura {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    left: -20px;
    top: -6px;
    width: 240px;
    height: 112px;
    border-radius: 54px;
    background-image: var(--floating-cover-image);
    background-position: 44px center;
    background-size: 84px 84px;
    background-repeat: no-repeat;
    filter: blur(34px) saturate(186%);
    opacity: .58;
    transform: translateZ(0);
    -webkit-mask-image: radial-gradient(ellipse at 46% 50%, rgba(0, 0, 0, .9), rgba(0, 0, 0, .48) 48%, rgba(0, 0, 0, .08) 78%, rgba(0, 0, 0, 0) 100%);
    mask-image: radial-gradient(ellipse at 46% 50%, rgba(0, 0, 0, .9), rgba(0, 0, 0, .48) 48%, rgba(0, 0, 0, .08) 78%, rgba(0, 0, 0, 0) 100%);
  }
}

:global(#player) {
  pointer-events: auto;
  overflow: visible;
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
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.16) inset;
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
  overflow: visible;
  min-height: 0;
  transform-origin: right center;
  transition: min-width .34s cubic-bezier(0.16, 1, 0.3, 1), max-width .34s cubic-bezier(0.16, 1, 0.3, 1), transform .34s cubic-bezier(0.16, 1, 0.3, 1);
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
  overflow: visible;
  transform: translateX(0);
  transform-origin: right center;
  transition: max-width .34s cubic-bezier(0.16, 1, 0.3, 1), width .34s cubic-bezier(0.16, 1, 0.3, 1), opacity .24s ease, transform .34s cubic-bezier(0.16, 1, 0.3, 1);
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
  transition: max-width .34s cubic-bezier(0.16, 1, 0.3, 1), width .34s cubic-bezier(0.16, 1, 0.3, 1), opacity .24s ease, transform .34s cubic-bezier(0.16, 1, 0.3, 1);
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
  overflow: visible;
}

.iconBtn,
.compactToggleBtn,
.utilityBtn {
  --floating-btn-border: var(--shell-control-border, rgba(255, 255, 255, 0.34));
  --floating-btn-fill: linear-gradient(180deg, color-mix(in srgb, var(--shell-button-bg, rgba(255, 255, 255, 0.5)) 88%, rgba(255, 255, 255, 0.22)), color-mix(in srgb, var(--shell-button-bg, rgba(244, 249, 255, 0.26)) 72%, transparent));
  --floating-btn-shadow: 0 14px 24px rgba(0, 0, 0, 0.14), 0 6px 12px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.38) inset, 0 -1px 0 rgba(0, 0, 0, 0.1) inset, 0 0 0 1px rgba(255, 255, 255, 0.09) inset;
  width: 28px;
  height: 28px;
  border: 1px solid var(--floating-btn-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--floating-btn-fill);
  box-shadow: var(--floating-btn-shadow);
  backdrop-filter: blur(22px) saturate(178%);
  -webkit-backdrop-filter: blur(22px) saturate(178%);
  color: var(--shell-text, var(--color-button-font));
  cursor: pointer;
  transition: @transition-fast;
  transition-property: transform, opacity, background-color, box-shadow, border-color;
  overflow: visible;
  -webkit-app-region: no-drag;
  position: relative;
  isolation: isolate;
  transform: translateY(-1px);

  &::before {
    content: '';
    position: absolute;
    top: 1px;
    left: 3px;
    right: 3px;
    height: 44%;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.05));
    opacity: .7;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: auto 4px -4px;
    height: 8px;
    border-radius: 999px;
    background: radial-gradient(ellipse at 50% 50%, rgba(30, 42, 68, 0.14) 0%, rgba(30, 42, 68, 0.06) 42%, rgba(30, 42, 68, 0) 82%);
    filter: blur(4px);
    opacity: .48;
    pointer-events: none;
  }

  &:hover {
    opacity: .96;
    transform: translateY(-2px);
    box-shadow: 0 20px 34px rgba(0, 0, 0, 0.22), 0 8px 14px rgba(0, 0, 0, 0.14), 0 1px 0 rgba(255, 255, 255, 0.42) inset, 0 0 0 1px rgba(255, 255, 255, 0.16) inset;
    background: linear-gradient(180deg, color-mix(in srgb, var(--shell-button-bg-hover, rgba(255, 255, 255, 0.5)) 86%, rgba(255, 255, 255, 0.22)), color-mix(in srgb, var(--shell-button-bg-hover, rgba(245, 249, 255, 0.28)) 72%, transparent));
  }

  &:active {
    opacity: .88;
    transform: translateY(0) scale(0.98);
    box-shadow: 0 10px 16px rgba(28, 41, 68, 0.14), 0 2px 6px rgba(28, 41, 68, 0.1), 0 1px 0 rgba(255, 255, 255, 0.5) inset;
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

.volumeUtility {
  transform: translateY(-1px);

  &:hover,
  &:active {
    transform: translateY(-1px);
  }
}

.playBtn {
  width: 34px;
  height: 34px;
  color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 72%, var(--shell-text, #182236) 28%);
  transform: translateY(-2px);
  transition-property: transform, opacity, background-color, box-shadow, color, border-color, backdrop-filter;

  svg {
    width: 16px;
    height: 16px;
  }

  &::before {
    top: 2px;
    left: 5px;
    right: 5px;
    height: 42%;
    opacity: .64;
  }
}

.playing {
  color: rgba(255, 255, 255, 0.96);
  border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 24%, rgba(255, 255, 255, 0.62));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--shell-accent, var(--color-primary)) 76%, white 24%), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 72%, #2f65c8 28%));
  box-shadow:
    0 18px 30px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 24%, transparent),
    0 8px 14px rgba(27, 39, 65, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.42) inset,
    0 -1px 0 rgba(20, 38, 76, 0.18) inset,
    0 0 0 1px rgba(255, 255, 255, 0.24) inset;

  &:hover {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--shell-accent, var(--color-primary)) 70%, white 30%), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 66%, #2f65c8 34%));
    box-shadow:
      0 22px 34px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 26%, transparent),
      0 10px 16px rgba(27, 39, 65, 0.18),
      0 1px 0 rgba(255, 255, 255, 0.46) inset,
      0 -1px 0 rgba(20, 38, 76, 0.18) inset,
      0 0 0 1px rgba(255, 255, 255, 0.28) inset;
  }

  &:active {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--shell-accent, var(--color-primary)) 74%, #1b3f92 26%), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 62%, #244f9c 38%));
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
  overflow: visible;
}

.utilityBtn {
  width: 30px;
  height: 30px;
  color: var(--shell-text, var(--color-button-font));
  padding: 0;
  line-height: 0;

  :global(button) {
    width: 100%;
    height: 100%;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: inherit;
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
