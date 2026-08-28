<template>
  <div ref="host" :class="[$style.host, $style['align_' + align]]" />
</template>

<script>
import { LyricPlayer as CoreLyricPlayer } from '@applemusic-like-lyrics/core'
import '@applemusic-like-lyrics/core/style.css'
import { onBeforeUnmount, onMounted, ref, watch, computed } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'

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
    const align = computed(() => appSetting['playDetail.style.align'])
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

    const applyAmllOptions = () => {
      if (!player) return
      player.setAlignPosition(appSetting['playDetail.amll.alignPosition'])
      player.setAlignAnchor(appSetting['playDetail.amll.alignAnchor'])
      player.setEnableBlur(appSetting['playDetail.amll.enableBlur'])
      player.setEnableSpring(appSetting['playDetail.amll.enableSpring'])
      player.setEnableScale(appSetting['playDetail.isZoomActiveLrc'])
    }

    onMounted(() => {
      player = new CoreLyricPlayer()
      player.addEventListener('line-click', handleLineClick)
      player.addEventListener('line-contextmenu', handleLineContextmenu)
      host.value?.appendChild(player.getElement())
      player.setOptimizeOptions(AMLL_OPTIMIZE_OPTIONS)
      applyAmllOptions()
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

    watch(() => [
      appSetting['playDetail.amll.alignPosition'],
      appSetting['playDetail.amll.alignAnchor'],
      appSetting['playDetail.amll.enableBlur'],
      appSetting['playDetail.amll.enableSpring'],
      appSetting['playDetail.isZoomActiveLrc'],
    ], applyAmllOptions)

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
      align,
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

  // AMLL 行内文字位置由 text-align 继承控制；transform-origin 跟随对齐方式，
  // 保证非激活行 97% 缩放时以正确的边缘为锚点（对唱行的右对齐规则不受影响）
  &.align_center {
    text-align: center;

    :global(.amll-lyric-player [class*='lyricLine']) {
      transform-origin: 50% 0;
    }
  }

  &.align_right {
    text-align: right;

    :global(.amll-lyric-player [class*='lyricLine']) {
      transform-origin: 100% 0;
    }
  }
}
</style>
