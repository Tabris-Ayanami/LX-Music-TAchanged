<template lang="pug">
dt#play_detail(v-if="!embedded") {{ $t('setting__play_detail') }}
dd(v-else)
  h3#appearance_play_detail(:class="$style.embeddedTitle") {{ $t('setting__play_detail') }}
dd
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")

dd
  h3#play_detail_immersive_effect {{ $t('setting__play_detail_immersive_effect') }}
  p(:class="$style.immersiveEffectTip") {{ $t('setting__play_detail_immersive_effect_tip') }}
  div(:class="$style.immersiveAudioOption")
    base-checkbox(
      id="setting_play_detail_immersive_audio_visualization"
      :model-value="appSetting['playDetail.immersiveAudioVisualization']"
      :label="$t('setting__play_detail_immersive_audio_visualization')"
      @update:model-value="updateSetting({ 'playDetail.immersiveAudioVisualization': $event })"
    )
    small {{ $t('setting__play_detail_immersive_audio_visualization_tip') }}
  div(:class="$style.immersiveDelayControl")
    label(for="setting_play_detail_immersive_control_hide_delay") {{ $t('setting__play_detail_immersive_control_hide_delay', { value: appSetting['playDetail.immersiveControlHideDelay'] }) }}
    base-slider-bar(
      id="setting_play_detail_immersive_control_hide_delay"
      :value="appSetting['playDetail.immersiveControlHideDelay']"
      :min="1"
      :max="10"
      :step="1"
      @change="updateSetting({ 'playDetail.immersiveControlHideDelay': $event })"
    )
    small {{ $t('setting__play_detail_immersive_control_hide_delay_tip') }}
  div(:class="$style.immersiveEffectGrid")
    button(
      v-for="item in immersiveEffectOptions"
      :key="item.id"
      type="button"
      :class="[$style.immersiveEffectCard, { [$style.active]: appSetting['playDetail.immersiveEffect'] == item.id }]"
      :aria-pressed="appSetting['playDetail.immersiveEffect'] == item.id"
      @click="updateSetting({ 'playDetail.immersiveEffect': item.id })"
    )
      span(:class="[$style.immersivePreview, $style[`immersivePreview-${item.id}`]]" aria-hidden="true")
        i {{ item.id == 'classic' ? '流光' : item.name }}
      span(:class="$style.immersiveEffectBody")
        strong {{ item.name }}
        small {{ item.description }}

dd
  h3#play_detail_background {{ $t('setting__play_detail_background') }}
  p(:class="$style.settingTip") {{ $t('setting__play_detail_background_tip') }}
  div(:class="$style.optionGrid")
    button(
      v-for="item in backgroundOptions"
      :key="item.id"
      type="button"
      :class="[$style.optionCard, { [$style.active]: appSetting['playDetail.background'] == item.id }]"
      :aria-pressed="appSetting['playDetail.background'] == item.id"
      @click="updateSetting({ 'playDetail.background': item.id })"
    )
      span(:class="[$style.backgroundPreview, $style[`background-${item.id}`]]" aria-hidden="true")
      span(:class="$style.optionBody")
        strong {{ item.name }}
        small {{ item.description }}
  div(v-if="appSetting['playDetail.background'] == 'blur'" :class="$style.blurControl")
    label(:for="$style.backgroundBlur") {{ $t('setting__play_detail_background_blur_amount', { value: appSetting['playDetail.backgroundBlur'] }) }}
    base-slider-bar(:id="$style.backgroundBlur" :value="appSetting['playDetail.backgroundBlur']" :min="8" :max="64" :step="1" @change="updateSetting({ 'playDetail.backgroundBlur': $event })")

dd
  h3#play_detail_layout {{ $t('setting__play_detail_layout') }}
  p(:class="$style.settingTip") {{ $t('setting__play_detail_layout_tip') }}
  div(:class="$style.optionGrid")
    button(
      v-for="item in layoutOptions"
      :key="item.id"
      type="button"
      :class="[$style.optionCard, { [$style.active]: appSetting['playDetail.layoutStyle'] == item.id }]"
      :aria-pressed="appSetting['playDetail.layoutStyle'] == item.id"
      @click="updateSetting({ 'playDetail.layoutStyle': item.id })"
    )
      span(:class="[$style.layoutPreview, $style[`layout-${item.id}`]]" aria-hidden="true")
      span(:class="$style.optionBody")
        strong {{ item.name }}
        small {{ item.description }}

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

