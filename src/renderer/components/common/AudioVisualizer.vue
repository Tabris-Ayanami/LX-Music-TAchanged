<template>
  <div :class="[$style.content, $style[variant]]">
    <canvas ref="dom_canvas" :class="$style.canvas" />
  </div>
</template>

<script>
import { ref, onBeforeUnmount, onMounted } from '@common/utils/vueTools'
import { getAnalyser, getAudioContext } from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'
// import { appSetting } from '@renderer/store/setting'

// const themes = {
//   green: 'rgba(77,175,124,.16)',
//   blue: 'rgba(52,152,219,.16)',
//   yellow: 'rgba(233,212,96,.22)',
//   orange: 'rgba(245,171,53,.16)',
//   red: 'rgba(214,69,65,.12)',
//   pink: 'rgba(241,130,141,.16)',
//   purple: 'rgba(155,89,182,.14)',
//   grey: 'rgba(108,122,137,.16)',
//   ming: 'rgba(51,110,123,.14)',
//   blue2: 'rgba(79,98,208,.14)',
//   black: 'rgba(39,39,39,.4)',
//   mid_autumn: 'rgba(74,55,82,.1)',
//   naruto: 'rgba(87,144,167,.15)',
//   happy_new_year: 'rgba(192,57,43,.1)',
// }

