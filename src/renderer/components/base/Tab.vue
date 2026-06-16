<template>
  <ul :class="[$style.list, $style[align]]" role="tablist">
    <li
      v-for="item in list"
      :key="item[itemKey]" :class="[$style.listItem, {[$style.active]: modelValue == item[itemKey]}]" tabindex="-1" role="tab"
      :aria-label="item[itemLabel]" ignore-tip :aria-selected="modelValue == item[itemKey]" @click="handleToggle(item[itemKey])"
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

    return {
      handleToggle,
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
  transition: color @transition-normal, background-color @transition-normal, box-shadow @transition-normal;


  &:hover {
    color: var(--color-primary);
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
