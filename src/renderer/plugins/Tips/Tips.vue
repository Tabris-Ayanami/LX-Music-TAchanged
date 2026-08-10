<template>
  <transition name="tips-fade" @after-leave="afterLeave">
    <div
      v-show="visible" ref="dom_tips" :style="{ left: position.left + 'px' , top: position.top + 'px', transform, maxWidth, }"
      :class="$style.tips" role="tooltip"
    >
      {{ message }}
    </div>
  </transition>
</template>

<script>
export default {
  props: {
    afterLeave: {
      type: Function,
      default: () => {},
    },
  },
  data() {
    return {
      visible: false,
      message: '',
      position: {
        top: 0,
        left: 0,
      },
      transform: 'translate(0, 0)',
      maxWidth: '80%',
      cancel: null,
      setTips: null,
      aotoCloseTimer: null,
    }
  },
  watch: {
    message() {
      this.$nextTick(() => {
        this.maxWidth = this.handleGetMaxWidth(this.position.left) + 'px'
        this.$nextTick(() => {
          this.transform = `translate(${this.handleGetOffsetXY(this.position.left, this.position.top)})`
        })
      })
    },
  },
  beforeUnmount() {
    const el = this.$el
    if (el?.parentNode) el.parentNode.removeChild(el)
  },
  methods: {
    handleGetMaxWidth(left) {
      const containerWidth = document.documentElement.clientWidth
      let maxWidth = containerWidth - left
      return (maxWidth > left ? maxWidth : left - 12) - 30
    },
    handleGetOffsetXY(left, top) {
      const tipsWidth = this.$refs.dom_tips.clientWidth
      const tipsHeight = this.$refs.dom_tips.clientHeight
      const dom_container = document.documentElement
      const containerWidth = dom_container.clientWidth
      const containerHeight = dom_container.clientHeight
      const offsetWidth = containerWidth - left - tipsWidth
      const offsetHeight = containerHeight - top - tipsHeight
      let x = 0
      let y = 0
      if (tipsWidth < left && containerWidth > tipsWidth && offsetWidth < 5) {
        x = -tipsWidth - 12
      }
      if (tipsHeight < top && containerHeight > tipsHeight && offsetHeight < 5) {
        y = -tipsHeight - 8
      }
      return `${x}px, ${y}px`
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.tips {
  position: fixed;
  // transform: scale(1);
  line-height: 1.2;
  word-wrap: break-word;
  padding: 6px 8px;
  z-index: 10001;
  font-size: 12px;
  // max-width: 80%;
  color: var(--shell-text, var(--color-font));
  border: 1px solid var(--shell-elevated-border, var(--shell-control-border));
  border-radius: 6px;
  background: var(--shell-popover, var(--color-content-background));
  overflow: hidden;
  pointer-events: none;
  // text-align: justify;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .24), inset 0 1px 0 var(--shell-edge-light);
  backdrop-filter: blur(18px) saturate(130%);
  white-space: pre-wrap;
  box-sizing: border-box;
}

:global(.tips-fade-enter-active), :global(.tips-fade-leave-active) {
  transition: opacity var(--motion-duration-exit) var(--motion-ease-out);
}
:global(.tips-fade-enter-from), :global(.tips-fade-leave-to) {
  opacity: 0;
}


</style>
