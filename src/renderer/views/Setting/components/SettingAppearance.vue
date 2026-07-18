<template lang="pug">
dt#appearance 外观设置
SettingBasic(:appearance-only="true")
dd
  h3#appearance_local_music_album_view 专辑页面视图
  div(:class="$style.viewOptions")
    label(
      v-for="item in albumViewStyles"
      :key="item.id"
      :class="[$style.viewOption, { [$style.active]: appSetting['localMusic.albumViewStyle'] == item.id }]"
    )
      base-checkbox(
        :id="`setting_local_music_album_view_${item.id}`"
        name="setting_local_music_album_view"
        need
        :model-value="appSetting['localMusic.albumViewStyle']"
        :value="item.id"
        :aria-label="item.label"
        @update:model-value="updateSetting({ 'localMusic.albumViewStyle': $event })"
      )
      span(:class="$style.optionBody")
        strong {{ item.label }}
        small {{ item.description }}
  h3#appearance_local_music_artist_view(:class="$style.sectionTitle") 歌手页面视图
  div(:class="$style.viewOptions")
    label(
      v-for="item in artistViewStyles"
      :key="item.id"
      :class="[$style.viewOption, { [$style.active]: appSetting['localMusic.artistViewStyle'] == item.id }]"
    )
      base-checkbox(
        :id="`setting_local_music_artist_view_${item.id}`"
        name="setting_local_music_artist_view"
        need
        :model-value="appSetting['localMusic.artistViewStyle']"
        :value="item.id"
        :aria-label="item.label"
        @update:model-value="updateSetting({ 'localMusic.artistViewStyle': $event })"
      )
      span(:class="$style.optionBody")
        strong {{ item.label }}
        small {{ item.description }}
</template>

<script setup lang="ts">
import SettingBasic from './SettingBasic.vue'
import { appSetting, updateSetting } from '@renderer/store/setting'

interface ViewStyleOption<T> {
  id: T
  label: string
  description: string
}

const albumViewStyles: Array<ViewStyleOption<LX.AppSetting['localMusic.albumViewStyle']>> = [
  {
    id: 'waterfall',
    label: '瀑布流视图',
    description: '以连续卡片墙浏览专辑，单击进入普通专辑详情。',
  },
  {
    id: 'carousel',
    label: '轮转视图',
    description: '横向轮转专辑封面，在上方展开歌曲列表。',
  },
  {
    id: 'planet',
    label: '行星视图',
    description: '以行星簇浏览专辑，并在沉浸式层级中展开歌曲。',
  },
]

const artistViewStyles: Array<ViewStyleOption<LX.AppSetting['localMusic.artistViewStyle']>> = [
  {
    id: 'waterfall',
    label: '瀑布流视图',
    description: '沿用当前卡片瀑布流，快速纵向浏览全部歌手。',
  },
  {
    id: 'carousel',
    label: '轮转视图',
    description: '横向轮转歌手封面，单击中心卡片进入歌手详情。',
  },
  {
    id: 'planet',
    label: '行星视图',
    description: '在可自由拖动的二维行星画布中浏览歌手。',
  },
]
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.viewOptions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.sectionTitle {
  margin-top: 24px;
}

.viewOption {
  min-height: 72px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--shell-control-border, rgba(127, 145, 170, .2));
  border-radius: 12px;
  background: var(--shell-control, var(--color-button-background));
  cursor: pointer;
  box-sizing: border-box;
  transition: transform .2s ease, border-color .2s ease, background-color .2s ease, box-shadow .2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-primary) 36%, var(--shell-control-border, rgba(127, 145, 170, .2)));
  }

  &.active {
    border-color: color-mix(in srgb, var(--color-primary) 66%, transparent);
    background: color-mix(in srgb, var(--color-primary) 10%, var(--shell-control, var(--color-button-background)));
    box-shadow: 0 10px 24px color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}

.optionBody {
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 5px;

  strong {
    color: var(--shell-text, var(--color-font));
    font-size: 14px;
  }

  small {
    color: var(--shell-muted, var(--color-font-label));
    font-size: 12px;
    line-height: 1.45;
  }
}

@media (max-width: 760px) {
  .viewOptions {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .viewOption {
    transition: none;
  }
}
</style>
