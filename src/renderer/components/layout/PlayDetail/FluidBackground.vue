<template>
  <div :class="$style.layer" aria-hidden="true">
    <canvas ref="canvasRef" :key="canvasKey" :class="$style.canvas" />
    <div :class="$style.fallback" :style="fallbackStyle" />
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { WebWorkerBackgroundRender } from './auraBackground/renderer/WebWorkerBackgroundRender'

const DEFAULT_COLORS = {
  base: '176, 146, 112',
  warm: '229, 197, 156',
  deep: '90, 63, 38',
  light: '247, 236, 220',
}

const toCssRgb = value => `rgb(${value || DEFAULT_COLORS.base})`
const toAuraColors = colors => [
  toCssRgb(colors?.deep || DEFAULT_COLORS.deep),
  toCssRgb(colors?.base || DEFAULT_COLORS.base),
  toCssRgb(colors?.warm || DEFAULT_COLORS.warm),
  toCssRgb(colors?.light || DEFAULT_COLORS.light),
]

export default {
  props: {
    active: {
      type: Boolean,
      default: true,
    },
    cover: {
      type: String,
      default: '',
    },
    colors: {
      type: Object,
      default: () => DEFAULT_COLORS,
    },
  },
  setup(props) {
    const canvasRef = ref(null)
    const canvasKey = ref(0)
    let renderer = null
    let resizeObserver = null
    let coverTaskId = 0
    let coverAbortController = null
    let initTimer = null
    let resizeFrame = null
    let disposed = false

    const fallbackStyle = computed(() => ({
      background: `radial-gradient(circle at 20% 20%, rgba(${props.colors.light || DEFAULT_COLORS.light}, 0.34), transparent 36%),
        radial-gradient(circle at 82% 74%, rgba(${props.colors.base || DEFAULT_COLORS.base}, 0.38), transparent 44%),
        linear-gradient(135deg, rgb(${props.colors.deep || DEFAULT_COLORS.deep}), rgb(${props.colors.warm || DEFAULT_COLORS.warm}))`,
    }))

    const resize = () => {
      resizeFrame = null
      const canvas = canvasRef.value
      if (!canvas || !renderer) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      renderer.resize(
        Math.max(1, Math.floor(rect.width * dpr)),
        Math.max(1, Math.floor(rect.height * dpr)),
      )
    }

    const scheduleResize = () => {
      if (resizeFrame != null) return
      resizeFrame = window.requestAnimationFrame(resize)
    }

    const syncCover = cover => {
      const taskId = ++coverTaskId
      coverAbortController?.abort()
      coverAbortController = null
      if (!renderer) return
      if (!cover) return
      coverAbortController = new AbortController()
      void renderer.setCoverImage(cover, coverAbortController.signal).then(() => {
        if (taskId !== coverTaskId) return
        renderer?.setColors(toAuraColors(props.colors))
      }).finally(() => {
        if (taskId === coverTaskId) coverAbortController = null
      })
    }

    const cleanup = () => {
      coverAbortController?.abort()
      coverAbortController = null
      if (initTimer != null) {
        window.clearTimeout(initTimer)
        initTimer = null
      }
      if (resizeFrame != null) {
        window.cancelAnimationFrame(resizeFrame)
        resizeFrame = null
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      window.removeEventListener('resize', scheduleResize)
      renderer?.stop()
      renderer = null
    }

    const init = () => {
      if (disposed) return
      const canvas = canvasRef.value
      if (!canvas) return

      cleanup()
      if (canvas.dataset.offscreenTransferred === 'true') {
        canvasKey.value += 1
        return
      }
      if (!WebWorkerBackgroundRender.isSupported(canvas)) return

      renderer = new WebWorkerBackgroundRender(canvas)
      renderer.start(toAuraColors(props.colors))
      renderer.setPlaying(props.active)
      renderer.setPaused(!props.active)
      syncCover(props.cover)
      scheduleResize()

      if (window.ResizeObserver) {
        resizeObserver = new window.ResizeObserver(scheduleResize)
        resizeObserver.observe(canvas)
      } else {
        window.addEventListener('resize', scheduleResize)
      }
    }

    onMounted(init)

    onBeforeUnmount(() => {
      disposed = true
      cleanup()
    })

    watch(canvasKey, () => {
      if (initTimer != null) window.clearTimeout(initTimer)
      initTimer = window.setTimeout(() => {
        initTimer = null
        init()
      })
    })

    watch(() => props.active, active => {
      renderer?.setPlaying(active)
      renderer?.setPaused(!active)
    })

    watch(() => props.colors, colors => {
      renderer?.setColors(toAuraColors(colors))
    }, { deep: true })

    watch(() => props.cover, cover => {
      syncCover(cover)
    })

    return {
      canvasRef,
      canvasKey,
      fallbackStyle,
    }
  },
}
</script>

<style lang="less" module>
.layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: rgb(var(--detail-color-deep));
}

.canvas,
.fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.fallback {
  z-index: 0;
  filter: saturate(155%);
}

.canvas {
  z-index: 1;
  display: block;
}
</style>
