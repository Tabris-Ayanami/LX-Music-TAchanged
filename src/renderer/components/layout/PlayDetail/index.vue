<template lang="pug">
transition(@before-enter="handleBeforeEnter" @enter="handleEnter" @after-enter="handleAfterEnter" @before-leave="handleBeforeLeave" @leave="handleLeave" @after-leave="handleAfterLeave")
  div(v-if="isShowPlayerDetail" :class="[$style.container, { fullscreen: isFullscreen }]" :style="detailStyle" @contextmenu="handleContextMenu")
    div(:class="$style.bg" :style="bgStyle")
    div(:class="$style.bgTint")
    div(:class="$style.bgGlow")
    ControlBtnsRightHeader
    div(:class="[$style.main, {[$style.showComment]: isShowPlayComment}]")
      section.left(:class="$style.left")
        div(:class="$style.leftInner")
          button(type="button" :class="$style.artworkWrap" data-play-detail-artwork="true" aria-label="Close play detail" @click.stop="hide")
            img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
            div(v-else :class="$style.imgPlaceholder")
              svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
                use(xlink:href="#icon-album")
          div(:class="$style.controlsWrap")
            play-bar(v-if="visibled")

      transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
        LyricPlayer(v-if="visibled")
      music-comment(v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment")
    div(v-if="visibled" :class="$style.bottomLeftDock")
      PlayQueueBtn(:class="$style.queueDock" placement="left" variant="detail")
    div(v-if="visibled" :class="$style.bottomRightDock")
      button(type="button" :class="[$style.windowDockBtn, { [$style.windowDockBtnActive]: isShowPlayComment }]" :aria-label="$t('comment__show')" @click.stop="toggleComment")
        svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
          use(xlink:href="#icon-comment-modern")
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
import PlayQueueBtn from './components/PlayQueueBtn.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'
import { clearPlayDetailOrigin, getPlayDetailOrigin } from '@renderer/utils/playDetailTransition'

const PLAYER_SHELL_DURATION = 620
const PLAYER_CONTENT_DURATION = 360
const PLAYER_CONTENT_DELAY = 28
const PLAYER_MOTION_EASING = 'cubic-bezier(0.2, 0.88, 0.24, 1)'
const PLAYER_CONTENT_EASING = 'cubic-bezier(0.2, 0.72, 0.2, 1)'
const DEFAULT_DETAIL_COLORS = {
  base: '176, 146, 112',
  warm: '229, 197, 156',
  deep: '90, 63, 38',
  light: '247, 236, 220',
}

const setStyles = (el, styles) => {
  for (const [key, value] of Object.entries(styles)) el.style[key] = value
}

const cleanupContentStyle = el => {
  el.style.willChange = ''
  el.style.transform = ''
  el.style.opacity = ''
  el.style.filter = ''
}

const getRectStyles = rect => ({
  left: `${rect.left}px`,
  top: `${rect.top}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
})

const getArtworkElement = el => el.querySelector('[data-play-detail-artwork="true"]')

const clampChannel = value => Math.max(0, Math.min(255, Math.round(value)))
const mixColor = (source, target, ratio) => source.map((value, index) => clampChannel(value * (1 - ratio) + target[index] * ratio))
const toRgbText = rgb => rgb.map(clampChannel).join(', ')
const clampUnit = value => Math.max(0, Math.min(1, value))
const rgbToHsl = ([r, g, b]) => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  if (!delta) return [0, 0, lightness]

  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min)

  let hue
  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0)
      break
    case g:
      hue = (b - r) / delta + 2
      break
    default:
      hue = (r - g) / delta + 4
      break
  }
  return [hue * 60, saturation, lightness]
}
const hueToRgb = (p, q, t) => {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}
const hslToRgb = ([hue, saturation, lightness]) => {
  const h = ((hue % 360) + 360) % 360 / 360
  if (!saturation) {
    const channel = clampChannel(lightness * 255)
    return [channel, channel, channel]
  }
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  return [
    clampChannel(hueToRgb(p, q, h + 1 / 3) * 255),
    clampChannel(hueToRgb(p, q, h) * 255),
    clampChannel(hueToRgb(p, q, h - 1 / 3) * 255),
  ]
}
const enhanceColor = (rgb, {
  saturationBoost = 1,
  saturationLift = 0,
  lightnessShift = 0,
  hueShift = 0,
} = {}) => {
  const [hue, saturation, lightness] = rgbToHsl(rgb)
  return hslToRgb([
    hue + hueShift,
    clampUnit(saturation * saturationBoost + saturationLift),
    clampUnit(lightness + lightnessShift),
  ])
}
const getColorScore = (red, green, blue) => {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const saturation = max ? (max - min) / max : 0
  const lightness = (max + min) / 510
  return 0.4 + saturation * 2.2 + (1 - Math.min(1, Math.abs(lightness - 0.5) * 1.9)) * 0.85
}

const extractDetailColors = async pic => {
  if (!pic) return DEFAULT_DETAIL_COLORS
  return new Promise(resolve => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 40
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve(DEFAULT_DETAIL_COLORS)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let red = 0
        let green = 0
        let blue = 0
        let totalWeight = 0
        for (let index = 0; index < data.length; index += 16) {
          const alpha = data[index + 3]
          if (alpha < 42) continue
          const weight = getColorScore(data[index], data[index + 1], data[index + 2]) * (alpha / 255)
          red += data[index] * weight
          green += data[index + 1] * weight
          blue += data[index + 2] * weight
          totalWeight += weight
        }
        if (!totalWeight) {
          resolve(DEFAULT_DETAIL_COLORS)
          return
        }
        const sampled = [red / totalWeight, green / totalWeight, blue / totalWeight].map(clampChannel)
        const base = enhanceColor(sampled, {
          saturationBoost: 1.48,
          saturationLift: 0.07,
          lightnessShift: -0.02,
        })
        const warm = mixColor(enhanceColor(base, {
          saturationBoost: 1.22,
          saturationLift: 0.05,
          lightnessShift: 0.05,
          hueShift: -6,
        }), [255, 220, 178], 0.24)
        const deep = mixColor(enhanceColor(base, {
          saturationBoost: 1.1,
          saturationLift: 0.02,
          lightnessShift: -0.18,
        }), [18, 20, 30], 0.28)
        const light = mixColor(enhanceColor(base, {
          saturationBoost: 0.95,
          lightnessShift: 0.24,
        }), [255, 247, 236], 0.36)
        resolve({
          base: toRgbText(base),
          warm: toRgbText(warm),
          deep: toRgbText(deep),
          light: toRgbText(light),
        })
      } catch (error) {
        resolve(DEFAULT_DETAIL_COLORS)
      }
    }
    img.onerror = () => {
      resolve(DEFAULT_DETAIL_COLORS)
    }
    img.src = pic
  })
}

const createMotionLayer = () => {
  const layer = document.createElement('div')
  setStyles(layer, {
    position: 'fixed',
    inset: '0px',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '9999',
  })
  document.body.appendChild(layer)
  return layer
}

const createShellElement = snapshot => {
  const shell = document.createElement('div')
  setStyles(shell, {
    position: 'fixed',
    ...getRectStyles(snapshot.shellRect),
    borderRadius: snapshot.shellRadius || '22px',
    overflow: 'hidden',
    border: '1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18))',
    background: 'var(--shell-surface-strong, rgba(255, 255, 255, 0.9))',
    boxShadow: 'var(--shell-player-shadow, 0 20px 40px rgba(91, 113, 153, 0.18))',
    contain: 'paint',
    willChange: 'transform, border-radius, opacity',
    transform: 'translateZ(0)',
  })
  return shell
}

const createCoverElement = snapshot => {
  if (!snapshot.coverRect) return null
  const cover = snapshot.coverSrc ? document.createElement('img') : document.createElement('div')
  if (snapshot.coverSrc) {
    cover.src = snapshot.coverSrc
    cover.alt = ''
  } else {
    setStyles(cover, {
      background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04)), color-mix(in srgb, var(--color-primary-alpha-600) 45%, rgba(12, 16, 22, 0.82))',
    })
  }
  setStyles(cover, {
    position: 'fixed',
    ...getRectStyles(snapshot.coverRect),
    borderRadius: snapshot.coverRadius || '10px',
    overflow: 'hidden',
    objectFit: 'cover',
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.24)',
    contain: 'paint',
    willChange: 'transform, border-radius, opacity',
    transform: snapshot.coverTransform || 'translateZ(0)',
  })
  return cover
}

const getCoverTransform = (value) => value || 'translateZ(0)'

const toAnimationPromise = async animation => {
  if (!animation) return Promise.resolve()
  return new Promise(resolve => {
    animation.onfinish = resolve
    animation.oncancel = resolve
  })
}

const animateFallback = (el, opening, done) => {
  cleanupContentStyle(el)
  el.style.willChange = 'opacity, transform'
  const animation = el.animate(opening
    ? [
        { opacity: 0, transform: 'translateY(16px) scale(0.992)' },
        { opacity: 1, transform: 'translateY(0px) scale(1)' },
      ]
    : [
        { opacity: 1, transform: 'translateY(0px) scale(1)' },
        { opacity: 0, transform: 'translateY(16px) scale(0.992)' },
      ], {
    duration: opening ? PLAYER_CONTENT_DURATION + PLAYER_CONTENT_DELAY : PLAYER_CONTENT_DURATION,
    easing: PLAYER_CONTENT_EASING,
    fill: 'both',
  })

  void toAnimationPromise(animation).then(() => {
    cleanupContentStyle(el)
    done()
  })
}

const animatePlayDetail = (el, opening, done) => {
  if (!el.animate) {
    animateFallback(el, opening, done)
    return
  }

  const snapshot = getPlayDetailOrigin(!opening)
  const shellTargetRect = el.getBoundingClientRect()
  if (!snapshot?.shellRect || !shellTargetRect.width || !shellTargetRect.height) {
    animateFallback(el, opening, done)
    return
  }

  const artworkElement = getArtworkElement(el)
  const artworkTargetRect = artworkElement?.getBoundingClientRect()
  const shellTargetRadius = getComputedStyle(el).borderRadius || '18px'
  const artworkTargetRadius = artworkElement ? getComputedStyle(artworkElement).borderRadius || '28px' : '28px'
  const layer = createMotionLayer()
  const shell = createShellElement(snapshot)
  const cover = createCoverElement(snapshot)
  layer.appendChild(shell)
  if (cover) layer.appendChild(cover)

  cleanupContentStyle(el)
  el.style.willChange = 'opacity, transform'

  const contentAnimation = el.animate(opening
    ? [
        { opacity: 0, transform: 'translateY(14px) scale(0.994)' },
        { opacity: 1, transform: 'translateY(0px) scale(1)' },
      ]
    : [
        { opacity: 1, transform: 'translateY(0px) scale(1)' },
        { opacity: 0, transform: 'translateY(14px) scale(0.994)' },
      ], {
    duration: PLAYER_CONTENT_DURATION,
    delay: opening ? PLAYER_CONTENT_DELAY : 0,
    easing: PLAYER_CONTENT_EASING,
    fill: 'both',
  })

  const shellFrames = opening
    ? [
        {
          ...getRectStyles(snapshot.shellRect),
          borderRadius: snapshot.shellRadius || '22px',
          opacity: 1,
        },
        {
          ...getRectStyles(shellTargetRect),
          borderRadius: shellTargetRadius,
          opacity: 0.78,
          offset: 0.84,
        },
        {
          ...getRectStyles(shellTargetRect),
          borderRadius: shellTargetRadius,
          opacity: 0,
          offset: 1,
        },
      ]
    : [
        {
          ...getRectStyles(shellTargetRect),
          borderRadius: shellTargetRadius,
          opacity: 0.1,
        },
        {
          ...getRectStyles(snapshot.shellRect),
          borderRadius: snapshot.shellRadius || '22px',
          opacity: 1,
        },
      ]

  const shellAnimation = shell.animate(shellFrames, {
    duration: PLAYER_SHELL_DURATION,
    easing: PLAYER_MOTION_EASING,
    fill: 'both',
  })

  const animations = [contentAnimation, shellAnimation]

  if (cover && artworkTargetRect?.width && artworkTargetRect?.height) {
    const coverFrames = opening
      ? [
          {
            ...getRectStyles(snapshot.coverRect),
            borderRadius: snapshot.coverRadius || '10px',
            opacity: 1,
            transform: getCoverTransform(snapshot.coverTransform),
          },
          {
            ...getRectStyles(artworkTargetRect),
            borderRadius: artworkTargetRadius,
            opacity: 1,
            offset: 0.9,
            transform: 'translateZ(0)',
          },
          {
            ...getRectStyles(artworkTargetRect),
            borderRadius: artworkTargetRadius,
            opacity: 0,
            offset: 1,
            transform: 'translateZ(0)',
          },
        ]
      : [
          {
            ...getRectStyles(artworkTargetRect),
            borderRadius: artworkTargetRadius,
            opacity: 0.84,
            transform: 'translateZ(0)',
          },
          {
            ...getRectStyles(snapshot.coverRect),
            borderRadius: snapshot.coverRadius || '10px',
            opacity: 1,
            transform: getCoverTransform(snapshot.coverTransform),
          },
        ]

    const coverAnimation = cover.animate(coverFrames, {
      duration: PLAYER_SHELL_DURATION,
      easing: PLAYER_MOTION_EASING,
      fill: 'both',
    })
    animations.push(coverAnimation)
  }

  void Promise.all(animations.map(toAnimationPromise)).then(() => {
    cleanupContentStyle(el)
    layer.remove()
    done()
  })
}

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsRightHeader,
    LyricPlayer,
    PlayBar,
    MusicComment,
    PlayQueueBtn,
  },
  setup() {
    const visibled = ref(false)
    const detailColors = ref(DEFAULT_DETAIL_COLORS)

    let clickTime = 0
    let colorTaskId = 0

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
    const toggleComment = () => {
      setShowPlayComment(!isShowPlayComment.value)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()
      clearPlayDetailOrigin()
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      visibled.value = false

      unregisterAutoHideMounse()
      clearPlayDetailOrigin()
    }

    const handleBeforeEnter = el => {
      cleanupContentStyle(el)
      visibled.value = true
    }

    const handleEnter = (el, done) => {
      animatePlayDetail(el, true, done)
    }

    const handleBeforeLeave = el => {
      cleanupContentStyle(el)
    }

    const handleLeave = (el, done) => {
      animatePlayDetail(el, false, done)
    }

    watch(isFullscreen, isFullscreen => {
      (isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })

    watch(() => musicInfo.pic, async pic => {
      const taskId = ++colorTaskId
      const colors = await extractDetailColors(pic)
      if (taskId !== colorTaskId) return
      detailColors.value = colors
    }, { immediate: true })

    const detailStyle = computed(() => ({
      '--detail-color-base': detailColors.value.base,
      '--detail-color-warm': detailColors.value.warm,
      '--detail-color-deep': detailColors.value.deep,
      '--detail-color-light': detailColors.value.light,
    }))

    const bgStyle = computed(() => {
      const pic = musicInfo.pic
      return {
        backgroundImage: pic ? `url("${String(pic).replace(/"/g, '\\"')}")` : 'none',
        backgroundPosition: 'center center',
        backgroundSize: 'cover',
      }
    })


    return {
      appSetting,
      detailStyle,
      bgStyle,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      musicInfo,
      hide,
      toggleComment,
      handleContextMenu,
      hideComment,
      handleBeforeEnter,
      handleEnter,
      handleAfterEnter,
      handleBeforeLeave,
      handleLeave,
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
  --detail-color-base: 176, 146, 112;
  --detail-color-warm: 229, 197, 156;
  --detail-color-deep: 90, 63, 38;
  --detail-color-light: 247, 236, 220;
  --detail-side-control-size: 28px;
  --detail-center-control-size: 64px;
  --detail-secondary-control-size: 48px;
  --detail-left-column-width: clamp(430px, 30vw, 490px);
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
  transform: translateZ(0);
  backface-visibility: hidden;

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
  background-image: var(--background-image);
  background-position: var(--background-image-position);
  background-repeat: no-repeat;
  background-size: var(--background-image-size);
  opacity: 1;
  transform: scale(1.15);
  filter: blur(34px) saturate(235%) brightness(.9);
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
    linear-gradient(180deg, rgba(9, 10, 14, 0.02) 0%, rgba(10, 11, 16, 0.14) 34%, rgba(9, 10, 14, 0.3) 100%),
    radial-gradient(circle at 14% 18%, rgba(var(--detail-color-warm), 0.4) 0%, rgba(var(--detail-color-warm), 0.16) 26%, transparent 58%),
    radial-gradient(circle at 28% 72%, rgba(var(--detail-color-base), 0.34) 0%, rgba(var(--detail-color-base), 0.14) 28%, transparent 58%),
    linear-gradient(112deg, rgba(var(--detail-color-light), 0.16) 0%, rgba(255, 255, 255, 0.03) 24%, rgba(var(--detail-color-base), 0.26) 68%, rgba(var(--detail-color-deep), 0.26) 100%);
}
.bgGlow {
  background:
    radial-gradient(circle at 18% 24%, rgba(var(--detail-color-warm), 0.24) 0%, rgba(var(--detail-color-base), 0.1) 24%, transparent 46%),
    radial-gradient(circle at 54% 38%, rgba(var(--detail-color-light), 0.1) 0%, transparent 32%),
    radial-gradient(circle at 86% 76%, rgba(var(--detail-color-deep), 0.22) 0%, rgba(var(--detail-color-base), 0.08) 24%, transparent 52%);
}

