<template>
  <div class="content" :class="[$style.select, show ? $style.active : '']">
    <div
      ref="dom_btn"
      class="label-content"
      :class="$style.label"
      role="combobox"
      tabindex="0"
      :aria-expanded="show"
      aria-haspopup="listbox"
      @click="handleToggle"
      @keydown.enter.space.stop.prevent="handleToggle"
      @keydown.escape.stop.prevent="handleHide()"
    >
      <span class="label">{{ label }}</span>
      <div class="icon" :class="$style.icon">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.847 451.847" space="preserve">
          <use xlink:href="#icon-down" />
        </svg>
      </div>
    </div>
    <ul v-if="show" ref="dom_list" class="selection-list scroll" :class="$style.list" :style="listStyles" role="listbox">
      <li
        v-for="(item, index) in list" :key="index" :class="[$style.listItem, (itemKey ? item[itemKey] : item) == modelValue ? $style.active : null]"
        role="option" :aria-selected="(itemKey ? item[itemKey] : item) == modelValue" :aria-label="itemName ? item[itemName] : item" @click="handleClick(item)"
      >
        {{ itemName ? item[itemName] : item }}
      </li>
    </ul>
  </div>
</template>

<script>

export default {
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    modelValue: {
      type: [String, Number],
      required: true,
    },
    itemName: {
      type: String,
      default: '',
    },
    itemKey: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      show: false,
      hideTimer: null,
      documentClickHandler: null,
      listOffset: 0,
      listStyles: {
        transform: 'translateY(0) scale(.97)',
        transformOrigin: '50% 0%',
        transitionDuration: '120ms',
      },
    }
  },
  computed: {
    activeIndex() {
      if (this.modelValue == null) return -1
      if (!this.itemName) return this.list.indexOf(this.modelValue)
      return this.list.findIndex(l => l[this.itemKey] == this.modelValue)
    },
    label() {
      if (this.modelValue == null) return ''
      if (this.itemName == null) return this.modelValue
      const item = this.list[this.activeIndex]
      if (!item) return ''
      return item[this.itemName]
    },
  },
  mounted() {
    this.attachDocumentListener()
  },
  activated() {
    this.attachDocumentListener()
  },
  deactivated() {
    this.handleHide()
    this.detachDocumentListener()
  },
  beforeUnmount() {
    this.detachDocumentListener()
    this.clearHideTimer()
  },
  methods: {
    attachDocumentListener() {
      if (!this.documentClickHandler) {
        this.documentClickHandler = (event) => {
          this.handleHide(event)
        }
      }
      document.removeEventListener('click', this.documentClickHandler, true)
      document.addEventListener('click', this.documentClickHandler, true)
    },
    detachDocumentListener() {
      if (!this.documentClickHandler) return
      document.removeEventListener('click', this.documentClickHandler, true)
    },
    clearHideTimer() {
      if (this.hideTimer == null) return
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    },
    handleHide(e) {
      if (!this.show) return
      // if (e && e.target.parentNode != this.$refs.dom_list && this.show) return this.show = false
      if (e && (e.target == this.$refs.dom_btn || this.$refs.dom_btn.contains(e.target))) return
      this.clearHideTimer()
      this.listStyles.transitionDuration = '120ms'
      this.listStyles.transform = `translateY(${this.listOffset}px) scale(.97)`
      if (!this.show) return
      this.hideTimer = setTimeout(() => {
        this.show = false
        this.hideTimer = null
      }, 120)
    },
    handleClick(item) {
      // console.log(this.modelValue)
      const value = this.itemKey ? item[this.itemKey] : item
      if (value === this.modelValue) {
        this.handleHide()
        return
      }
      this.$emit('update:modelValue', value)
      this.$emit('change', item)
      this.handleHide()
    },
    handleToggle() {
      this.show ? this.handleHide() : this.handleShow()
    },
    handleShow() {
      this.clearHideTimer()
      this.show = true
      this.$nextTick(() => {
        this.listOffset = this.handleGetOffset()
        this.listStyles.transitionDuration = '180ms'
        this.listStyles.transformOrigin = this.listOffset < 0 ? '50% 100%' : '50% 0%'
        this.listStyles.transform = `translateY(${this.listOffset}px) scale(1)`

        const activeItem = this.$refs.dom_list.children[this.activeIndex]
        if (activeItem) this.$refs.dom_list.scrollTop = activeItem.offsetTop - this.$refs.dom_list.clientHeight * 0.38
      })
    },
    handleGetOffset() {
      const listHeight = this.$refs.dom_list.clientHeight
      const dom_select = this.$refs.dom_list.offsetParent
      const dom_container = dom_select.offsetParent
      const containerHeight = dom_container.clientHeight
      if (containerHeight < listHeight) return 0
      const offsetHeight = (dom_container.scrollTop + containerHeight) - (dom_select.offsetTop + listHeight)
      if (offsetHeight > 0) return 0
      return offsetHeight - 5
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@selection-height: 28px;

.select {
  display: inline-block;
  font-size: 12px;
  position: relative;
  width: var(--selection-width, 300px);

  &.active {
    z-index: 12;
    .label {
      background-color: var(--color-button-background);
    }
    .list {
      opacity: 1;
      pointer-events: auto;
    }
    .icon {
      svg{
        transform: rotate(180deg);
      }
    }
  }
}

.label {
  background: var(--shell-control, color-mix(in srgb, var(--color-primary) 34%, rgba(255, 255, 255, 0.95)));
  border: 1px solid var(--shell-control-border, color-mix(in srgb, var(--color-primary) 42%, rgba(255, 255, 255, 0.66)));
  box-shadow: inset 0 1px 0 var(--shell-edge-light, rgba(255, 255, 255, 0.46));
  padding: 0 10px;
  transition: background-color @transition-normal, border-color @transition-normal, box-shadow @transition-normal;
  height: @selection-height;
  // line-height: 27px;
  line-height: 1.5;
  box-sizing: border-box;
  color: var(--shell-button-text, var(--color-button-font));
  border-radius: @form-radius;
  cursor: pointer;
  display: flex;
  align-items: center;

  span {
    flex: auto;
    .mixin-ellipsis-1();
  }
  .icon {
    flex: none;
    margin-left: 7px;
    line-height: 0;
    svg {
      width: 1em;
      transition: transform .2s ease;
      transform: rotate(0);
    }
  }

  &:hover {
    background-color: color-mix(in srgb, var(--color-primary) 24%, var(--shell-card-strong, rgba(255, 255, 255, 0.94)));
    border-color: color-mix(in srgb, var(--color-primary) 52%, var(--shell-control-border, rgba(255, 255, 255, 0.6)));
  }
  &:active {
    background-color: color-mix(in srgb, var(--color-primary) 32%, var(--shell-card-strong, rgba(255, 255, 255, 0.92)));
    border-color: color-mix(in srgb, var(--color-primary) 58%, var(--shell-control-border, rgba(255, 255, 255, 0.54)));
  }
}

.list {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background:
    linear-gradient(180deg, var(--shell-edge-light), transparent 26%),
    var(--shell-popover, var(--shell-card-strong, var(--color-main-background)));
  opacity: 0;
  transform: translateY(0) scale(.97);
  transform-origin: 50% 0;
  transition: var(--motion-duration-fast) var(--motion-ease-out);
  transition-property: transform, opacity;
  z-index: 10;
  border-radius: @form-radius;
  border: 1px solid var(--shell-elevated-border, var(--shell-control-border));
  box-shadow: var(--shell-elevated-shadow);
  overflow: auto;
  max-height: 200px;
  isolation: isolate;
  pointer-events: none;
}
.listItem {
  cursor: pointer;
  padding: 0 10px;
  line-height: @selection-height;
  // color: var(--color-button-font);
  outline: none;
  transition: background-color @transition-normal;
  background-color: transparent;
  color: var(--shell-text, var(--color-font));
  border: none;
  box-sizing: border-box;
  .mixin-ellipsis-1();

  &:hover,
  &:focus-visible {
    background-color: var(--shell-list-hover, var(--color-list-hover-background));
    outline: none !important;
  }
  &:active {
    background-color: var(--shell-list-active, var(--color-list-active-background));
  }
  &.active {
    color: var(--shell-button-text, var(--color-button-font));
    background-color: var(--shell-list-active, var(--color-list-active-background));
  }
}


</style>
