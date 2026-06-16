<template>
  <VGlass
    :class="[$style.layer, $style[`variant_${variant}`], { [$style.active]: mergedActive }]"
    :blur="resolvedBlur"
    :scale="resolvedScale"
    :base-frequency="resolvedBaseFrequency"
    :num-octaves="resolvedNumOctaves"
    :style="{ borderRadius: radiusValue }"
    aria-hidden="true"
  >
    <span :class="$style.tint" />
    <span :class="$style.edge" />
    <span :class="$style.gloss" />
    <span v-if="interactive" :class="$style.hoverGlow" />
    <span v-if="interactive" :class="$style.pressGlow" />
  </VGlass>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VGlass from './VGlass.vue'

type Variant = 'search' | 'capsule' | 'island'

const props = withDefaults(defineProps<{
  variant?: Variant
  active?: boolean
  interactive?: boolean
  overLight?: boolean
  cornerRadius?: number | string
  displacementScale?: number
  blurAmount?: number
  saturation?: number
  aberrationIntensity?: number
  mode?: 'standard' | 'polar' | 'prominent'
}>(), {
  variant: 'island',
  active: false,
  interactive: false,
  overLight: false,
  cornerRadius: 'inherit',
  displacementScale: undefined,
  blurAmount: undefined,
  saturation: undefined,
  aberrationIntensity: undefined,
  mode: 'standard',
})

const variantDefaults: Record<Variant, { scale: number, blur: number, frequency: number, octaves: number }> = {
  search: { scale: 18, blur: 18, frequency: 0.012, octaves: 2 },
  capsule: { scale: 20, blur: 16, frequency: 0.011, octaves: 2 },
  island: { scale: 24, blur: 22, frequency: 0.009, octaves: 2 },
}

const radiusValue = computed(() => typeof props.cornerRadius === 'number' ? `${props.cornerRadius}px` : props.cornerRadius)
const currentVariant = computed<Variant>(() => props.variant == 'search' || props.variant == 'capsule' ? props.variant : 'island')
const currentDefaults = computed(() => variantDefaults[currentVariant.value])
const resolvedScale = computed(() => props.displacementScale ?? Math.max(6, currentDefaults.value.scale + (props.aberrationIntensity ?? 0) * 1.6))
const resolvedBlur = computed(() => props.blurAmount == null
  ? currentDefaults.value.blur + (props.overLight ? 4 : 0)
  : Math.max(0, props.blurAmount * 14 + (props.overLight ? 4 : 0)))
const resolvedBaseFrequency = computed(() => currentDefaults.value.frequency)
const resolvedNumOctaves = computed(() => currentDefaults.value.octaves)
const mergedActive = computed(() => props.active)
</script>

<style module lang="less">
.layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
  isolation: isolate;
}

.tint,
.edge,
.gloss,
.hoverGlow,
.pressGlow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity .22s ease-out, background-color .22s ease-out, box-shadow .22s ease-out;
}

.tint {
  background:
    radial-gradient(110% 90% at 16% 0%, rgba(255, 255, 255, .48), rgba(255, 255, 255, 0) 56%),
    linear-gradient(135deg, rgba(255, 255, 255, .28), rgba(255, 255, 255, .12) 48%, rgba(0, 0, 0, .06));
  opacity: .9;
}

.edge {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .74),
    inset 0 -1px 0 rgba(0, 0, 0, .14),
    inset 1px 0 0 rgba(255, 255, 255, .4),
    inset -1px 0 0 rgba(255, 255, 255, .18),
    0 18px 42px rgba(20, 29, 46, .14);
  opacity: .86;
}

.gloss {
  background:
    linear-gradient(100deg, rgba(255,255,255,.34), rgba(255,255,255,0) 28% 72%, rgba(255,255,255,.22)),
    radial-gradient(circle at 50% 0%, rgba(255,255,255,.72), rgba(255,255,255,.08) 42%, rgba(255,255,255,0) 72%);
  mix-blend-mode: screen;
  opacity: .58;
}

.hoverGlow {
  background: radial-gradient(circle at 50% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 58%);
  mix-blend-mode: overlay;
  opacity: 0;
}

.pressGlow {
  background: radial-gradient(circle at 50% 0%, rgba(255,255,255,.9), rgba(255,255,255,0) 78%);
  mix-blend-mode: overlay;
  opacity: 0;
}

.active {
  .tint {
    opacity: 1;
  }

  .edge {
    opacity: 1;
  }

  .gloss {
    opacity: .78;
  }
}

.active .hoverGlow {
  opacity: .34;
}

.active .pressGlow {
  opacity: .16;
}

.variant_search {
  .tint {
    background:
      radial-gradient(115% 92% at 16% 0%, rgba(255, 255, 255, .54), rgba(255, 255, 255, 0) 58%),
      linear-gradient(135deg, rgba(255,255,255,.32), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 10%, rgba(255,255,255,.12)) 62%, rgba(0,0,0,.04));
  }

  .edge {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .78),
      inset 0 -1px 0 rgba(0, 0, 0, .1),
      0 16px 34px rgba(32, 50, 80, .14);
  }
}

.variant_capsule {
  .tint {
    background:
      radial-gradient(115% 84% at 14% 0%, rgba(255, 255, 255, .42), rgba(255, 255, 255, 0) 56%),
      linear-gradient(136deg, rgba(255,255,255,.22), rgba(255,255,255,.08));
  }
}

.variant_island {
  .tint {
    background:
      radial-gradient(80% 120% at 12% 18%, rgba(255,255,255,.44), rgba(255,255,255,0) 54%),
      radial-gradient(90% 110% at 88% 24%, rgba(255,255,255,.3), rgba(255,255,255,0) 50%),
      linear-gradient(130deg, rgba(255,255,255,.38), rgba(237,245,255,.22) 48%, rgba(42,56,76,.12));
  }
}
</style>
