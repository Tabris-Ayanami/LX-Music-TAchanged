<template>
  <div ref="host" :class="$style.host" />
</template>

<script>
import { LyricPlayer as CoreLyricPlayer } from '@applemusic-like-lyrics/core'
import '@applemusic-like-lyrics/core/style.css'
import { onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'

const AMLL_OPTIMIZE_OPTIONS = {
  tryAdvanceStartTime: false,
}

export default {
  name: 'AmllLyricPlayer',
  props: {
    lines: {
      type: Array,
      default: () => [],
    },
    currentTime: {
      type: Number,
      default: 0,
    },
    playing: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['lineClick', 'lineContextmenu'],
  setup(props, { emit }) {
    const host = ref(null)
    let player = null
    let rafId = 0
    let lastFrameTime = -1
    let destroyed = false

    const frame = time => {
      if (destroyed || !player) return
      if (lastFrameTime > -1) player.update(time - lastFrameTime)
      lastFrameTime = time
      rafId = requestAnimationFrame(frame)
    }
    const handleLineClick = event => emit('lineClick', event)
    const handleLineContextmenu = event => emit('lineContextmenu', event)

    onMounted(() => {
      player = new CoreLyricPlayer()
      player.addEventListener('line-click', handleLineClick)
      player.addEventListener('line-contextmenu', handleLineContextmenu)
      host.value?.appendChild(player.getElement())
      player.setOptimizeOptions(AMLL_OPTIMIZE_OPTIONS)
      player.setLyricLines(props.lines, Math.max(0, Math.round(props.currentTime)))
      if (props.playing) player.resume()
      lastFrameTime = -1
      rafId = requestAnimationFrame(frame)
    })

    watch(() => props.lines, lines => {
      if (!player) return
      player.setOptimizeOptions(AMLL_OPTIMIZE_OPTIONS)
      player.setLyricLines(lines, Math.max(0, Math.round(props.currentTime)))
    })

    watch(() => props.currentTime, time => {
      if (!player) return
      player.setCurrentTime(Math.max(0, Math.round(time)))
    })

    watch(() => props.playing, playing => {
      if (!player) return
      if (playing) player.resume()
      else player.pause()
    })

    onBeforeUnmount(() => {
      destroyed = true
      cancelAnimationFrame(rafId)
      if (player) {
        player.removeEventListener('line-click', handleLineClick)
        player.removeEventListener('line-contextmenu', handleLineContextmenu)
        player.dispose()
        player = null
      }
    })

    return {
      host,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.host {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: clamp(14px, 2vw, 26px) clamp(18px, 2vw, 34px);
  --amll-lp-font-size: var(--playDetail-lrc-font-size, 1.4rem);
  --amll-lp-color: rgba(255, 255, 255, 0.86);
  --amll-lp-hover-bg-color: rgba(255, 255, 255, 0.06);

  :global(.amll-lyric-player) {
    width: 100%;
    height: 100%;
  }
}
</style>
