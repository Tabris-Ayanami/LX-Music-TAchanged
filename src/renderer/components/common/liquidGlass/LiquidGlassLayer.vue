<template>
  <div
    ref="rootRef"
    :class="[$style.layer, $style[`variant_${variant}`], { [$style.active]: mergedActive }]"
    :style="{ borderRadius: radiusValue }"
    aria-hidden="true"
  >
    <GlassFilter
      :id="filterId"
      :mode="mode"
      :displacement-scale="resolvedDisplacementScale"
      :aberration-intensity="resolvedAberrationIntensity"
      :width="glassSize.width"
      :height="glassSize.height"
    />
    <span :class="$style.warp" :style="warpStyle" />
    <span :class="$style.surfaceTint" :style="surfaceTintStyle" />
    <span :class="$style.contour" :style="contourStyle" />
    <span :class="$style.edgeScreen" :style="edgeScreenStyle" />
    <span :class="$style.edgeOverlay" :style="edgeOverlayStyle" />
    <span :class="$style.rimLight" :style="rimLightStyle" />
    <span :class="$style.gloss" :style="glossStyle" />
    <span v-if="interactive" :class="$style.hoverGlow" :style="hoverGlowStyle" />
    <span v-if="interactive" :class="$style.pressGlow" :style="pressGlowStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import GlassFilter from './GlassFilter.vue'
import Container from './vendor/liquid-glass-js/container'
import './vendor/liquid-glass-js/glass.css'
import { autoPx, uuid } from './utils'

type Variant = 'search' | 'capsule' | 'island'
interface VendorGlassRefs {
  gl?: WebGLRenderingContext
  blurRadiusLoc?: WebGLUniformLocation | null
  tintOpacityLoc?: WebGLUniformLocation | null
  borderRadiusLoc?: WebGLUniformLocation | null
}
interface VendorGlassContainer {
  element: HTMLDivElement | null
  canvas: HTMLCanvasElement | null
  gl_refs: VendorGlassRefs
  updateSizeFromDOM: () => void
  destroy?: () => void
  render?: () => void
}
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

const rootRef = ref<HTMLDivElement | null>(null)
const hostRef = ref<HTMLElement | null>(null)
const glassSize = ref({ width: 0, height: 0 })
const mouseOffset = ref({ x: 0, y: 0 })
const isHovered = ref(false)
const isPressed = ref(false)
const filterId = `liquid-glass-${uuid()}`
let resizeObserver: ResizeObserver | null = null
let vendorContainer: VendorGlassContainer | null = null

const variantDefaults: Record<Variant, { displacementScale: number, blurAmount: number, saturation: number, aberrationIntensity: number }> = {
  // Keep the chromatic aberration opt-in only. The vendor demo uses visible RGB splitting,
  // but inside this player shell it creates orange/pink edge fringes on light surfaces.
  search: { displacementScale: 56, blurAmount: 0.72, saturation: 176, aberrationIntensity: 0 },
  capsule: { displacementScale: 60, blurAmount: 0.66, saturation: 178, aberrationIntensity: 0 },
  island: { displacementScale: 70, blurAmount: 0.8, saturation: 184, aberrationIntensity: 0 },
}

const currentVariant = computed<Variant>(() => props.variant)
const radiusValue = computed(() => typeof props.cornerRadius === 'number' ? `${props.cornerRadius}px` : props.cornerRadius)
const resolvedDisplacementScale = computed(() => props.displacementScale ?? variantDefaults[currentVariant.value].displacementScale)
const resolvedBlurAmount = computed(() => props.blurAmount ?? variantDefaults[currentVariant.value].blurAmount)
const resolvedSaturation = computed(() => props.saturation ?? variantDefaults[currentVariant.value].saturation)
const resolvedAberrationIntensity = computed(() => props.aberrationIntensity ?? variantDefaults[currentVariant.value].aberrationIntensity)
const mergedActive = computed(() => props.active || isHovered.value || isPressed.value)

