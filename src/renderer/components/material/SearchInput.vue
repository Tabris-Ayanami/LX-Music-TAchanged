<template>
  <div :class="$style.container">
    <div :class="[$style.search, {[$style.active]: focus}, {[$style.expanded]: visibleList}, {[$style.big]: big}, {[$style.small]: small}]">
      <LiquidGlassLayer
        variant="search"
        :active="true"
        :interactive="true"
        :blur-amount="visibleList ? 1.18 : 0.9"
        :saturation="visibleList ? 168 : 148"
        :over-light="visibleList"
      />
      <div :class="$style.form">
        <input
          ref="dom_input"
          v-model.trim="text"
          :placeholder="placeholder"
          @focus="handleFocus"
          @blur="handleBlur"
          @input="$emit('update:modelValue', text)"
          @change="sendEvent('change')"
          @keyup.enter="handleSearch"
          @keydown.arrow-down.arrow-up.prevent
          @keyup.arrow-down.prevent="handleKeyDown"
          @keyup.arrow-up.prevent="handleKeyUp"
          @contextmenu="handleContextMenu"
        >
        <transition enter-active-class="animated zoomIn" leave-active-class="animated zoomOut">
          <button v-show="text" type="button" @click="handleClearList">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 24 24" space="preserve">
              <use xlink:href="#icon-window-close" />
            </svg>
          </button>
        </transition>
        <button type="button" @click="handleSearch">
          <slot>
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 30.239 30.239" space="preserve">
              <use xlink:href="#icon-search" />
            </svg>
          </slot>
        </button>
      </div>
      <div v-if="list" :class="$style.list" :style="listStyle">
        <ul ref="dom_list" @mouseleave="selectIndex = -1">
          <li
            v-for="(item, index) in list"
            :key="item"
            :class="{[$style.select]: selectIndex === index }"
            @mouseenter="selectIndex = index"
            @click="handleTemplistClick(index)"
          >
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { clipboardReadText } from '@common/utils/electron'
import { HOTKEY_COMMON } from '@common/hotKey'
import { appSetting } from '@renderer/store/setting'
import LiquidGlassLayer from '@renderer/components/common/liquidGlass/LiquidGlassLayer.vue'

