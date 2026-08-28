<template>
  <button type="button" :class="$style.btn" :disabled="disabled">
    <slot />
  </button>
</template>

<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 14px;
  border: 1px solid var(--shell-control-border);
  border-radius: 16px;
  background:
    linear-gradient(180deg, var(--shell-edge-light), transparent 45%),
    var(--shell-control);
  box-shadow:
    inset 0 1px 0 var(--shell-edge-light),
    inset 0 -2px 3px var(--shell-edge-shadow),
    0 2px 4px var(--shell-edge-shadow);
  color: var(--color-primary);
  font-size: 12px;
  text-shadow: 0 1px 0 var(--shell-edge-light);
  cursor: pointer;
  transition: box-shadow @transition-fast, transform @transition-fast, opacity @transition-fast;

  &:hover:not(:disabled) {
    box-shadow:
      inset 0 1px 0 var(--shell-edge-light),
      inset 0 -2px 3px var(--shell-edge-shadow),
      0 2px 6px color-mix(in srgb, var(--color-primary) 30%, transparent);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 4px var(--shell-edge-shadow),
      inset 0 -1px 0 var(--shell-edge-light);
  }

  &:disabled {
    opacity: .45;
    cursor: default;
  }
}
</style>