const commonLayerStyle = computed<Partial<CSSProperties>>(() => ({
  borderRadius: radiusValue.value,
  width: autoPx(glassSize.value.width),
  height: autoPx(glassSize.value.height),
}))

const warpStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  filter: `url(#${filterId})`,
}))

const surfaceTintStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  opacity: mergedActive.value ? 1 : 0.96,
  backdropFilter: `blur(${(props.overLight ? 28 : 8) + resolvedBlurAmount.value * 48}px) saturate(${resolvedSaturation.value}%)`,
  WebkitBackdropFilter: `blur(${(props.overLight ? 28 : 8) + resolvedBlurAmount.value * 48}px) saturate(${resolvedSaturation.value}%)`,
  backgroundColor: currentVariant.value === 'search'
    ? 'rgba(255, 255, 255, 0.11)'
    : currentVariant.value === 'island'
      ? 'rgba(238, 246, 255, 0.32)'
      : 'rgba(255, 255, 255, 0.1)',
  backgroundImage: currentVariant.value === 'island'
    ? 'radial-gradient(80% 120% at 12% 18%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 54%), radial-gradient(90% 110% at 88% 24%, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 50%), linear-gradient(130deg, rgba(255, 255, 255, 0.38) 0%, rgba(237, 245, 255, 0.22) 48%, rgba(42, 56, 76, 0.12) 100%)'
    : 'radial-gradient(120% 82% at 16% 0%, rgba(255, 255, 255, 0.44) 0%, rgba(255, 255, 255, 0) 56%), linear-gradient(136deg, rgba(255, 255, 255, 0.28) 0%, rgba(246, 249, 255, 0.16) 54%, rgba(229, 239, 255, 0.08) 100%)',
}))

const contourShadowByVariant: Record<Variant, string> = {
  search: '0 20px 44px rgba(34, 50, 82, 0.16), 0 8px 18px rgba(34, 50, 82, 0.1), 0 1px 0 rgba(255, 255, 255, 0.74) inset, 0 0 0 1px rgba(255, 255, 255, 0.38) inset',
  capsule: '0 18px 40px rgba(34, 50, 82, 0.16), 0 6px 16px rgba(34, 50, 82, 0.1), 0 1px 0 rgba(255, 255, 255, 0.68) inset, 0 0 0 1px rgba(255, 255, 255, 0.34) inset',
  island: '0 24px 56px rgba(17, 25, 42, 0.16), 0 10px 28px rgba(17, 25, 42, 0.07), 0 1px 0 rgba(255, 255, 255, 0.82) inset, 0 -1px 0 rgba(11, 18, 32, 0.18) inset, 0 0 0 1px rgba(255, 255, 255, 0.46) inset, 0 0 0 1.5px rgba(255, 255, 255, 0.12)',
}

const contourStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  boxShadow: contourShadowByVariant[currentVariant.value],
  opacity: mergedActive.value ? 1 : 0.92,
}))

const edgeGradient = (opacityBase: number, opacityStrong: number) =>
  `linear-gradient(${135 + mouseOffset.value.x * 1.2}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${opacityBase + Math.abs(mouseOffset.value.x) * 0.008}) ${Math.max(10, 33 + mouseOffset.value.y * 0.3)}%, rgba(255,255,255,${opacityStrong + Math.abs(mouseOffset.value.x) * 0.012}) ${Math.min(90, 66 + mouseOffset.value.y * 0.4)}%, rgba(255,255,255,0) 100%)`

const edgeScreenStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  opacity: currentVariant.value === 'island' ? 0.42 : 0.3,
  mixBlendMode: 'screen',
  background: currentVariant.value === 'island'
    ? `${edgeGradient(0.22, 0.58)}, radial-gradient(120% 160% at 0% 50%, rgba(255,255,255,0.36), rgba(255,255,255,0) 44%), radial-gradient(120% 160% at 100% 50%, rgba(0,0,0,0.18), rgba(0,0,0,0) 46%)`
    : edgeGradient(0.2, 0.56),
}))

const edgeOverlayStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  opacity: currentVariant.value === 'search' ? 0.96 : 1,
  mixBlendMode: 'overlay',
  background: edgeGradient(0.4, 0.72),
}))

const rimLightStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  opacity: mergedActive.value ? 0.78 : 0.66,
  boxShadow: currentVariant.value === 'island'
    ? '0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 -1px 0 rgba(8, 14, 24, 0.28) inset, 0 0 0 1px rgba(255, 255, 255, 0.56), 0 0 24px rgba(255, 255, 255, 0.14) inset'
    : '0 1px 0 rgba(255, 255, 255, 0.78) inset, 0 -1px 0 rgba(255, 255, 255, 0.3) inset, 0 0 0 1px rgba(255, 255, 255, 0.44)',
  backgroundImage: currentVariant.value === 'island'
    ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.08) 30%, rgba(6, 14, 28, 0.18) 72%, rgba(255, 255, 255, 0.16) 100%)'
    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0) 38%, rgba(255, 255, 255, 0.2) 74%, rgba(255, 255, 255, 0.04) 100%)',
}))

const glossStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  opacity: mergedActive.value ? 0.84 : 0.62,
  mixBlendMode: currentVariant.value === 'island' ? 'screen' : 'overlay',
  backgroundImage: currentVariant.value === 'island'
    ? 'linear-gradient(90deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 9%, rgba(255,255,255,0) 24%, rgba(255,255,255,0) 76%, rgba(255,255,255,0.24) 92%, rgba(255,255,255,0.5) 100%), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.06) 46%, rgba(255,255,255,0) 76%)'
    : 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.06) 44%, rgba(255,255,255,0) 76%)',
}))

const hoverGlowStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  opacity: isHovered.value || isPressed.value ? 0.5 : 0,
  mixBlendMode: 'overlay',
  backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 50%)',
}))

const pressGlowStyle = computed<Partial<CSSProperties>>(() => ({
  ...commonLayerStyle.value,
  opacity: isPressed.value ? 0.46 : 0,
  mixBlendMode: 'overlay',
  backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 80%)',
}))

const updateGlassSize = () => {
  const host = hostRef.value
  if (!host) return
  const rect = host.getBoundingClientRect()
  glassSize.value = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }
  vendorContainer?.updateSizeFromDOM()
}

const getVendorType = () => currentVariant.value === 'island' ? 'rounded' : 'pill'

const getVendorRadius = () => {
  const host = hostRef.value
  if (!host) return 24
  const rect = host.getBoundingClientRect()
  if (currentVariant.value !== 'island') return Math.max(12, rect.height / 2)
  const radius = parseFloat(window.getComputedStyle(host).borderRadius || '')
  return Number.isFinite(radius) && radius > 0 ? radius : 24
}

const getVendorBlurRadius = () => Math.max(5, (props.overLight ? 14 : 4) + resolvedBlurAmount.value * 18)

const applyVendorShellStyle = () => {
  if (!vendorContainer) return
  const element = vendorContainer.element
  const canvas = vendorContainer.canvas
  if (!element || !canvas) return
  element.style.position = 'absolute'
  element.style.inset = '0'
  element.style.width = '100%'
  element.style.height = '100%'
  element.style.padding = '0'
  element.style.gap = '0'
  element.style.borderRadius = radiusValue.value
  element.style.boxShadow = 'none'
  element.style.background = 'transparent'
  element.style.overflow = 'hidden'
  element.style.pointerEvents = 'none'
  element.style.zIndex = '0'
  canvas.style.zIndex = '0'
  canvas.style.boxShadow = 'none'
  canvas.style.pointerEvents = 'none'
  canvas.style.borderRadius = radiusValue.value
}

const updateVendorUniforms = () => {
  if (!vendorContainer?.gl_refs?.gl) return
  const gl = vendorContainer.gl_refs.gl
  const refs = vendorContainer.gl_refs
  gl.useProgram(gl.getParameter(gl.CURRENT_PROGRAM))
  if (refs.blurRadiusLoc) gl.uniform1f(refs.blurRadiusLoc, getVendorBlurRadius())
  if (refs.tintOpacityLoc) gl.uniform1f(refs.tintOpacityLoc, currentVariant.value === 'island' ? 0.22 : 0.18)
  if (refs.borderRadiusLoc) gl.uniform1f(refs.borderRadiusLoc, getVendorRadius())
  vendorContainer.render?.()
}

