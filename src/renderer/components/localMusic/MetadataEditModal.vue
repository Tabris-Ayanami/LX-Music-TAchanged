<template>
  <material-modal :show="show" teleport="#view" bg-close width="720px" max-width="92%" height="680px" max-height="90%" @close="close">
    <form :class="$style.form" @submit.prevent="save">
      <div :class="$style.titleRow">
        <div>
          <h2>编辑歌曲信息</h2>
          <p>{{ metadata.format || musicInfo.meta.ext.toUpperCase() }} · {{ musicInfo.meta.filePath }}</p>
        </div>
        <span :class="$style.status">歌词：{{ lyricStatus }}</span>
      </div>

      <nav :class="$style.tabs" aria-label="歌曲编辑类别">
        <button type="button" :class="{ [$style.activeTab]: activeTab == 'metadata' }" @click="activeTab = 'metadata'">基本信息</button>
        <button type="button" :class="{ [$style.activeTab]: activeTab == 'lyrics' }" @click="activeTab = 'lyrics'">歌词</button>
      </nav>

      <div v-if="loading" :class="$style.state" role="status">正在读取 Metadata…</div>
      <div v-else-if="error" :class="$style.state" role="alert">{{ error }}</div>
      <template v-else-if="activeTab == 'metadata'">
        <div :class="$style.body">
          <section :class="$style.coverSection">
            <button type="button" :class="$style.cover" aria-label="更换封面" @click="selectCover">
              <img v-if="metadata.coverDataUrl" :src="metadata.coverDataUrl" alt="当前歌曲封面">
              <span v-else>选择封面</span>
            </button>
            <button v-if="metadata.coverDataUrl" type="button" :class="$style.textButton" @click="removeCover">移除封面</button>
          </section>

          <section :class="$style.fields">
            <label :class="$style.wide"><span>标题</span><input v-model="metadata.title" required></label>
            <label><span>艺术家</span><input v-model="artistsText" placeholder="多个艺术家以 ; 分隔"></label>
            <label><span>专辑</span><input v-model="metadata.album"></label>
            <label><span>专辑艺术家</span><input v-model="albumArtistsText" placeholder="多个艺术家以 ; 分隔"></label>
            <label><span>Genre</span><input v-model="genreText" placeholder="多个流派以 ; 分隔"></label>
            <label><span>作曲</span><input v-model="composerText" placeholder="多个作曲者以 ; 分隔"></label>
            <label><span>Track Number</span><input :value="metadata.trackNumber" type="number" min="0" @input="updateNumber('trackNumber', $event)"></label>
            <label><span>Total Tracks</span><input :value="metadata.totalTracks" type="number" min="0" @input="updateNumber('totalTracks', $event)"></label>
            <label><span>Disc Number</span><input :value="metadata.discNumber" type="number" min="0" @input="updateNumber('discNumber', $event)"></label>
            <label><span>Total Discs</span><input :value="metadata.totalDiscs" type="number" min="0" @input="updateNumber('totalDiscs', $event)"></label>
            <label><span>年份</span><input :value="metadata.year" type="number" min="0" max="9999" @input="updateNumber('year', $event)"></label>
            <label :class="$style.wide"><span>Comment</span><textarea v-model="metadata.comment" rows="3" /></label>
          </section>
        </div>
      </template>
      <LyricsMatchPanel
        v-else
        :active="show && activeTab == 'lyrics'"
        :music-info="musicInfo"
        @applied="$emit('lyrics-applied')"
      />

      <footer :class="$style.footer">
        <span v-if="saving" role="status">正在写入并验证文件，请勿关闭程序…</span>
        <span v-else />
        <button type="button" :disabled="saving" @click="close">{{ activeTab == 'metadata' ? '取消' : '关闭' }}</button>
        <base-btn v-if="activeTab == 'metadata'" :disabled="loading || !!error || saving" type="submit">{{ saving ? '保存中…' : '保存' }}</base-btn>
      </footer>
    </form>
  </material-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from '@common/utils/vueTools'
import { dialog } from '@renderer/plugins/Dialog'
import { backend } from '@renderer/backend'
import LyricsMatchPanel from './LyricsMatchPanel.vue'

const props = defineProps<{
  show: boolean
  musicInfo: LX.Music.MusicInfoLocal
  lyricStatus: string
}>()
const emit = defineEmits<{
  (event: 'update:show', value: boolean): void
  (event: 'saved', value: LX.LocalMusic.Metadata): void
  (event: 'lyrics-applied'): void
}>()

const metadata = ref<LX.LocalMusic.Metadata>({
  filePath: '',
  format: '',
  title: '',
  artists: [],
  album: '',
  albumArtists: [],
  trackNumber: 0,
  totalTracks: 0,
  discNumber: 0,
  totalDiscs: 0,
  year: 0,
  genre: [],
  comment: '',
  composer: [],
  coverDataUrl: '',
  duration: 0,
  bitrate: 0,
  sampleRate: 0,
})
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const coverChanged = ref(false)
const coverSourcePath = ref('')
const activeTab = ref<'metadata' | 'lyrics'>('metadata')