.main {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  gap: clamp(42px, 4.6vw, 88px);
  padding: clamp(12px, 1.7vw, 22px) clamp(24px, 3vw, 42px) clamp(18px, 2vw, 28px);
  position: relative;

  &.showComment {
    :global {
      .comment {
        opacity: 1;
        transform: translate3d(0, 0, 0);
        pointer-events: auto;
      }
    }
  }
}
.left {
  position: relative;
  z-index: 1;
  flex: 0 0 var(--detail-left-column-width);
  max-width: min(44%, 600px);
  display: flex;
  min-width: 320px;
  overflow: visible;
  align-items: flex-start;
  transition: flex-basis @transition-normal;
}

.leftInner {
  display: grid;
  grid-template-rows: auto auto;
  align-content: start;
  justify-items: stretch;
  gap: 16px;
  width: var(--detail-left-column-width);
  max-width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 0 12px;
  margin-left: clamp(10px, 1.6vw, 24px);
  transform: translate3d(24px, 18px, 0);
}
.artworkWrap {
  position: relative;
  width: 100%;
  max-width: 100%;
  aspect-ratio: 1 / 1;
  max-height: min(49vh, calc(var(--detail-left-column-width) - 44px));
  margin: 0;
  flex: none;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 28px;
  overflow: hidden;

  &:focus {
    outline: none;
  }
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
.controlsWrap {
  width: 100%;
  max-width: 100%;
  margin: 0;
  min-height: 0;
}

.bottomLeftDock,
.bottomRightDock {
  position: absolute;
  bottom: clamp(22px, 3vw, 36px);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 18px;
}

.bottomLeftDock {
  left: clamp(34px, 3vw, 46px);
}

.bottomRightDock {
  right: clamp(34px, 3vw, 46px);
}

.windowDockBtn {
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity @transition-fast, transform @transition-fast, color @transition-fast;

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.22));
  }

  &:hover {
    color: rgba(255, 255, 255, 0.98);
    transform: translateY(-1px);
  }
}