const mountVendorGlass = () => {
  if (!rootRef.value || vendorContainer) return
  if (!window.WebGLRenderingContext) return
  try {
    vendorContainer = new Container({
      borderRadius: getVendorRadius(),
      type: getVendorType(),
      tintOpacity: currentVariant.value === 'island' ? 0.22 : 0.18,
    }) as unknown as VendorGlassContainer
    if (!vendorContainer.element) {
      vendorContainer.destroy?.()
      vendorContainer = null
      return
    }
    applyVendorShellStyle()
    rootRef.value.prepend(vendorContainer.element)
    void nextTick(() => {
      vendorContainer?.updateSizeFromDOM()
      updateVendorUniforms()
    })
  } catch {
    vendorContainer?.destroy?.()
    vendorContainer = null
  }
}

const handleMouseMove = (event: MouseEvent) => {
  const host = hostRef.value
  if (!host) return
  const rect = host.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  mouseOffset.value = {
    x: ((event.clientX - centerX) / rect.width) * 100,
    y: ((event.clientY - centerY) / rect.height) * 100,
  }
}

const handleMouseEnter = () => { isHovered.value = true }
const handleMouseLeave = () => {
  isHovered.value = false
  isPressed.value = false
  mouseOffset.value = { x: 0, y: 0 }
}
const handleMouseDown = () => { isPressed.value = true }
const handleMouseUp = () => { isPressed.value = false }

const bindHostEvents = () => {
  const host = hostRef.value
  if (!host) return
  host.addEventListener('mousemove', handleMouseMove)
  host.addEventListener('mouseenter', handleMouseEnter)
  host.addEventListener('mouseleave', handleMouseLeave)
  host.addEventListener('mousedown', handleMouseDown)
  host.addEventListener('mouseup', handleMouseUp)
}

const unbindHostEvents = () => {
  const host = hostRef.value
  if (!host) return
  host.removeEventListener('mousemove', handleMouseMove)
  host.removeEventListener('mouseenter', handleMouseEnter)
  host.removeEventListener('mouseleave', handleMouseLeave)
  host.removeEventListener('mousedown', handleMouseDown)
  host.removeEventListener('mouseup', handleMouseUp)
}

onMounted(() => {
  hostRef.value = rootRef.value?.parentElement as HTMLElement | null
  mountVendorGlass()
  updateGlassSize()
  bindHostEvents()
  if (hostRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateGlassSize)
    resizeObserver.observe(hostRef.value)
  } else {
    window.addEventListener('resize', updateGlassSize)
  }
})

onBeforeUnmount(() => {
  unbindHostEvents()
  resizeObserver?.disconnect()
  if (!resizeObserver) window.removeEventListener('resize', updateGlassSize)
  vendorContainer?.destroy?.()
  vendorContainer = null
})

watch([resolvedBlurAmount, resolvedSaturation, currentVariant, radiusValue], () => {
  if (!vendorContainer) return
  applyVendorShellStyle()
  updateVendorUniforms()
})
</script>

<style module lang="less">
.layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
}

.warp,
.surfaceTint,
.contour,
.edgeScreen,
.edgeOverlay,
.rimLight,
.gloss,
.hoverGlow,
.pressGlow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity .2s ease-out;
}

.surfaceTint {
  mix-blend-mode: normal;
}

.edgeScreen,
.edgeOverlay {
  padding: 1.5px;
  // Keep the edge treatment glued to the border. A blurred inner shadow makes
  // the surface look dirty on light backgrounds and reads as a gray slab.
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.46) inset;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

.contour {
  mix-blend-mode: normal;
}

.rimLight {
  mix-blend-mode: screen;
}

.variant_search .warp,
.variant_capsule .warp,
.variant_island .warp {
  background: transparent;
}

</style>
