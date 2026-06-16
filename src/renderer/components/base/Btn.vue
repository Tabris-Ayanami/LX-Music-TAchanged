<template>
  <button
    :class="[$style.btn, {[$style.min]: min}, {[$style.outline]: outline}]"
    tabindex="0"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script>
export default {
  props: {
    min: {
      type: Boolean,
    },
    outline: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btn {
  display: inline-block;
  border: 1px solid var(--shell-control-border, color-mix(in srgb, var(--color-primary) 42%, rgba(255, 255, 255, 0.66)));
  border-radius: @form-radius;
  cursor: pointer;
  padding: 8px 15px;
  color: var(--shell-button-text, var(--color-button-font));
  outline: none;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  background-color: var(--shell-button-bg, color-mix(in srgb, var(--color-primary) 34%, rgba(255, 255, 255, 0.95)));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.46);
  font-size: 14px;
  &[disabled] {
    opacity: .4;
    cursor: default;
  }

  &.outline {
    background-color: transparent;
    color: var(--shell-button-text, var(--color-button-font));
    border-color: var(--shell-control-border, color-mix(in srgb, var(--color-primary) 46%, rgba(255, 255, 255, 0.62)));
  }

  &:hover {
    color: var(--shell-button-text, var(--color-button-font));
    background-color: var(--shell-button-bg-hover, color-mix(in srgb, var(--color-primary) 42%, rgba(255, 255, 255, 0.94)));
    border-color: color-mix(in srgb, var(--color-primary) 24%, var(--shell-control-border, rgba(255, 255, 255, 0.6)));
  }
  &:active {
    background-color: color-mix(in srgb, var(--shell-button-bg-hover, rgba(255, 255, 255, 0.94)) 82%, var(--color-primary));
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--shell-control-border, rgba(255, 255, 255, 0.54)));
  }
}

.min {
  padding: 3px 8px;
  font-size: 12px;
}

</style>
