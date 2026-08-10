<template>
  <teleport to="#root">
    <ul ref="dom_menu" :class="$style.list" :style="menuStyles" role="menu" :aria-hidden="!modelValue" @keydown="handleKeydown">
      <li
        v-for="item in menus"
        v-show="!item.hide && (item.action == 'download' ? appSetting['download.enable'] : true)"
        :key="item.action"
        :class="$style.listItem"
        role="menuitem"
        tabindex="0"
        :aria-label="item[itemName]"
        ignore-tip
        :aria-disabled="item.disabled ? 'true' : null"
        @click="menuClick(item)"
        @keydown.enter.space.stop.prevent="menuClick(item)"
      >
        {{ item[itemName] }}
      </li>
    </ul>
  </teleport>
</template>

<script>
import { computed } from '@common/utils/vueTools'
import useMenuLocation from '@renderer/utils/compositions/useMenuLocation'

import { appSetting } from '@renderer/store/setting'


export default {
  name: 'MenuToolBar',
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    xy: {
      type: Object,
      required: true,
    },
    menus: {
      type: Array,
      default() {
        return []
      },
    },
    itemName: {
      type: String,
      default: 'name',
    },
  },
  emits: ['update:modelValue', 'menu-click'],
  setup(props, { emit }) {
    const visible = computed(() => props.modelValue)
    const location = computed(() => props.xy)

    const onHide = () => {
      emit('update:modelValue', false)
      menuClick(null)
    }

    const { dom_menu, menuStyles } = useMenuLocation({
      visible,
      location,
      onHide,
    })

    const menuClick = (item) => {
      if (item?.disabled) return
      emit('menu-click', item)
    }

    const handleKeydown = event => {
      if (event.key == 'Escape') {
        event.preventDefault()
        onHide()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = Array.from(dom_menu.value?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') ?? [])
      if (!items.length) return
      event.preventDefault()
      const currentIndex = items.indexOf(document.activeElement)
      const nextIndex = event.key == 'Home'
        ? 0
        : event.key == 'End'
          ? items.length - 1
          : (currentIndex + (event.key == 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[nextIndex].focus()
    }

    return {
      dom_menu,
      menuStyles,
      menuClick,
      handleKeydown,
      appSetting,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  font-size: 12.5px;
  position: absolute;
  opacity: 0;
  transform: scale(.96);
  transform-origin: 0 0;
  transition: var(--motion-duration-fast) var(--motion-ease-out);
  transition-property: transform, opacity;
  border-radius: var(--radius-popover, 10px);
  border: 1px solid var(--shell-elevated-border, var(--shell-control-border));
  background:
    linear-gradient(180deg, var(--shell-edge-light), transparent 26%),
    var(--shell-popover, var(--shell-card-strong));
  box-shadow: var(--shell-elevated-shadow);
  z-index: 10;
  overflow: hidden;
  isolation: isolate;
  backdrop-filter: blur(26px) saturate(180%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);
  // will-change: transform;
}
.listItem {
  cursor: pointer;
  min-width: 132px;
  line-height: 32px;
  // color: var(--color-button-font);
  padding: 0 10px;
  text-align: left;
  outline: none;
  color: var(--shell-text, var(--color-font));
  transition: @transition-fast;
  transition-property: background-color, opacity;
  box-sizing: border-box;
  .mixin-ellipsis-1();
  // background-color: var(--color-primary-light-600-alpha-800);

  &:hover,
  &:focus-visible {
    background-color: var(--shell-list-hover, var(--color-list-hover-background));
    outline: none !important;
  }
  &:active {
    background-color: var(--shell-list-active, var(--color-list-active-background));
  }

  &[aria-disabled="true"] {
    cursor: default;
    opacity: .4;
    &:hover {
      background: none !important;
    }
  }
}

</style>
