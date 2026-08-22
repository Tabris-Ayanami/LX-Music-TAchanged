<template>
  <div :class="[$style.progress, className]">
    <div :class="[$style.progressBar, $style.progressBar2, {[$style.barTransition]: isActiveTransition}]" :style="{ transform: `scaleX(${progress || 0})` }" @transitionend="handleTransitionEnd" />
    <div v-show="dragging" :class="[$style.progressBar, $style.progressBar3]" :style="{ transform: `scaleX(${dragProgress || 0})` }" />
    <div :class="[$style.progressThumb, { [$style.dragging]: dragging }]" :style="{ '--progress-ratio': dragging ? dragProgress : progress }" />
    <div
      ref="dom_progress"
      :class="$style.progressMask"
      role="slider"
      tabindex="0"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-valuenow="Math.round((dragging ? dragProgress : progress) * 100)"
      @keydown="handleKeyDown"
      @mousedown="handleMsDown"
    />
  </div>
</template>

<script>
import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { playProgress } from '@renderer/store/player/playProgress'

export default {
  props: {
    className: {
      type: String,
      default: '',
    },
    progress: {
      type: Number,
      required: true,
    },
    isActiveTransition: {
      type: Boolean,
      required: true,
    },
    handleTransitionEnd: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    const msEvent = {
      isMsDown: false,
      msDownX: 0,
      msDownProgress: 0,
    }
    const dom_progress = ref(null)
    const dragging = ref(false)
    const dragProgress = ref(0)

    const handleMsDown = event => {
      event.preventDefault()
      msEvent.isMsDown = true
      dragging.value = true
      msEvent.msDownX = event.clientX
      document.addEventListener('mousemove', handleMsMove)
      document.addEventListener('mouseup', handleMsUp)

      let val = event.offsetX / dom_progress.value.clientWidth
      if (val < 0) val = 0
      if (val > 1) val = 1

      dragProgress.value = msEvent.msDownProgress = val
    }
    const handleMsUp = () => {
      if (msEvent.isMsDown) setProgress(dragProgress.value * playProgress.maxPlayTime)
      msEvent.isMsDown = false
      dragging.value = false
      document.removeEventListener('mousemove', handleMsMove)
      document.removeEventListener('mouseup', handleMsUp)
    }
    const handleMsMove = event => {
      if (!msEvent.isMsDown) return

      let progress = msEvent.msDownProgress + (event.clientX - msEvent.msDownX) / dom_progress.value.clientWidth
      if (progress > 1) progress = 1
      else if (progress < 0) progress = 0
      dragProgress.value = progress
    }

    const handleKeyDown = event => {
      const step = playProgress.maxPlayTime > 0 ? Math.max(5 / playProgress.maxPlayTime, 0.01) : 0.01
      let nextProgress
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          nextProgress = props.progress - step
          break
        case 'ArrowRight':
        case 'ArrowUp':
          nextProgress = props.progress + step
          break
        case 'Home':
          nextProgress = 0
          break
        case 'End':
          nextProgress = 1
          break
        default:
          return
      }
      event.preventDefault()
      setProgress(Math.max(0, Math.min(1, nextProgress)) * playProgress.maxPlayTime)
    }

    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleMsMove)
      document.removeEventListener('mouseup', handleMsUp)
    })

    const setProgress = num => {
      window.app_event.setProgress(num)
    }

    // const handleSetProgress = event => {
    //   // setProgress(event.offsetX / dom_progress.value.clientWidth * playProgress.maxPlayTime)
    // }

    return {
      dom_progress,
      // handleSetProgress,
      dragging,
      dragProgress,
      handleMsDown,
      handleKeyDown,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.progress {
  --progress-thumb-size: 10px;
  --progress-thumb-color: rgba(255, 255, 255, .96);
  --progress-thumb-ring: rgba(0, 0, 0, .14);
  --progress-thumb-shadow: 0 1px 3px rgba(0, 0, 0, .22), 0 0 0 .5px var(--progress-thumb-ring);
  container-type: inline-size;
  width: 100%;
  height: 4px;
  overflow: visible;
  transition: height var(--motion-duration-fast) var(--motion-ease-out), background-color @transition-normal;
  background-color: var(--slider-track-color, color-mix(in srgb, var(--color-primary) 18%, transparent));
  // background-color: #f5f5f5;
  position: relative;
  border-radius: 40px;
}

.progress:hover,
.progress:focus-within {
  height: 6px;
}
.progressMask {
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  height: 20px;
  transform: translateY(-50%);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--focus-ring, var(--color-primary));
    outline-offset: 2px;
    border-radius: 999px;
  }
}
.progressBar {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0;
  border-radius: inherit;
}
.progressBar1 {
  background-color: var(--color-primary-light-100-alpha-600);
}

.progressBar2 {
  background-color: var(--slider-fill-color, var(--color-primary));
  will-change: transform;
}

.progressBar3 {
  background-color: var(--slider-drag-fill-color, var(--color-primary-light-100-alpha-200));
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
  opacity: 0.5;
}

.barTransition {
  transition-property: transform;
  transition-timing-function: var(--motion-ease-out);
  transition-duration: var(--motion-duration-fast);
}

.progressThumb {
  position: absolute;
  left: 0;
  top: 50%;
  width: var(--progress-thumb-size);
  height: var(--progress-thumb-size);
  border-radius: 50%;
  opacity: 0;
  background: var(--progress-thumb-color);
  box-shadow: var(--progress-thumb-shadow);
  transform: translateX(calc(var(--progress-ratio, 0) * (100cqw - var(--progress-thumb-size)))) translateY(-50%) scale(.74);
  transition: transform var(--motion-duration-fast) var(--motion-ease-out), opacity var(--motion-duration-fast) var(--motion-ease-out);
  pointer-events: none;

  &.dragging {
    opacity: 1;
    transform: translateX(calc(var(--progress-ratio, 0) * (100cqw - var(--progress-thumb-size)))) translateY(-50%) scale(1);
    transition-duration: 0ms;
  }
}

.progress:hover .progressThumb,
.progress:focus-within .progressThumb {
  opacity: 1;
  transform: translateX(calc(var(--progress-ratio, 0) * (100cqw - var(--progress-thumb-size)))) translateY(-50%) scale(1);
}

</style>
