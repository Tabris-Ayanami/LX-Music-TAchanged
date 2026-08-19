<template>
  <label :class="[$style.root, { [$style.disabled]: disabled }]">
    <span v-if="label" :class="$style.label">{{ label }}</span>
    <button
      type="button"
      :class="[$style.control, { [$style.checked]: modelValue }]"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label || undefined"
      :disabled="disabled"
      @click="toggle"
    >
      <span :class="$style.thumb" />
    </button>
  </label>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  disabled?: boolean
  label?: string
}>(), {
  disabled: false,
  label: '',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const toggle = () => {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<style lang="less" module>
.root {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.label {
  color: var(--shell-text, var(--color-font));
}

.control {
  position: relative;
  width: 42px;
  height: 24px;
  flex: none;
  padding: 2px;
  border: 1px solid var(--shell-control-border, rgba(127, 145, 170, .28));
  border-radius: 999px;
  background: var(--shell-control, var(--color-button-background));
  cursor: pointer;
  transition: border-color var(--motion-duration-fast) var(--motion-ease-out), background-color var(--motion-duration-fast) var(--motion-ease-out);

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-primary) 55%, transparent);
    outline-offset: 2px;
  }
}

.thumb {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--shell-muted, var(--color-font-label));
  box-shadow: 0 1px 3px rgba(0, 0, 0, .24);
  transform: translateX(0);
  transition: transform var(--motion-duration-fast) var(--motion-ease-out), background-color var(--motion-duration-fast) var(--motion-ease-out);
}

.checked {
  border-color: var(--color-primary);
  background: var(--color-primary);

  .thumb {
    background: #fff;
    transform: translateX(18px);
  }
}

.disabled {
  cursor: not-allowed;
  opacity: .55;

  .control {
    cursor: not-allowed;
  }
}

@media (prefers-reduced-motion: reduce) {
  .control,
  .thumb {
    transition: none;
  }
}
</style>