.windowDockBtnActive {
  color: rgba(255, 255, 255, 0.98);
}

.queueDock {
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.78);
}

.comment {
  position: absolute;
  right: 0;
  top: clamp(26px, 3vw, 40px);
  width: min(36%, 500px);
  height: calc(100% - clamp(26px, 3vw, 40px));
  max-width: 500px;
  opacity: 0;
  transform: translate3d(34px, 0, 0);
  z-index: 2;
  pointer-events: none;
  transition: transform @transition-slow, opacity @transition-slow;
}

@media (max-width: 1100px) {
  .main {
    gap: 32px;
    padding: 18px 22px 24px;
  }
  .left {
    flex-basis: var(--detail-left-column-width);
    max-width: min(44%, 460px);
    min-width: 300px;
  }
  .leftInner {
    --detail-left-column-width: min(100%, 368px);
    padding: 0 0 8px;
    margin-left: 0;
    transform: translate3d(10px, 10px, 0);
  }
}

@media (max-width: 920px) {
  .main {
    padding: 14px 18px 22px;
    gap: 18px;
  }
  .left {
    flex-basis: min(100%, var(--detail-left-column-width));
    max-width: min(43%, 320px);
    min-width: 240px;
  }
  .leftInner {
    align-content: start;
    gap: 10px;
    --detail-left-column-width: min(100%, 300px);
    padding: 0 0 10px;
    margin-left: 0;
    transform: translate3d(8px, 9px, 0);
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
