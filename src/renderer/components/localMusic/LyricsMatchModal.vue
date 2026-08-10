<template>
  <material-modal :show="show" teleport="#view" bg-close width="760px" max-width="94%" height="620px" max-height="88%" @close="close">
    <section :class="$style.dialog">
      <div :class="$style.title">
        <div><h2>匹配歌词</h2><p>{{ musicInfo.name }} · {{ musicInfo.singer || '未知艺术家' }}</p></div>
        <button type="button" @click="close">关闭</button>
      </div>
      <LyricsMatchPanel :active="show" :music-info="musicInfo" start-mode="search" @applied="handleApplied" />
    </section>
  </material-modal>
</template>

<script setup lang="ts">
import LyricsMatchPanel from './LyricsMatchPanel.vue'

defineProps<{ show: boolean, musicInfo: LX.Music.MusicInfoLocal }>()
const emit = defineEmits<{ (event: 'update:show', value: boolean): void, (event: 'applied'): void }>()
const close = () => { emit('update:show', false) }
const handleApplied = () => { emit('applied') }
</script>

<style lang="less" module>
.dialog { width: 760px; max-width: 100%; height: 100%; display: flex; flex-direction: column; color: var(--color-font); }
.title { padding: 8px 22px 14px; display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); h2 { font-size: 20px; } p { margin-top: 4px; color: var(--color-font-label); font-size: 12px; } button { border: 0; color: var(--color-font-label); background: transparent; cursor: pointer; } }
</style>
