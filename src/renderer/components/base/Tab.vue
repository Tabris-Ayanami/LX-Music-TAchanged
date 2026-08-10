<template>
  <ul :class="[$style.list, $style[align]]" role="tablist">
    <li
      v-for="item in list"
      :key="item[itemKey]" :class="[$style.listItem, {[$style.active]: modelValue == item[itemKey]}]" :tabindex="modelValue == item[itemKey] ? 0 : -1" role="tab"
      :aria-label="item[itemLabel]" ignore-tip :aria-selected="modelValue == item[itemKey]" @click="handleToggle(item[itemKey])" @keydown="handleKeydown($event, item[itemKey])"
    >
      <span :class="$style.label">{{ item[itemLabel] }}</span>
    </li>
  </ul>
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
    align: {
      type: String,
      default: 'left',
    },
    itemKey: {
      type: String,
      default: 'id',
    },
    itemLabel: {
      type: String,
      default: 'label',
    },
    modelValue: {
      type: [String, Number],
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const handleToggle = id => {
      if (id == props.modelValue) return
      emit('update:modelValue', id)
      emit('change', id)
    }

    const handleKeydown = (event, id) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
      if (!keys.includes(event.key) || !props.list.length) return
      event.preventDefault()
      const currentIndex = props.list.findIndex(item => item[props.itemKey] == id)
      const nextIndex = event.key == 'Home'
        ? 0
        : event.key == 'End'
          ? props.list.length - 1
          : (currentIndex + (event.key == 'ArrowRight' ? 1 : -1) + props.list.length) % props.list.length
      handleToggle(props.list[nextIndex][props.itemKey])
      event.currentTarget.parentElement?.children[nextIndex]?.focus()
    }

    return {
      handleToggle,
      handleKeydown,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  display: flex;
  flex-flow: row nowrap;
  font-size: 12px;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--shell-control-border, transparent);
  border-radius: 8px;
  background: var(--shell-control, transparent);

  &.left {
    justify-content: flex-start;
  }
  &.center {
    justify-content: center;
  }
  &.right {
    justify-content: flex-end;
  }
}
.listItem {
  display: block;
  border-radius: 7px;
  cursor: pointer;
  transition: color @transition-fast, background-color @transition-fast, box-shadow @transition-fast, transform @transition-fast;


  &:hover {
    color: var(--color-primary);
  }

  &:active:not(.active) {
    transform: scale(.97);
  }


  &.active {
    color: #fff;
    background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 82%, white), color-mix(in srgb, var(--color-primary) 58%, #111));
    box-shadow: 0 6px 14px color-mix(in srgb, var(--color-primary) 24%, transparent);
    cursor: default;

    >.label {
      &:after {
        // background-color: var(--color-primary);
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
}

.label {
  display: block;
  position: relative;
  padding: 6px 12px;
  white-space: nowrap;
  &:after {
    .mixin-after();
    left: 0;
    bottom: 0;
    width: 100%;
    height: 2px;
    border-radius: 20px;
    background-color: transparent;
    transform: translateY(-4px);
    opacity: 0;
    background-color: transparent;
    transition: @transition-fast;
    transition-property: transform, opacity;
  }
}
</style>