export default {
  props: {
    variant: {
      type: String,
      default: 'full',
    },
    mode: {
      type: String,
      default: 'bars',
    },
  },
  setup(props) {
    const dom_canvas = ref(null)
    const analyser = getAnalyser()
    const audioContext = getAudioContext()

    let ctx
    let bufferLength = 0
    let dataArray
    let WIDTH
    let HEIGHT
    let isPlaying = false
    let animationFrameId
    let mountFrameId
    let lastDrawTime = 0
    let ambientEnergy = 0
    let ambientLow = 0
    let ambientMid = 0
    let ambientHigh = 0
    let waveX = new Float32Array(0)
    let waveY = new Float32Array(0)
    let waveEnvelope = new Float32Array(0)
    let waveFillGradient
    let barsGradient
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // const theme = useRefGetter('theme')
    // const setting = useRefGetter('setting')
    const resolveThemeColor = () => {
      const documentStyle = getComputedStyle(document.documentElement)
      const candidates = [
        documentStyle.getPropertyValue('--color-theme').trim(),
        documentStyle.getPropertyValue('--color-primary').trim(),
        documentStyle.getPropertyValue('--color-primary-light-200-alpha-800').trim(),
      ]
      return candidates.find(color => color && !/nan/i.test(color) && CSS.supports('color', color)) ??
        'rgba(205, 225, 255, .92)'
    }
    let themeColor = resolveThemeColor()
    // watch(theme, theme => {
    //   themeColor = themes[theme || 'green']
    // })

    // https://developer.mozilla.org/zh-CN/docs/Web/API/AnalyserNode/smoothingTimeConstant
    const drawWave = () => {
      analyser.getByteTimeDomainData(dataArray)
      const centerY = HEIGHT * 0.52
      const amplitude = HEIGHT * 0.44
      const pointCount = Math.min(dataArray.length, Math.max(180, Math.round(WIDTH / 3)))
      if (waveX.length != pointCount) {
        waveX = new Float32Array(pointCount)
        waveY = new Float32Array(pointCount)
        waveEnvelope = new Float32Array(pointCount)
        for (let i = 0; i < pointCount; i++) {
          waveX[i] = WIDTH * i / Math.max(1, pointCount - 1)
          waveEnvelope[i] = Math.sin(Math.PI * i / Math.max(1, pointCount - 1))
        }
      }

      for (let i = 0; i < pointCount; i++) {
        const sourceIndex = Math.floor(i * (dataArray.length - 1) / Math.max(1, pointCount - 1))
        const normalized = Math.max(-1, Math.min(1, (dataArray[sourceIndex] - 128) / 12))
        waveY[i] = centerY + normalized * amplitude * (0.18 + waveEnvelope[i] * 0.82)
      }

      if (!waveFillGradient) {
        waveFillGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
        waveFillGradient.addColorStop(0, 'rgba(255, 255, 255, .08)')
        waveFillGradient.addColorStop(0.5, themeColor)
        waveFillGradient.addColorStop(1, 'rgba(8, 10, 16, .02)')
      }

      ctx.beginPath()
      ctx.moveTo(waveX[0], waveY[0])
      for (let i = 1; i < pointCount - 1; i++) {
        const midpointX = (waveX[i] + waveX[i + 1]) / 2
        const midpointY = (waveY[i] + waveY[i + 1]) / 2
        ctx.quadraticCurveTo(waveX[i], waveY[i], midpointX, midpointY)
      }
      ctx.lineTo(waveX[pointCount - 1], waveY[pointCount - 1])
      ctx.lineTo(WIDTH, HEIGHT)
      ctx.lineTo(0, HEIGHT)
      ctx.closePath()
      ctx.globalAlpha = 0.24
      ctx.fillStyle = waveFillGradient
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(waveX[0], waveY[0])
      for (let i = 1; i < pointCount - 1; i++) {
        const midpointX = (waveX[i] + waveX[i + 1]) / 2
        const midpointY = (waveY[i] + waveY[i + 1]) / 2
        ctx.quadraticCurveTo(waveX[i], waveY[i], midpointX, midpointY)
      }
      ctx.lineTo(waveX[pointCount - 1], waveY[pointCount - 1])
      ctx.globalAlpha = 0.96
      ctx.lineWidth = Math.max(2.25, HEIGHT / 42)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = themeColor
      ctx.shadowColor = themeColor
      ctx.shadowBlur = Math.max(12, HEIGHT / 7)
      ctx.stroke()
      ctx.globalAlpha = 0.62
      ctx.lineWidth = Math.max(1, HEIGHT / 100)
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255, 255, 255, .96)'
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }

    const drawBars = () => {
      analyser.getByteFrequencyData(dataArray)
      const barCount = Math.max(28, Math.min(72, Math.round(WIDTH / 18)))
      const gap = Math.max(2, Math.min(5, WIDTH / 420))
      const barWidth = Math.max(2, (WIDTH - gap * (barCount - 1)) / barCount)
      const maxBarHeight = HEIGHT * (props.variant == 'bottom' ? 0.78 : 0.4)
      const usableBins = Math.max(1, Math.min(bufferLength, Math.round(bufferLength * 0.42)))
      if (!barsGradient) {
        barsGradient = ctx.createLinearGradient(0, HEIGHT, 0, HEIGHT - maxBarHeight)
        barsGradient.addColorStop(0, themeColor)
        barsGradient.addColorStop(0.72, themeColor)
        barsGradient.addColorStop(1, 'rgba(255, 255, 255, .96)')
      }

      ctx.fillStyle = barsGradient
      ctx.shadowColor = themeColor
      ctx.shadowBlur = Math.max(5, HEIGHT / 18)
      for (let i = 0; i < barCount; i++) {
        const ratio = i / Math.max(1, barCount - 1)
        const sourceIndex = Math.min(usableBins - 1, Math.floor(Math.pow(ratio, 1.7) * usableBins))
        const nextIndex = Math.min(usableBins - 1, sourceIndex + 1)
        const intensity = Math.pow((dataArray[sourceIndex] * 0.72 + dataArray[nextIndex] * 0.28) / 255, 0.78)
        const height = Math.max(3, intensity * maxBarHeight)
        const left = i * (barWidth + gap)

        ctx.globalAlpha = 0.34 + intensity * 0.66
        ctx.beginPath()
        ctx.roundRect(left, HEIGHT - height, barWidth, height, Math.min(3, barWidth / 2))
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }

    const averageRange = (start, end) => {
      const safeStart = Math.max(0, Math.min(dataArray.length - 1, start))
      const safeEnd = Math.max(safeStart + 1, Math.min(dataArray.length, end))
      let sum = 0
      for (let i = safeStart; i < safeEnd; i++) sum += dataArray[i]
      return sum / (safeEnd - safeStart) / 255
    }

    const addRoundedRectPath = (inset, radius) => {
      const right = WIDTH - inset
      const bottom = HEIGHT - inset
      ctx.beginPath()
      ctx.moveTo(inset + radius, inset)
      ctx.lineTo(right - radius, inset)
      ctx.arcTo(right, inset, right, inset + radius, radius)
      ctx.lineTo(right, bottom - radius)
      ctx.arcTo(right, bottom, right - radius, bottom, radius)
      ctx.lineTo(inset + radius, bottom)
      ctx.arcTo(inset, bottom, inset, bottom - radius, radius)
      ctx.lineTo(inset, inset + radius)
      ctx.arcTo(inset, inset, inset + radius, inset, radius)
      ctx.closePath()
    }

    const drawAmbient = timestamp => {
      analyser.getByteFrequencyData(dataArray)
      const nextLow = averageRange(2, 22)
      const nextMid = averageRange(22, 92)
      const nextHigh = averageRange(92, 210)
      ambientLow += (nextLow - ambientLow) * 0.18
      ambientMid += (nextMid - ambientMid) * 0.14
      ambientHigh += (nextHigh - ambientHigh) * 0.12
      const nextEnergy = ambientLow * 0.5 + ambientMid * 0.34 + ambientHigh * 0.16
      ambientEnergy += (nextEnergy - ambientEnergy) * 0.16

      const pulse = Math.min(1, Math.pow(ambientEnergy, 0.7) * 1.24)
      const thickness = Math.min(12, 5.5 + pulse * 6.5)
      const inset = thickness / 2 + 1
      const hue = (
        (reduceMotion ? 216 : timestamp * 0.008) +
        ambientLow * 52 +
        ambientMid * 24 -
        ambientHigh * 18
      ) % 360
      const gradient = ctx.createConicGradient(reduceMotion ? 0 : timestamp * 0.000045, WIDTH / 2, HEIGHT / 2)
      gradient.addColorStop(0, `hsl(${hue} 92% 66%)`)
      gradient.addColorStop(0.2, `hsl(${(hue + 62) % 360} 88% 64%)`)
      gradient.addColorStop(0.42, `hsl(${(hue + 142) % 360} 86% 62%)`)
      gradient.addColorStop(0.64, `hsl(${(hue + 218) % 360} 90% 66%)`)
      gradient.addColorStop(0.84, `hsl(${(hue + 294) % 360} 90% 64%)`)
      gradient.addColorStop(1, `hsl(${hue} 92% 66%)`)

      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.38 + pulse * 0.5
      ctx.lineWidth = thickness
      ctx.strokeStyle = gradient
      ctx.shadowColor = `hsl(${(hue + 28) % 360} 92% 66%)`
      ctx.shadowBlur = 7 + pulse * 9
      addRoundedRectPath(inset, Math.min(22, Math.max(8, WIDTH * 0.012)))
      ctx.stroke()

      ctx.globalAlpha = 0.16 + pulse * 0.22
      ctx.lineWidth = Math.max(1.5, thickness * 0.24)
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255, 255, 255, .9)'
      addRoundedRectPath(inset + thickness * 0.1, Math.min(20, Math.max(7, WIDTH * 0.011)))
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    const renderFrame = (timestamp = 0) => {
      if (timestamp - lastDrawTime < (reduceMotion ? 100 : 33)) {
        animationFrameId = window.requestAnimationFrame(renderFrame)
        return
      }
      lastDrawTime = timestamp

      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      if (props.mode == 'wave') drawWave()
      else if (props.mode == 'ambient') drawAmbient(timestamp)
      else drawBars()

      animationFrameId = null
      if (isPlaying && !reduceMotion) animationFrameId = window.requestAnimationFrame(renderFrame)
    }

    const startRendering = () => {
      if (!ctx || !dom_canvas.value) return
      if (!WIDTH || !HEIGHT) handleResize()
      if (!WIDTH || !HEIGHT) return
      if (animationFrameId) return
      // analyser.fftSize = 256
      bufferLength = props.mode == 'wave' ? analyser.fftSize : analyser.frequencyBinCount
      if (!dataArray || dataArray.length != bufferLength) dataArray = new Uint8Array(bufferLength)
      renderFrame()
    }
    const handlePlay = () => {
      isPlaying = true
      if (!ctx || !dom_canvas.value || !WIDTH || !HEIGHT) return
      if (audioContext.state == 'suspended') {
        void audioContext.resume()
          .catch(() => {})
          .finally(() => {
            if (isPlaying) startRendering()
          })
        return
      }
      startRendering()
    }
    const handlePause = () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
      lastDrawTime = 0
      isPlaying = false
    }

    const handleResize = () => {
      const canvas = dom_canvas.value
      if (!canvas) return
      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 112
      canvas.width = width
      canvas.height = height
      WIDTH = canvas.width
      HEIGHT = canvas.height
      themeColor = resolveThemeColor()
      waveX = new Float32Array(0)
      waveY = new Float32Array(0)
      waveEnvelope = new Float32Array(0)
      waveFillGradient = null
      barsGradient = null
    }

    onBeforeUnmount(() => {
      handlePause()
      if (mountFrameId) window.cancelAnimationFrame(mountFrameId)
      mountFrameId = null
      window.app_event.off('play', handlePlay)
      window.app_event.off('pause', handlePause)
      window.app_event.off('error', handlePause)
      window.removeEventListener('resize', handleResize)
    })

    onMounted(() => {
      const canvas = dom_canvas.value
      if (!canvas) return
      ctx = canvas.getContext('2d')
      handleResize()
      window.app_event.on('play', handlePlay)
      window.app_event.on('pause', handlePause)
      window.app_event.on('error', handlePause)
      window.addEventListener('resize', handleResize)
      mountFrameId = window.requestAnimationFrame(() => {
        mountFrameId = null
        handleResize()
        if (isPlay.value) handlePlay()
      })
    })

    return {
      dom_canvas,
    }
  },
}
</script>

<style lang="less" module>
.content {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}
.canvas {
  width: 100%;
  height: 100%;
  // opacity: 0.1;
}

.bottom {
  top: auto;
  bottom: 0;
  height: var(--immersive-visualizer-height, var(--immersive-control-height, 112px));
  z-index: 2;
  opacity: .96;
  background: linear-gradient(180deg, transparent, rgba(6, 8, 14, .16));
}

.ambient {
  inset: 0;
  z-index: 2;
  opacity: .92;
}
</style>
