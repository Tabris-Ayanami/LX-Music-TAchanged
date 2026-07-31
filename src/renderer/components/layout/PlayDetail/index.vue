<template lang="pug">
transition(@before-enter="handleBeforeEnter" @enter="handleEnter" @after-enter="handleAfterEnter" @before-leave="handleBeforeLeave" @leave="handleLeave" @after-leave="handleAfterLeave")
  div(v-show="isShowPlayerDetail" :class="[$style.container, $style[`layout-${layoutStyle}`], { fullscreen: isFullscreen, [$style.isPlaying]: isPlay }]" :style="detailStyle" @contextmenu="handleContextMenu")
    FluidBackground(v-if="layoutStyle != 'pixel' && backgroundType == 'aura'" :class="$style.bg" :cover="musicInfo.pic" :colors="detailColors" :active="visibled")
    div(v-else-if="layoutStyle != 'pixel'" :class="$style.bgBlur" :style="blurBackgroundStyle" aria-hidden="true")
    div(:class="$style.bgTint")
    div(:class="$style.bgGlow")
    ControlBtnsRightHeader(v-if="!isImmersive")
    div(v-if="layoutStyle == 'pixel' && !isImmersive" :class="$style.pixelTitleBar" :title="[musicInfo.name, musicInfo.singer].filter(Boolean).join(' · ')")
      strong {{ musicInfo.name }}
      span(v-if="musicInfo.singer") {{ musicInfo.singer }}
    div(v-show="!isImmersive" :class="[$style.main, {[$style.showComment]: isShowPlayComment}]")
      section.left(:class="$style.left")
        div(:class="$style.leftInner")
          button(type="button" :class="$style.artworkWrap" data-play-detail-artwork="true" aria-label="Close play detail" @click.stop="hide")
            img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
            div(v-else :class="$style.imgPlaceholder")
              svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
                use(xlink:href="#icon-album")
          div(:class="$style.controlsWrap")
            play-bar(v-if="visibled && layoutStyle != 'pixel'")

      transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
        LyricPlayer(v-if="visibled")
      music-comment(v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment")
      div(v-if="layoutStyle == 'pixel'" :class="$style.pixelEcho" :style="pixelEchoStyle" aria-hidden="true")
    div(v-if="visibled && layoutStyle == 'pixel' && !isImmersive" :class="$style.pixelControlZone" @touchstart="showPixelControls")
      play-bar(:class="[$style.pixelPlayBar, { [$style.pixelControlsVisible]: pixelControlsVisible }]")
    div(v-if="visibled && !isImmersive && layoutStyle != 'pixel'" :class="$style.bottomLeftDock")
      PlayQueueBtn(:class="$style.queueDock" placement="left" variant="detail")
    div(v-if="visibled && !isImmersive" :class="$style.bottomRightDock")
      PlayQueueBtn(v-if="layoutStyle == 'pixel'" :class="$style.queueDock" placement="left" variant="detail")
      button(type="button" :class="[$style.windowDockBtn, { [$style.windowDockBtnActive]: isShowPlayComment }]" :aria-label="$t('comment__show')" @click.stop="toggleComment")
        svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
          use(xlink:href="#icon-comment-modern")
      button(type="button" :class="$style.immersiveDockBtn" :aria-label="$t('player__immersive_mode')" :title="$t('player__immersive_mode')" @click.stop="showImmersive")
        svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
          path(d="M5 4.5h4M4.5 5v4M19 4.5h-4M19.5 5v4M5 19.5h4M4.5 19v-4M19 19.5h-4M19.5 19v-4")
    transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
      ImmersiveLyrics(v-if="visibled && isImmersive" @close="hideImmersive")
    transition(enter-active-class="animated-slow fadeIn" leave-active-class="animated-slow fadeOut")
      common-audio-visualizer(v-if="appSetting['common.isShowAnimation'] && appSetting['player.audioVisualization'] && visibled && !isImmersive")
</template>


<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  isPlay,
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
import FluidBackground from './FluidBackground.vue'
import MusicComment from './components/MusicComment/index.vue'
import PlayQueueBtn from './components/PlayQueueBtn.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import ImmersiveLyrics from './ImmersiveLyrics.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'
import { clearPlayDetailOrigin, getPlayDetailOrigin } from '@renderer/utils/playDetailTransition'

const PLAYER_SHELL_DURATION = 620
const PLAYER_CONTENT_DURATION = 360
const PLAYER_CONTENT_DELAY = 28
const PLAYER_FLOATING_REVEAL_DELAY = 440
const PLAYER_FLOATING_REVEAL_DURATION = 150
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

const getShellVisualStyles = state => ({
  background: state?.shellBackground || 'var(--shell-surface-strong, rgba(255, 255, 255, 0.9))',
  borderColor: state?.shellBorderColor || 'var(--shell-stroke, rgba(255, 255, 255, 0.18))',
  boxShadow: state?.shellBoxShadow || 'var(--shell-player-shadow, 0 20px 40px rgba(91, 113, 153, 0.18))',
  backdropFilter: state?.shellBackdropFilter || 'none',
  WebkitBackdropFilter: state?.shellWebkitBackdropFilter || 'none',
})

const getShellVisualStylesFromElement = (element) => {
  const styles = getComputedStyle(element)
  return getShellVisualStyles({
    shellBackground: styles.backgroundColor,
    shellBorderColor: styles.borderTopColor || styles.borderColor,
    shellBoxShadow: styles.boxShadow,
    shellBackdropFilter: styles.backdropFilter,
    shellWebkitBackdropFilter: styles.webkitBackdropFilter,
  })
}

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

const getFloatingIslandElement = () => {
  return document.querySelector('[data-play-floating-island="true"]')
}

const hideFloatingIslandShell = () => {
  const floatingIsland = getFloatingIslandElement()
  if (!floatingIsland) return null
  const previousOpacity = floatingIsland.style.opacity
  const previousVisibility = floatingIsland.style.visibility
  const previousPointerEvents = floatingIsland.style.pointerEvents
  floatingIsland.style.opacity = '0'
  floatingIsland.style.visibility = 'hidden'
  floatingIsland.style.pointerEvents = 'none'
  return {
    reveal() {
      floatingIsland.style.visibility = previousVisibility || 'visible'
      floatingIsland.style.opacity = '0'
      return floatingIsland.animate([
        { opacity: 0 },
        { opacity: previousOpacity || 1 },
      ], {
        duration: PLAYER_FLOATING_REVEAL_DURATION,
        easing: PLAYER_CONTENT_EASING,
        fill: 'both',
      })
    },
    restore() {
      floatingIsland.style.opacity = previousOpacity
      floatingIsland.style.visibility = previousVisibility
      floatingIsland.style.pointerEvents = previousPointerEvents
    },
  }
}

const createShellElement = snapshot => {
  const shell = document.createElement('div')
  setStyles(shell, {
    position: 'fixed',
    ...getRectStyles(snapshot.shellRect),
    borderRadius: snapshot.shellRadius || '22px',
    overflow: 'hidden',
    border: `1px solid ${snapshot.shellBorderColor || 'var(--shell-stroke, rgba(255, 255, 255, 0.18))'}`,
    ...getShellVisualStyles(snapshot),
    contain: 'paint',
    willChange: 'transform, border-radius, opacity',
    transform: 'translateZ(0)',
  })
  return shell
}

const createCoverElement = snapshot => {
  if (!snapshot.coverRect) return null
  const sourceImage = snapshot.coverImage
  let cover
  if (sourceImage?.complete && sourceImage.naturalWidth) {
    const canvas = document.createElement('canvas')
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(snapshot.coverRect.width * pixelRatio))
    canvas.height = Math.max(1, Math.round(snapshot.coverRect.height * pixelRatio))
    canvas.getContext('2d')?.drawImage(sourceImage, 0, 0, canvas.width, canvas.height)
    cover = canvas
  } else {
    cover = snapshot.coverSrc ? sourceImage?.cloneNode(true) ?? document.createElement('img') : document.createElement('div')
  }
  if (snapshot.coverSrc) {
    if (cover instanceof HTMLImageElement) {
      cover.src = snapshot.coverSrc
      cover.alt = ''
      cover.draggable = false
    } else {
      cover.setAttribute('aria-hidden', 'true')
    }
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
  const shellTargetVisual = getShellVisualStylesFromElement(el)
  const layer = createMotionLayer()
  const shell = createShellElement(snapshot)
  const cover = createCoverElement(snapshot)
  const floatingIslandShell = opening ? null : hideFloatingIslandShell()
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
          ...getShellVisualStyles(snapshot),
          opacity: 1,
        },
        {
          ...getRectStyles(shellTargetRect),
          borderRadius: shellTargetRadius,
          ...shellTargetVisual,
          opacity: 1,
          offset: 0.92,
        },
        {
          ...getRectStyles(shellTargetRect),
          borderRadius: shellTargetRadius,
          ...shellTargetVisual,
          opacity: 0,
          offset: 1,
        },
      ]
    : [
        {
          ...getRectStyles(shellTargetRect),
          borderRadius: shellTargetRadius,
          ...shellTargetVisual,
          opacity: 1,
        },
        {
          ...getRectStyles(snapshot.shellRect),
          borderRadius: snapshot.shellRadius || '22px',
          ...getShellVisualStyles(snapshot),
          opacity: 1,
        },
      ]

  const shellAnimation = shell.animate(shellFrames, {
    duration: PLAYER_SHELL_DURATION,
    easing: PLAYER_MOTION_EASING,
    fill: 'both',
  })

  const animations = [contentAnimation, shellAnimation]
  let floatingRevealTimer = null
  let floatingRevealAnimation = null

  if (floatingIslandShell) {
    floatingRevealTimer = window.setTimeout(() => {
      floatingRevealAnimation = floatingIslandShell.reveal()
    }, PLAYER_FLOATING_REVEAL_DELAY)
  }

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
    if (floatingRevealTimer) window.clearTimeout(floatingRevealTimer)
    cleanupContentStyle(el)
    layer.remove()
    floatingRevealAnimation?.cancel?.()
    floatingIslandShell?.restore()
    done()
  })
}

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsRightHeader,
    ImmersiveLyrics,
    LyricPlayer,
    PlayBar,
    FluidBackground,
    MusicComment,
    PlayQueueBtn,
  },
  setup() {
    const visibled = ref(false)
    const isImmersive = ref(false)
    const pixelControlsVisible = ref(false)
    const detailColors = ref(DEFAULT_DETAIL_COLORS)

    let clickTime = 0
    let colorTaskId = 0
    let pixelControlTimer = null

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
    const showImmersive = () => {
      hideComment()
      isImmersive.value = true
    }
    const hideImmersive = () => {
      isImmersive.value = false
    }
    const handleDetailKeydown = event => {
      if (event.key != 'Escape' || isImmersive.value || !isShowPlayerDetail.value) return
      event.preventDefault()
      event.stopPropagation()
      hide()
    }
    const showPixelControls = () => {
      pixelControlsVisible.value = true
      if (pixelControlTimer != null) window.clearTimeout(pixelControlTimer)
      pixelControlTimer = window.setTimeout(() => {
        pixelControlsVisible.value = false
        pixelControlTimer = null
      }, 2400)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()
      clearPlayDetailOrigin()
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      hideImmersive()
      pixelControlsVisible.value = false
      if (pixelControlTimer != null) {
        window.clearTimeout(pixelControlTimer)
        pixelControlTimer = null
      }
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

    onMounted(() => {
      document.addEventListener('keydown', handleDetailKeydown, true)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('keydown', handleDetailKeydown, true)
      if (pixelControlTimer != null) window.clearTimeout(pixelControlTimer)
    })

    const detailStyle = computed(() => ({
      '--detail-color-base': detailColors.value.base,
      '--detail-color-warm': detailColors.value.warm,
      '--detail-color-deep': detailColors.value.deep,
      '--detail-color-light': detailColors.value.light,
    }))
    const backgroundType = computed(() => appSetting['playDetail.background'] ?? 'aura')
    const layoutStyle = computed(() => appSetting['playDetail.layoutStyle'] ?? 'classic')
    const blurBackgroundStyle = computed(() => ({
      backgroundImage: musicInfo.pic ? `url("${String(musicInfo.pic).replace(/"/g, '\\"')}")` : undefined,
      '--detail-background-blur': `${appSetting['playDetail.backgroundBlur'] ?? 24}px`,
    }))
    const pixelEchoStyle = computed(() => ({
      backgroundImage: musicInfo.pic ? `url("${String(musicInfo.pic).replace(/"/g, '\\"')}")` : undefined,
    }))

    return {
      appSetting,
      detailStyle,
      detailColors,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      isPlay,
      isImmersive,
      backgroundType,
      layoutStyle,
      blurBackgroundStyle,
      pixelEchoStyle,
      pixelControlsVisible,
      musicInfo,
      hide,
      toggleComment,
      showImmersive,
      hideImmersive,
      showPixelControls,
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
  background-color: rgb(var(--detail-color-deep));
  z-index: 10;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  -webkit-app-region: no-drag;
  contain: strict;
  transform: translateZ(0);
  backface-visibility: hidden;

  box-sizing: border-box;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    background: rgb(var(--detail-color-deep));
    pointer-events: none;
  }

  * {
    box-sizing: border-box;
  }
}
.bg {
  position: absolute;
  inset: 0;
  opacity: 1;
  z-index: 1;
}
.bgBlur {
  position: absolute;
  inset: -7%;
  z-index: 1;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(var(--detail-background-blur, 24px)) saturate(1.08);
  transform: scale(1.08);
  opacity: .82;
}
.bgTint,
.bgGlow {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.bgTint {
  background:
    linear-gradient(180deg, rgba(9, 10, 14, 0) 0%, rgba(10, 11, 16, 0.08) 36%, rgba(9, 10, 14, 0.24) 100%),
    linear-gradient(112deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 28%, rgba(0, 0, 0, 0.12) 100%);
}
.bgGlow {
  background:
    radial-gradient(circle at 20% 20%, rgba(var(--detail-color-light), 0.08) 0%, transparent 34%),
    radial-gradient(circle at 84% 78%, rgba(0, 0, 0, 0.14) 0%, transparent 44%);
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
  z-index: 3;

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
  width: min(100%, 49vh, calc(var(--detail-left-column-width) - 44px));
  max-width: 100%;
  aspect-ratio: 1 / 1;
  max-height: none;
  justify-self: center;
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

.layout-record {
  .leftInner {
    margin-left: clamp(10px, 1.6vw, 24px);
    transform: translate3d(18px, 12px, 0);
  }

  .artworkWrap {
    padding: clamp(18px, 2.8vw, 38px);
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 48%, rgba(255, 255, 255, .14) 0 6%, transparent 6.5%),
      radial-gradient(circle, #141720 0 57%, #6a4e3b 58% 61%, #1a1d28 62% 76%, #0c0e14 77%);
    box-shadow: 0 28px 80px rgba(0, 0, 0, .42), inset 0 0 0 1px rgba(255, 255, 255, .14);
  }

  .img {
    position: relative;
    z-index: 1;
    border-radius: 50%;
    box-shadow: 0 12px 28px rgba(0, 0, 0, .36);
    animation: record-spin 18s linear infinite;
    animation-play-state: paused;
  }
}

.layout-record.isPlaying .img {
  animation-play-state: running;
}

.layout-pixel {
  // Album artwork is square. Keeping the left canvas tied to the viewport
  // height prevents a second background strip from appearing below the image.
  --pixel-artwork-size: min(64vw, 100vh);

  .main {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: block;
    padding: 0;
    overflow: hidden;

    &::after {
      position: absolute;
      inset: 0;
      z-index: 1;
      content: '';
      pointer-events: none;
      background:
        linear-gradient(
          90deg,
          transparent 0%,
          rgba(var(--detail-color-deep), .04) 36%,
          rgba(var(--detail-color-deep), .24) 49%,
          rgba(var(--detail-color-deep), .66) 66%,
          rgba(7, 9, 15, .9) 100%
        ),
        linear-gradient(
          180deg,
          rgba(7, 9, 15, .3) 0%,
          transparent 14%,
          transparent 76%,
          rgba(7, 9, 15, .42) 100%
        );
    }
  }

  .left {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 1;
    width: var(--pixel-artwork-size);
    height: 100%;
    max-width: none;
    min-width: 0;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 70%,
      rgba(0, 0, 0, .86) 83%,
      transparent 100%
    );
    mask-image: linear-gradient(
      90deg,
      #000 0%,
      #000 70%,
      rgba(0, 0, 0, .86) 83%,
      transparent 100%
    );

    &::after {
      position: absolute;
      inset: 0 0 0 auto;
      width: 34%;
      content: '';
      pointer-events: none;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(var(--detail-color-deep), .08) 38%,
        rgba(var(--detail-color-deep), .58) 100%
      );
    }
  }

  .leftInner {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    transform: none;
  }

  .artworkWrap {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    max-height: none;
    aspect-ratio: auto;
    border-radius: 0;
  }

  .img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    min-width: 100%;
    min-height: 100%;
    border-radius: 0;
    box-shadow: none;
    object-fit: cover;
    object-position: center;
    transform: scale(1.012);
  }

  .main > :global(.right) {
    --play-detail-seek-push: -12px;
    position: absolute;
    inset: 30px 0 0 calc(var(--pixel-artwork-size) - clamp(88px, 7vw, 132px));
    z-index: 2;
    padding: clamp(18px, 2.4vh, 34px) clamp(74px, 7vw, 118px) 0 clamp(28px, 3vw, 56px);
    background: transparent;
  }

  .bg,
  .bgBlur {
    opacity: .12;
  }

  .bgTint {
    background: linear-gradient(90deg, transparent 0 34%, rgba(7, 9, 15, .2) 62%, rgba(7, 9, 15, .48));
  }
}

