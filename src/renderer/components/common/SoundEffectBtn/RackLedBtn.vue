<template>
  <button
    type="button"
    :class="[$style.btn, { [$style.on]: active }]"
    :disabled="disabled"
  >
    <span :class="$style.led" aria-hidden="true" />
    <span :class="$style.text"><slot /></span>
  </button>
</template>

<script setup>
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
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
  gap: 7px;
  padding: 5px 12px 5px 8px;
  border: 1px solid var(--shell-control-border);
  border-radius: 20px;
  background: var(--shell-control);
  color: var(--shell-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color @transition-fast, background-color @transition-fast, border-color @transition-fast;

  &:hover:not(:disabled) {
    color: var(--shell-text);
    background: var(--shell-list-hover);
  }

  &:disabled {
    opacity: .45;
    cursor: default;
  }
}

.on {
  color: var(--shell-text);
  border-color: color-mix(in srgb, var(--color-primary) 46%, var(--shell-control-border));
  background: var(--shell-list-active);
}

.led {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--shell-control-border);
  transition: background @transition-fast, box-shadow @transition-fast;

  .on & {
    background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--color-primary) 55%, white), var(--color-primary));
    box-shadow: 0 0 8px color-mix(in srgb, var(--color-primary) 65%, transparent);
  }
}

.text {
  min-width: 0;
  white-space: nowrap;
}
</style>