export default {
  components: {
    LiquidGlassLayer,
  },
  props: {
    placeholder: {
      type: String,
      default: 'Search for something...',
    },
    list: {
      type: Array,
      default() {
        return []
      },
    },
    visibleList: {
      type: Boolean,
      default: false,
    },
    modelValue: {
      type: String,
      default: '',
    },
    big: {
      type: Boolean,
      default: false,
    },
    small: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'event'],
  data() {
    return {
      isShow: false,
      text: '',
      selectIndex: -1,
      focus: false,
      blurTimer: null,
      listStyle: {
        height: 0,
      },
    }
  },
  watch: {
    list() {
      if (!this.visibleList) return
      if (this.selectIndex > -1) this.selectIndex = -1
      this.$nextTick(this.updateListHeight)
    },
    modelValue(n) {
      this.text = n
    },
    visibleList(n) {
      n ? this.showList() : this.hideList()
    },
  },
  mounted() {
    if (appSetting['search.isFocusSearchBox']) this.handleFocusInput()
    this.handleRegisterEvent('on')
  },
  beforeUnmount() {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer)
      this.blurTimer = null
    }
    this.handleRegisterEvent('off')
  },
  methods: {
    updateListHeight() {
      const domList = this.$refs.dom_list
      this.listStyle.height = domList ? `${domList.scrollHeight}px` : '0px'
    },
    handleRegisterEvent(action) {
      let eventHub = window.key_event
      let name = action == 'on' ? 'on' : 'off'
      // eslint-disable-next-line @typescript-eslint/unbound-method
      eventHub[name](HOTKEY_COMMON.focusSearchInput.action, this.handleFocusInput)
    },
    handleFocusInput() {
      this.$refs.dom_input.focus()
    },
    handleTemplistClick(index) {
      console.log(index)
      this.sendEvent('listClick', index)
    },
    handleFocus() {
      if (this.blurTimer) {
        clearTimeout(this.blurTimer)
        this.blurTimer = null
      }
      this.focus = true
      this.sendEvent('focus')
    },
    handleBlur() {
      if (this.blurTimer) clearTimeout(this.blurTimer)
      this.blurTimer = setTimeout(() => {
        this.blurTimer = null
        this.focus = false
        this.sendEvent('blur')
      }, 80)
    },
    handleSearch() {
      this.hideList()
      if (this.selectIndex < 0) {
        this.sendEvent('submit')
        return
      }
      this.sendEvent('listClick', this.selectIndex)
    },
    showList() {
      this.isShow = true
      this.updateListHeight()
    },
    hideList() {
      this.isShow = false
      this.listStyle.height = 0
      this.$nextTick(() => {
        this.selectIndex = -1
      })
    },
    sendEvent(action, data) {
      this.$emit('event', {
        action,
        data,
      })
    },
    handleKeyDown() {
      if (this.list.length) {
        this.selectIndex = this.selectIndex + 1 < this.list.length ? this.selectIndex + 1 : 0
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleKeyUp() {
      if (this.list.length) {
        this.selectIndex = this.selectIndex - 1 < -1 ? this.list.length - 1 : this.selectIndex - 1
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleContextMenu() {
      let str = clipboardReadText()
      str = str.trim()
      str = str.replace(/\t|\r\n|\n|\r/g, ' ')
      str = str.replace(/\s+/g, ' ')
      let dom_input = this.$refs.dom_input
      this.text = this.text.substring(0, dom_input.selectionStart) + str + this.text.substring(dom_input.selectionEnd, this.text.length)
      this.$emit('update:modelValue', this.text)
    },
    handleClearList() {
      this.text = ''
      this.$emit('update:modelValue', this.text)
      this.sendEvent('submit')
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: relative;
  width: 100%;
  max-width: none;
  height: 48px;
  -webkit-app-region: no-drag;
}

.search {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  border-radius: 24px;
  transition: box-shadow .32s cubic-bezier(0.16, 1, 0.3, 1), border-color .2s ease-out, transform .32s cubic-bezier(0.16, 1, 0.3, 1), border-radius .32s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-flow: column nowrap;
  background: transparent;
  border: 1px solid transparent;
  box-shadow: 0 10px 22px rgba(12, 16, 24, 0.14), 0 3px 8px rgba(12, 16, 24, 0.1);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: hidden;
  isolation: isolate;
  will-change: border-radius, box-shadow, transform;

  &.active {
    border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 28%, rgba(255, 255, 255, .32));
    box-shadow:
      0 14px 30px rgba(12, 16, 24, 0.18),
      0 6px 14px rgba(12, 16, 24, 0.12),
      0 0 0 2px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 8%, transparent);
    transform: translateY(-1px);
    .form {
      input {
        border-bottom-left-radius: 0;
      }
      button {
        border-bottom-right-radius: 0;
      }
    }
  }

  &.expanded {
    border-radius: 24px 24px 28px 28px;
    box-shadow:
      0 16px 36px rgba(12, 16, 24, 0.22),
      0 7px 16px rgba(12, 16, 24, 0.14),
      0 0 0 2px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 8%, transparent);
  }

  .form {
    display: flex;
    height: 48px;
    position: relative;
    z-index: 1;
    input {
      flex: auto;
      border-top-left-radius: 23px;
      border-bottom-left-radius: 23px;
      background-color: transparent;
      border: none;
      min-width: 0;

      outline: none;
      padding: 0 14px;
      overflow: hidden;
      font-size: 13px;
      line-height: 48px;
      color: var(--shell-text, var(--color-font));
      &::placeholder {
        color: var(--shell-muted, var(--color-button-font));
        font-size: .98em;
      }
    }
    button {
      flex: none;
      border: none;
      // background-color: @color-search-form-background;
      background-color: transparent;
      outline: none;
      cursor: pointer;
      height: 100%;
      padding: 6px 8px;
      color: var(--color-button-font);
      transition: background-color .2s ease;

      svg {
        width: 20px;
        height: 20px;
      }

      &:last-child {
        border-top-right-radius: 23px;
        border-bottom-right-radius: 23px;
        padding-left: 6px;
        padding-right: 10px;

        svg {
          width: 17px;
          height: 17px;
        }
      }

      &:hover {
        background-color: rgba(255, 255, 255, 0.12);
      }
      &:active {
        background-color: rgba(255, 255, 255, 0.18);
      }
    }
  }
  .list {
    position: relative;
    z-index: 1;
    background: transparent;
    border-top: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    font-size: 13px;
    transition: height .34s cubic-bezier(0.16, 1, 0.3, 1);
    height: 0;
    overflow: hidden;
    isolation: isolate;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      border-radius: 0 0 26px 26px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.64), rgba(244, 248, 255, 0.52)),
        linear-gradient(130deg, color-mix(in srgb, var(--shell-accent, var(--color-primary)) 10%, transparent), rgba(255, 255, 255, 0));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.48),
        0 24px 52px rgba(35, 53, 84, 0.14);
      backdrop-filter: blur(32px) saturate(184%);
      -webkit-backdrop-filter: blur(32px) saturate(184%);
      opacity: 0;
      transform: scaleY(.92);
      transform-origin: top center;
      transition: opacity .28s ease, transform .34s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }

    ul {
      position: relative;
      z-index: 1;
      margin: 0;
      padding: 8px 0 10px;
      list-style: none;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity .22s ease, transform .28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    li {
      cursor: pointer;
      padding: 10px 8px;
      transition: background-color .2s ease;
      line-height: 1.3;
      span {
        .mixin-ellipsis-2();
      }

      &.select,
      &:hover {
        background-color: rgba(255, 255, 255, 0.12);
      }
      &:last-child {
        border-bottom-left-radius: 23px;
        border-bottom-right-radius: 23px;
      }
    }
  }
}

.expanded {
  .list {
    &::before {
      opacity: 1;
      transform: scaleY(1);
    }

    ul {
      opacity: 1;
      transform: translateY(0);
      transition-delay: .04s;
    }
  }
}

.big {
  width: 100%;
  // input {
  //   line-height: 30px;
  // }
  .form {
    height: 30px;
    button {
      padding: 6px 10px;
    }
  }
}

.small {
  border-radius: 20px;
  box-shadow: 0 10px 22px rgba(44, 61, 88, 0.12), 0 4px 10px rgba(44, 61, 88, 0.08);

  &.active {
    box-shadow:
      0 16px 34px rgba(32, 50, 80, 0.16),
      0 7px 16px rgba(32, 50, 80, 0.1),
      0 0 0 3px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 10%, transparent);
  }

  &.expanded {
    border-radius: 20px 20px 24px 24px;
  }

  .form {
    height: 38px;

    input {
      border-top-left-radius: 19px;
      border-bottom-left-radius: 19px;
      padding: 0 12px;
      font-size: 12px;
      line-height: 38px;
    }

    button {
      padding: 5px 7px;

      svg {
        width: 18px;
        height: 18px;
      }

      &:last-child {
        border-top-right-radius: 19px;
        border-bottom-right-radius: 19px;
        padding-right: 9px;

        svg {
          width: 16px;
          height: 16px;
        }
      }
    }
  }
}


</style>