const splitText = (value: string) => value.split(/[;；]/).map(item => item.trim()).filter(Boolean)
const listModel = (field: 'artists' | 'albumArtists' | 'genre' | 'composer') => computed({
  get: () => metadata.value[field].join('; '),
  set: value => { metadata.value[field] = splitText(value) },
})
const artistsText = listModel('artists')
const albumArtistsText = listModel('albumArtists')
const genreText = listModel('genre')
const composerText = listModel('composer')

const updateNumber = (field: 'trackNumber' | 'totalTracks' | 'discNumber' | 'totalDiscs' | 'year', event: Event) => {
  metadata.value[field] = Math.max(0, Number((event.target as HTMLInputElement).value) || 0)
}

watch(() => props.show, async visible => {
  if (!visible) return
  loading.value = true
  activeTab.value = 'metadata'
  error.value = ''
  coverChanged.value = false
  coverSourcePath.value = ''
  try {
    metadata.value = await backend.metadata.read(props.musicInfo.meta.filePath)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
})

const close = () => { if (!saving.value) emit('update:show', false) }

const selectCover = async() => {
  const result = await backend.platform.select({
    title: '选择歌曲封面',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'] }],
  })
  if (result.canceled || !result.filePaths[0]) return
  try {
    const artwork = await backend.artwork.getExternalArtworkPreview({
      mediaFilePath: props.musicInfo.meta.filePath,
      artworkFilePath: result.filePaths[0],
      size: 512,
    })
    metadata.value.coverDataUrl = artwork.url
    coverSourcePath.value = result.filePaths[0]
    coverChanged.value = true
  } catch (err) {
    void dialog(err instanceof Error ? err.message : String(err))
  }
}

const removeCover = () => {
  metadata.value.coverDataUrl = ''
  coverSourcePath.value = ''
  coverChanged.value = true
}

const save = async() => {
  if (saving.value) return
  saving.value = true
  try {
    const result = await backend.metadata.write({
      filePath: props.musicInfo.meta.filePath,
      metadata: metadata.value,
      coverChanged: coverChanged.value,
      coverSourcePath: coverSourcePath.value || undefined,
    })
    emit('saved', result)
    emit('update:show', false)
    void dialog('歌曲信息已写入并重新读取验证。')
  } catch (err) {
    void dialog(`保存失败：${err instanceof Error ? err.message : String(err)}\n原始音频未被替换。`)
  } finally {
    saving.value = false
  }
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.form { width: 720px; max-width: 100%; height: 100%; min-height: 380px; display: flex; flex-direction: column; color: var(--color-font); }
.titleRow { padding: 8px 24px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); h2 { font-size: 20px; } p { max-width: 500px; margin-top: 4px; color: var(--color-font-label); font-size: 12px; .mixin-ellipsis-1(); } }
.tabs { padding: 0 24px; display: flex; gap: 20px; border-bottom: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); button { position: relative; padding: 10px 2px 9px; border: 0; color: var(--color-font-label); background: transparent; cursor: pointer; &.activeTab { color: var(--color-primary); } &.activeTab::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; border-radius: 2px; background: var(--color-primary); content: ''; } } }
.status { padding: 5px 9px; border-radius: 999px; color: var(--color-primary); background: var(--color-primary-background-hover); font-size: 12px; white-space: nowrap; }
.state { min-height: 280px; display: grid; place-items: center; padding: 24px; color: var(--color-font-label); }
.body { padding: 20px 24px; display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 24px; overflow: auto; }
.coverSection { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.cover { width: 132px; aspect-ratio: 1; overflow: hidden; border: 1px solid color-mix(in srgb, var(--color-font) 14%, transparent); border-radius: 10px; color: var(--color-font-label); background: var(--color-content-background); cursor: pointer; img { width: 100%; height: 100%; object-fit: cover; } }
.textButton { border: 0; border-radius: 5px; padding: 7px 10px; color: var(--color-font); background: var(--color-primary-background-hover); cursor: pointer; }
.fields { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--color-font-label); } input, textarea { width: 100%; box-sizing: border-box; border: 1px solid color-mix(in srgb, var(--color-font) 16%, transparent); border-radius: 5px; padding: 8px 10px; outline: none; color: var(--color-font); background: var(--color-content-background); &:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 18%, transparent); } } }
.wide { grid-column: 1 / -1; }
.footer { margin-top: auto; min-height: 52px; padding: 10px 24px; display: flex; align-items: center; justify-content: flex-end; gap: 10px; border-top: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); font-size: 12px; button { min-width: 72px; } > span:first-child { margin-right: auto; color: var(--color-font-label); } }
@media (max-width: 620px) { .body { grid-template-columns: 1fr; } .coverSection { align-items: center; } .fields { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
</style>
