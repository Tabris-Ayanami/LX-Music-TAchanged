<template>
  <teleport :to="teleport">
    <div v-if="showModal" ref="dom_container" :class="$style.container">
      <transition
        :enter-active-class="$style.backdropEnterActive"
        :leave-active-class="$style.backdropLeaveActive"
        :enter-from-class="$style.backdropHidden"
        :leave-to-class="$style.backdropHidden"
      >
        <div v-show="showContent" :class="[$style.modal, {[$style.filter]: filter}]" @click="bgClose && close()">
          <transition
            :enter-active-class="$style.contentEnterActive"
            :leave-active-class="$style.contentLeaveActive"
            :enter-from-class="$style.contentHidden"
            :leave-to-class="$style.contentHidden"
            @after-enter="$emit('after-enter', $event)"
            @after-leave="handleAfterLeave"
          >
            <div v-show="showContent" :class="[$style.content, contentClass]" :style="contentStyle" @click.stop>
              <header v-if="!hideHeader" :class="$style.header">
                <button v-if="closeBtn" type="button" @click="close">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 212.982 212.982" space="preserve">
                    <use xlink:href="#icon-delete" />
                  </svg>
                </button>
              </header>
              <slot />
            </div>
          </transition>
        </div>
      </transition>
    </div>
  </teleport>
</template>

<script>
import { getRandom } from '@common/utils/common'
import { nextTick } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'

let modalCount = 0
export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    closeBtn: {
      type: Boolean,
      default: true,
    },
    bgClose: {
      type: Boolean,
      default: false,
    },
    teleport: {
      type: String,
      default: '#root',
    },
    maxWidth: {
      type: String,
      default: '76%',
    },
    minWidth: {
      type: String,
      default: '280px',
    },
    maxHeight: {
      type: String,
      default: '76%',
    },
    width: {
      type: String,
      default: 'auto',
    },
    height: {
      type: String,
      default: 'auto',
    },
    contentClass: {
      type: String,
      default: '',
    },
    hideHeader: {
      type: Boolean,
      default: false,
    },
    overlayFilterMode: {
      type: String,
      default: 'auto',
    },
    hostEffectMode: {
      type: String,
      default: 'dim',
    },
  },
  emits: ['after-enter', 'after-leave', 'close'],
  data() {
    return {
      modalStartScale: '.975',
      showModal: false,
      showContent: false,
      modalCount: false,
      isAddedClass: false,
    }
  },
  computed: {
    contentStyle() {
      return {
        maxWidth: this.maxWidth,
        minWidth: this.minWidth,
        width: this.width,
        height: this.height,
        maxHeight: this.maxHeight,
        '--modal-start-scale': this.modalStartScale,
      }
    },
    filter() {
      return this.overlayFilterMode == 'auto'
        ? this.teleport == '#root' || this.modalCount > 1
        : this.overlayFilterMode == 'on'
    },
    hostEffectClass() {
      return this.hostEffectMode == 'blur' ? 'show-modal-blur' : 'show-modal'
    },
  },
  watch: {
    show(val) {
      this.handleShowChange(val)
    },
  },
  mounted() {
    if (this.show) this.handleShowChange(true)
    this.setRandomAnimation()
  },
  beforeUnmount() {
    this.removeClass()
  },
  methods: {
    handleShowChange(val) {
      if (val) {
        // const dom = document.getElementById(this.teleport)
        // if (dom) {
        //   // dom.t
        // }
        this.setRandomAnimation()
        this.modalCount = ++modalCount
        this.showModal = true
        void nextTick(() => {
          const node = this.$refs.dom_container.parentNode
          if (!node.classList.contains(this.hostEffectClass)) {
            node.classList.add(this.hostEffectClass)
            this.isAddedClass = true
          }
          this.showContent = true
        })
      } else {
        if (modalCount > 0) this.modalCount = --modalCount
        this.removeClass()
        this.showContent = false
      }
    },
    removeClass() {
      if (!this.isAddedClass) return
      this.$refs.dom_container?.parentNode.classList.remove(this.hostEffectClass)
    },
    setRandomAnimation() {
      if (appSetting['common.randomAnimate']) {
        this.modalStartScale = ['.965', '.975', '.985'][getRandom(0, 3)]
      } else {
        this.modalStartScale = '.975'
      }
    },
    close() {
      this.$emit('close')
    },
    handleAfterLeave(event) {
      this.$emit('after-leave', event)
      this.showModal = false
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99;
}

.modal {
  width: 100%;
  height: 100%;
  // background-color: rgba(0, 0, 0, .2);
  // background-color: rgba(255, 255, 255, .6);
  // background-color: var(--color-primary-light-600-alpha-900);
  // backdrop-filter: blur(4px);
  // backdrop-filter: grayscale(70%);
  display: grid;
  align-items: center;
  justify-items: center;
  background: rgba(8, 12, 20, .28);
  // will-change: transform;

  &.filter {
    backdrop-filter: blur(5px) saturate(88%);
    -webkit-backdrop-filter: blur(5px) saturate(88%);
  }

  // &:before {
  //   .mixin-after();
  //   position: absolute;
  //   left: 0;
  //   top: 0;
  //   width: 100%;
  //   height: 100%;
  //   background-color: var(--color-000);
  //   opacity: .6;
  // }
}

.content {
  position: relative;
  border-radius: var(--radius-surface, 14px);
  border: 1px solid var(--shell-elevated-border, var(--shell-control-border));
  box-shadow: var(--shell-elevated-shadow);
  overflow: hidden;
  // max-height: 80%;
  // max-width: 76%;
  min-width: 220px;
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  z-index: 100;
  background:
    linear-gradient(180deg, var(--shell-edge-light), transparent 18%),
    var(--shell-modal, var(--shell-card-strong, rgba(255, 255, 255, .98)));
  isolation: isolate;
}

.backdropEnterActive {
  transition: opacity 220ms var(--motion-ease-out);
}
.backdropLeaveActive {
  transition: opacity 140ms var(--motion-ease-out);
}
.backdropHidden {
  opacity: 0;
}

.contentEnterActive {
  transform-origin: center;
  transition: opacity 220ms var(--motion-ease-out), transform 220ms var(--motion-ease-out);
}
.contentLeaveActive {
  transform-origin: center;
  transition: opacity 140ms var(--motion-ease-out), transform 140ms var(--motion-ease-out);
}
.contentHidden {
  opacity: 0;
  transform: scale(var(--modal-start-scale, .975));
}

.header {
  flex: none;
  background-color: color-mix(in srgb, var(--shell-surface-soft, rgba(255, 255, 255, .72)) 92%, var(--color-primary) 8%);
  border-bottom: 1px solid var(--shell-divider, rgba(0, 0, 0, .06));
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 30px;

  button {
    border: none;
    cursor: pointer;
    width: 30px;
    height: 30px;
    padding: 7px;
    background-color: transparent;
    color: var(--shell-muted, var(--color-font-label));
    outline: none;
    transition: transform @transition-fast, background-color @transition-fast, color @transition-fast;
    line-height: 0;

    svg {
      height: .7em;
    }

    &:hover {
      color: var(--shell-text, var(--color-font));
      background-color: var(--shell-button-bg-hover, var(--color-button-background-hover));
    }
    &:active {
      transform: scale(.92);
      background-color: var(--shell-list-active, var(--color-button-background-active));
    }
  }
}

</style>