</template>

<script>
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getImmersiveEffectOptions } from '@renderer/components/layout/PlayDetail/immersiveEffects'

export default {
  name: 'SettingPlayDetail',
  props: {
    embedded: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const immersiveEffectOptions = getImmersiveEffectOptions(key => window.i18n.t(key))
    const backgroundOptions = [
      {
        id: 'aura',
        name: window.i18n.t('setting__play_detail_background_aura'),
        description: window.i18n.t('setting__play_detail_background_aura_desc'),
      },
      {
        id: 'blur',
        name: window.i18n.t('setting__play_detail_background_blur'),
        description: window.i18n.t('setting__play_detail_background_blur_desc'),
      },
    ]
    const layoutOptions = [
      {
        id: 'classic',
        name: window.i18n.t('setting__play_detail_layout_classic'),
        description: window.i18n.t('setting__play_detail_layout_classic_desc'),
      },
      {
        id: 'record',
        name: window.i18n.t('setting__play_detail_layout_record'),
        description: window.i18n.t('setting__play_detail_layout_record_desc'),
      },
      {
        id: 'pixel',
        name: window.i18n.t('setting__play_detail_layout_pixel'),
        description: window.i18n.t('setting__play_detail_layout_pixel_desc'),
      },
    ]

    return {
      appSetting,
      updateSetting,
      immersiveEffectOptions,
      backgroundOptions,
      layoutOptions,
    }
  },
}
</script>

<style lang="less" module>
.embeddedTitle {
  margin-top: 30px !important;
  padding-top: 22px;
  border-top: 1px solid var(--shell-control-border, var(--color-divider));
}

.immersiveEffectTip {
  margin: 5px 0 12px;
  color: var(--color-font-label);
  font-size: 12px;
}

.immersiveAudioOption {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0 0 14px;
  color: var(--color-font-label);

  small {
    font-size: 12px;
  }
}

.immersiveDelayControl {
  display: grid;
  grid-template-columns: minmax(180px, 280px) minmax(180px, 320px);
  align-items: center;
  gap: 8px 18px;
  width: min(100%, 640px);
  margin: 0 0 16px;

  label {
    color: var(--color-font);
    font-size: 13px;
  }

  small {
    grid-column: 1 / -1;
    color: var(--color-font-label);
    font-size: 11px;
  }
}

@media (max-width: 760px) {
  .immersiveDelayControl {
    grid-template-columns: 1fr;

    small {
      grid-column: auto;
    }
  }
}

.immersiveEffectGrid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  width: min(100%, 920px);
}

.immersiveEffectCard {
  min-width: 0;
  box-sizing: border-box;
  padding: 0 0 7px;
  border: 2px solid var(--color-divider);
  border-radius: 10px;
  overflow: hidden;
  color: var(--color-font);
  background: var(--color-content-background);
  text-align: left;
  cursor: pointer;
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &.active {
    border: 2px solid var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha-200);
  }

  strong {
    display: block;
    font-size: 13px;
    font-weight: 500;
  }
}