.pixelTitleBar {
  position: absolute;
  top: 0;
  left: 200px;
  right: 200px;
  z-index: 5;
  height: 30px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, .8);
  font-size: 12px;
  text-shadow: 0 1px 10px rgba(0, 0, 0, .42);
  pointer-events: none;
  -webkit-app-region: drag;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    max-width: 45%;
    color: rgba(255, 255, 255, .92);
    font-weight: 650;
  }

  span {
    max-width: 32%;
    color: rgba(255, 255, 255, .58);

    &::before {
      margin-right: 8px;
      content: '·';
    }
  }
}

.pixelControlZone {
  position: absolute;
  inset: auto 0 0;
  z-index: 8;
  height: 112px;
  pointer-events: auto;
}

.pixelPlayBar {
  position: absolute !important;
  inset: auto 0 0;
  min-height: 94px;
  padding: 0 clamp(20px, 3vw, 48px) 16px;
  display: block !important;
  opacity: 0;
  transform: translateY(14px);
  pointer-events: none;
  transition: opacity .22s ease, transform .22s ease;
}

.pixelControlZone:hover .pixelPlayBar,
.pixelControlsVisible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.pixelPlayBar :global(.playDetailHeaderRow) {
  position: absolute;
  right: clamp(20px, 3vw, 48px);
  bottom: 24px;
  z-index: 12;
  width: auto;
  pointer-events: auto;
}