.immersiveEffectBody {
  display: block;
  min-width: 0;
  padding: 7px 8px 0;

  small {
    display: block;
    margin-top: 3px;
    color: var(--color-font-label);
    font-size: 10px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
}

.immersivePreview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  min-height: 0;
  overflow: hidden;
  color: rgba(248, 250, 255, .92);
  background:
    radial-gradient(circle at 50% 50%, rgba(120, 166, 255, .22), transparent 54%),
    linear-gradient(135deg, #2b3955, #101522);
  background-repeat: no-repeat;
  background-size: cover;

  i {
    position: relative;
    z-index: 1;
    color: rgba(255, 255, 255, .9);
    font-size: clamp(13px, 1.4vw, 20px);
    font-style: normal;
    font-weight: 750;
    text-shadow: 0 0 16px rgba(149, 196, 255, .72);
  }
}

.immersivePreview-classic {
  background:
    radial-gradient(circle at 50% 50%, rgba(132, 193, 255, .46), transparent 38%),
    linear-gradient(135deg, #2b3955, #101522);
}

.immersivePreview-cadenza {
  align-items: flex-end;
  justify-content: flex-start;
  padding: 0 9% 10%;
  background:
    linear-gradient(155deg, transparent 48%, rgba(148, 196, 255, .25) 49%, transparent 51%),
    linear-gradient(135deg, #3d284c, #101522);

  &::before,
  &::after {
    position: absolute;
    width: 42%;
    height: 1px;
    content: '';
    background: rgba(194, 221, 255, .54);
    transform: rotate(-12deg);
  }

  &::before { top: 28%; left: 12%; }
  &::after { top: 47%; left: 25%; }
}

.immersivePreview-partita {
  align-items: flex-start;
  justify-content: flex-start;
  padding: 11% 0 0 12%;
  background: linear-gradient(135deg, #233d3c, #101522);

  i {
    transform: translate(16%, 34%);
  }

  &::after {
    position: absolute;
    inset: 26% 10% auto 23%;
    height: 2px;
    content: '';
    background: rgba(152, 255, 219, .62);
    box-shadow: 0 10px rgba(152, 255, 219, .34), 0 20px rgba(152, 255, 219, .2);
  }
}

.immersivePreview-fume {
  background:
    radial-gradient(circle at 22% 24%, rgba(255, 194, 132, .36), transparent 24%),
    radial-gradient(circle at 78% 72%, rgba(168, 138, 255, .32), transparent 28%),
    linear-gradient(135deg, #3b2b2d, #151521);

  i {
    transform: rotate(-8deg) translate(-4%, 4%);
    filter: blur(.3px);
  }
}

.immersivePreview-cappella {
  align-items: flex-start;
  justify-content: flex-start;
  padding: 11% 8%;
  background: linear-gradient(135deg, #2c3d5a, #141523);

  &::before,
  &::after {
    position: absolute;
    width: 28%;
    height: 30%;
    border-radius: 50%;
    content: '';
    background: rgba(174, 207, 255, .5);
    box-shadow: 34px 21px rgba(255, 180, 202, .42), 67px 5px rgba(182, 255, 218, .38);
  }

  &::before { left: 10%; top: 18%; }
  &::after { right: 10%; bottom: 11%; opacity: .5; }
}

.immersivePreview-tilt {
  background: linear-gradient(120deg, #44344a, #111522);

  i {
    transform: rotate(-11deg) skewX(-9deg);
    letter-spacing: .1em;
  }

  &::after {
    position: absolute;
    inset: auto 13% 19%;
    height: 1px;
    content: '';
    background: rgba(255, 188, 236, .55);
    transform: rotate(-11deg);
  }
}

.immersivePreview-claddagh {
  background: radial-gradient(circle, #41516c 0 22%, #172031 23% 56%, #0e121d 57%);

  &::before,
  &::after {
    position: absolute;
    border: 1px solid rgba(184, 214, 255, .5);
    border-radius: 50%;
    content: '';
  }

  &::before { width: 52%; height: 78%; transform: rotate(28deg); }
  &::after { width: 72%; height: 36%; transform: rotate(-18deg); }
}

.immersivePreview-diorama {
  background:
    linear-gradient(120deg, rgba(120, 194, 255, .22), transparent 44%),
    linear-gradient(135deg, #24364b, #0c101a);
  perspective: 160px;

  i {
    transform: translateZ(26px) scale(1.08);
  }

  &::before {
    position: absolute;
    inset: 15% 15% 15% 23%;
    border: 1px solid rgba(184, 220, 255, .3);
    content: '';
    transform: rotateX(56deg) rotateZ(-10deg);
  }
}

.immersivePreview-monet {
  align-items: flex-end;
  justify-content: flex-end;
  padding: 8% 10%;
  background:
    radial-gradient(circle at 22% 38%, rgba(255, 174, 174, .46), transparent 24%),
    radial-gradient(circle at 72% 72%, rgba(152, 201, 255, .42), transparent 30%),
    linear-gradient(135deg, #584751, #192b3b);
  filter: saturate(.82);

  i {
    font-family: Georgia, serif;
    font-size: clamp(16px, 1.7vw, 24px);
  }
}

.immersivePreview-pendolo {
  background: radial-gradient(circle at 50% 22%, rgba(255, 216, 143, .34), transparent 31%), #181c29;

  &::before {
    position: absolute;
    top: -22%;
    left: 50%;
    width: 1px;
    height: 73%;
    content: '';
    background: rgba(255, 235, 186, .62);
    transform-origin: top;
    transform: rotate(12deg);
  }

  &::after {
    position: absolute;
    top: 44%;
    left: calc(50% - 8px);
    width: 16px;
    height: 16px;
    border: 1px solid rgba(255, 235, 186, .72);
    border-radius: 50%;
    content: '';
  }
}

.settingTip {
  margin: 5px 0 12px;
  color: var(--color-font-label);
  font-size: 12px;
}

.optionGrid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  width: min(100%, 920px);
}

.optionCard {
  min-width: 0;
  box-sizing: border-box;
  padding: 0 0 7px;
  border: 2px solid var(--color-divider);
  border-radius: 10px;
  overflow: hidden;
  color: var(--color-font);
  background: var(--color-content-background);
  text-align: left;
  cursor: pointer;
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &.active {
    border: 2px solid var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha-200);
  }
}

.backgroundPreview,
.layoutPreview {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  min-height: 0;
  overflow: hidden;
}

.optionBody {
  display: block;
  min-width: 0;
  padding: 7px 8px 0;

  strong,
  small {
    display: block;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  strong {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
  }

  small {
    display: -webkit-box;
    margin-top: 3px;
    overflow: hidden;
    color: var(--color-font-label);
    font-size: 10px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
}

.backgroundPreview {
  background:
    radial-gradient(circle at 20% 30%, rgba(255, 224, 181, .62), transparent 32%),
    radial-gradient(circle at 78% 74%, rgba(94, 151, 255, .55), transparent 36%),
    linear-gradient(130deg, #1e2636, #6d4e45);
}

.background-aura::after {
  position: absolute;
  inset: 20% 14%;
  content: '';
  border-radius: 50%;
  background: linear-gradient(110deg, transparent, rgba(255, 255, 255, .42), transparent);
  filter: blur(8px);
  transform: rotate(-18deg);
}

.background-blur {
  background:
    linear-gradient(rgba(20, 22, 30, .1), rgba(20, 22, 30, .28)),
    url('@renderer/assets/images/immersive-effects-preview.png') center / cover;
  filter: blur(1px) saturate(1.1);
}

.layoutPreview {
  background:
    linear-gradient(90deg, rgba(255, 255, 255, .07) 0 35%, rgba(255, 255, 255, .02) 35%),
    linear-gradient(135deg, #343b53, #151924);
}

.layoutPreview::before,
.layoutPreview::after {
  position: absolute;
  content: '';
}

.layout-classic::before {
  inset: 17px auto 17px 16px;
  width: 39px;
  border-radius: 5px;
  background: rgba(255, 255, 255, .62);
}

.layout-classic::after {
  inset: 23px 14px auto 67px;
  height: 4px;
  background: rgba(255, 255, 255, .66);
  box-shadow: 0 10px rgba(255, 255, 255, .24), 0 20px rgba(255, 255, 255, .14);
}

.layout-record::before {
  inset: 13px auto 13px 16px;
  width: 48px;
  border-radius: 50%;
  background: radial-gradient(circle, #d5b28b 0 12%, #141722 14% 72%, #8e7155 74% 100%);
}

.layout-record::after {
  inset: 25px 14px auto 80px;
  height: 4px;
  background: rgba(255, 255, 255, .62);
  box-shadow: 0 10px rgba(255, 255, 255, .22), 0 20px rgba(255, 255, 255, .14);
}

.layout-pixel::before {
  inset: 0 auto 0 0;
  width: 38%;
  background: linear-gradient(90deg, rgba(255, 255, 255, .56), rgba(255, 255, 255, .08));
}

.layout-pixel::after {
  inset: 24px 14px auto 50%;
  height: 4px;
  background: rgba(255, 255, 255, .68);
  box-shadow: 0 11px rgba(255, 255, 255, .24), 0 22px rgba(255, 255, 255, .14);
}

.blurControl {
  max-width: 520px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  color: var(--color-font-label);
  font-size: 12px;
}

.blurControl :global(.base-slider-bar) {
  flex: 1;
}

@media (max-width: 980px) {
  .immersiveEffectGrid,
  .optionGrid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .immersiveEffectGrid,
  .optionGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .immersiveEffectGrid,
  .optionGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .blurControl {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

}

@media (max-width: 360px) {
  .immersiveEffectGrid,
  .optionGrid {
    grid-template-columns: 1fr;
  }
}
</style>