.pixelPlayBar :global(.playDetailMetaBlock) {
  display: none;
}

.pixelPlayBar :global(.playDetailHeaderRow .popupAnchor),
.pixelPlayBar :global(.playDetailHeaderRow .moreBtn) {
  pointer-events: auto;
}

.pixelPlayBar :global(.playDetailTimeRow) {
  position: absolute;
  left: clamp(20px, 3vw, 48px);
  bottom: 28px;
}

.pixelPlayBar :global(.playDetailTransportRow) {
  min-height: 64px;
  margin: 0 auto;
}

.pixelPlayBar :global(.playDetailVolumeRow) {
  position: absolute;
  left: clamp(82px, 9vw, 170px);
  bottom: 27px;
  width: min(180px, 18vw);
}

.pixelPlayBar :global(.playDetailProgressTrack) {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding-top: 0;
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
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;

  .immersiveDockBtn { order: 1; }
  .windowDockBtn { order: 2; }
}

.layout-pixel .bottomRightDock {
  top: clamp(54px, 7vh, 82px);
  right: clamp(18px, 2.4vw, 34px);
  bottom: auto;
  z-index: 12;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  backdrop-filter: none;

  .immersiveDockBtn,
  .windowDockBtn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(8, 11, 18, .08);

    &:hover {
      background: rgba(255, 255, 255, .1);
    }
  }

  .queueDock {
    order: 1;
    width: 44px;
    height: 44px;
    justify-content: center;
    color: rgba(255, 255, 255, .78);

    :global(button) {
      width: 44px;
      height: 44px;
    }
  }

  .windowDockBtn { order: 2; }
  .immersiveDockBtn { order: 3; }
}

.pixelEcho {
  position: absolute;
  inset: 0 0 0 34%;
  z-index: 0;
  background-position: right center;
  background-repeat: no-repeat;
  background-size: 3000% 100%;
  filter: blur(42px) saturate(1.22);
  opacity: .82;
  transform: scale(1.08);
}

.immersiveDockBtn {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, .78);
  background: transparent;
  cursor: pointer;
  transition: color @transition-fast, transform @transition-fast;

  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.65;
    stroke-linecap: round;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, .22));
  }

  &:hover {
    color: #fff;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--detail-color-light), .9);
    outline-offset: 3px;
  }
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
  transition: opacity @transition-fast;
}

@keyframes record-spin {
  to { transform: rotate(360deg); }
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
