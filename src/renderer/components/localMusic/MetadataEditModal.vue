<template>
  <material-modal :show="show" teleport="#view" bg-close width="820px" max-width="94%" height="720px" max-height="92%" @close="close">
    <form :class="$style.form" @submit.prevent="save">
      <header :class="$style.hero">
        <div :class="$style.coverActions">
          <button type="button" :class="$style.cover" aria-label="更换封面" @click="selectCover">
            <img v-if="metadata.coverDataUrl" :src="metadata.coverDataUrl" alt="当前歌曲封面">
            <span v-else>选择封面</span>
          </button>
          <button v-if="metadata.coverDataUrl" type="button" :class="$style.textButton" @click="removeCover">移除封面</button>
        </div>
        <div :class="$style.heroMeta">
          <span :class="$style.eyebrow">编辑歌曲信息</span>
          <h2>{{ metadata.title || musicInfo.name || '未命名歌曲' }}</h2>
          <p>{{ artistsText || musicInfo.singer || '未知艺术家' }}</p>
          <small>{{ [metadata.album, metadata.year || ''].filter(Boolean).join(' · ') || '未填写专辑' }}</small>
        </div>
        <span :class="$style.status">歌词：{{ lyricStatus }}</span>
      </header>

      <nav :class="$style.tabs" aria-label="歌曲编辑类别">
        <button type="button" :class="{ [$style.activeTab]: activeTab == 'information' }" @click="activeTab = 'information'">信息</button>
        <button type="button" :class="{ [$style.activeTab]: activeTab == 'lyrics' }" @click="activeTab = 'lyrics'">歌词</button>
        <button type="button" :class="{ [$style.activeTab]: activeTab == 'file' }" @click="activeTab = 'file'">文件</button>
      </nav>

      <div v-if="loading" :class="$style.state" role="status">正在读取 Metadata…</div>
      <div v-else-if="error" :class="$style.state" role="alert">{{ error }}</div>
      <div v-else-if="activeTab == 'information'" :class="$style.contentScroll">
        <section :class="$style.card">
          <h3>主要信息</h3>
          <div :class="$style.fields">
            <label :class="$style.wide"><span>标题</span><input v-model="metadata.title" required></label>
            <label><span>艺术家</span><input v-model="artistsText" placeholder="多个艺术家以 ; 分隔"></label>
            <label><span>专辑</span><input v-model="metadata.album"></label>
            <label :class="$style.wide"><span>专辑艺术家</span><input v-model="albumArtistsText" placeholder="多个艺术家以 ; 分隔"></label>
          </div>
        </section>

        <section :class="$style.card">
          <h3>分类与排序</h3>
          <div :class="$style.fields">
            <label><span>流派</span><input v-model="genreText" placeholder="多个流派以 ; 分隔"></label>
            <label><span>作曲</span><input v-model="composerText" placeholder="多个作曲者以 ; 分隔"></label>
            <label><span>年份</span><input :value="metadata.year" type="number" min="0" max="9999" @input="updateNumber('year', $event)"></label>
            <label><span>音轨</span><input :value="metadata.trackNumber" type="number" min="0" @input="updateNumber('trackNumber', $event)"></label>
            <label><span>总音轨</span><input :value="metadata.totalTracks" type="number" min="0" @input="updateNumber('totalTracks', $event)"></label>
            <label><span>碟片</span><input :value="metadata.discNumber" type="number" min="0" @input="updateNumber('discNumber', $event)"></label>
            <label><span>总碟片</span><input :value="metadata.totalDiscs" type="number" min="0" @input="updateNumber('totalDiscs', $event)"></label>
          </div>
        </section>

        <section :class="$style.card">
          <h3>备注</h3>
          <label :class="$style.noteField"><span>Comment</span><textarea v-model="metadata.comment" rows="4" /></label>
        </section>
      </div>
      <LyricsMatchPanel
        v-else-if="activeTab == 'lyrics'"
        :active="show && activeTab == 'lyrics'"
        :music-info="musicInfo"
        @applied="$emit('lyrics-applied')"
      />
      <div v-else :class="$style.contentScroll">
        <section :class="$style.card">
          <h3>文件信息</h3>
          <dl :class="$style.fileGrid">
            <div><dt>格式</dt><dd>{{ metadata.format || musicInfo.meta.ext.toUpperCase() || '—' }}</dd></div>
            <div><dt>码率</dt><dd>{{ metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps` : '—' }}</dd></div>
            <div><dt>采样率</dt><dd>{{ metadata.sampleRate ? `${metadata.sampleRate} Hz` : '—' }}</dd></div>
            <div><dt>时长</dt><dd>{{ metadata.duration ? `${Math.round(metadata.duration)} s` : '—' }}</dd></div>
            <div :class="$style.filePath"><dt>文件路径</dt><dd>{{ metadata.filePath || musicInfo.meta.filePath }}</dd></div>
          </dl>
        </section>
      </div>

      <footer :class="$style.footer">
        <span v-if="saving" role="status">正在写入并验证文件，请勿关闭程序…</span>
        <span v-else />
        <button type="button" :disabled="saving" @click="close">{{ activeTab == 'information' ? '取消' : '关闭' }}</button>
        <base-btn v-if="activeTab == 'information'" :disabled="loading || !!error || saving" type="submit">{{ saving ? '保存中…' : '保存' }}</base-btn>
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
const activeTab = ref<'information' | 'lyrics' | 'file'>('information')

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
  activeTab.value = 'information'
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

.form { width: 820px; max-width: 100%; height: 100%; min-height: 420px; display: flex; flex-direction: column; color: var(--color-font); }
.hero { position: relative; display: grid; grid-template-columns: 116px minmax(0, 1fr) auto; align-items: center; gap: 20px; padding: 20px 26px 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 14%, var(--color-content-background)), var(--color-content-background)); border-bottom: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); }
.coverActions { display: flex; flex-direction: column; gap: 7px; }
.cover { width: 116px; aspect-ratio: 1; overflow: hidden; border: 1px solid color-mix(in srgb, var(--color-font) 14%, transparent); border-radius: 16px; color: var(--color-font-label); background: var(--color-content-background); box-shadow: 0 14px 34px rgba(18, 25, 39, .18); cursor: pointer; img { width: 100%; height: 100%; object-fit: cover; } }
.textButton { border: 0; border-radius: 7px; padding: 6px 9px; color: var(--color-font); background: var(--color-primary-background-hover); cursor: pointer; }
.heroMeta { min-width: 0; h2 { margin: 4px 0 7px; font-size: 26px; line-height: 1.12; .mixin-ellipsis-1(); } p { margin: 0 0 5px; color: var(--color-font); font-size: 14px; .mixin-ellipsis-1(); } small { color: var(--color-font-label); .mixin-ellipsis-1(); } }
.eyebrow { color: var(--color-primary); font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.status { align-self: start; padding: 5px 9px; border-radius: 999px; color: var(--color-primary); background: var(--color-primary-background-hover); font-size: 12px; white-space: nowrap; }
.tabs { padding: 0 26px; display: flex; gap: 24px; border-bottom: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); button { position: relative; padding: 11px 2px 10px; border: 0; color: var(--color-font-label); background: transparent; cursor: pointer; &.activeTab { color: var(--color-primary); } &.activeTab::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; border-radius: 2px; background: var(--color-primary); content: ''; } } }
.state { min-height: 280px; display: grid; place-items: center; padding: 24px; color: var(--color-font-label); }
.contentScroll { min-height: 0; padding: 18px 26px 24px; display: grid; gap: 14px; overflow: auto; }
.card { padding: 16px; border: 1px solid color-mix(in srgb, var(--color-font) 11%, transparent); border-radius: 13px; background: color-mix(in srgb, var(--color-content-background) 94%, var(--color-primary) 6%); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .24); h3 { margin: 0 0 13px; color: var(--color-font); font-size: 14px; } }
.fields { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
.fields label, .noteField { display: flex; flex-direction: column; gap: 5px; color: var(--color-font-label); font-size: 12px; }
.fields input, .noteField textarea { width: 100%; box-sizing: border-box; border: 1px solid color-mix(in srgb, var(--color-font) 16%, transparent); border-radius: 7px; padding: 8px 10px; outline: none; color: var(--color-font); background: var(--color-content-background); &:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 18%, transparent); } }
.wide { grid-column: 1 / -1; }
.fileGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; div { padding: 12px; border-radius: 9px; background: color-mix(in srgb, var(--color-font) 5%, transparent); } dt { margin-bottom: 5px; color: var(--color-font-label); font-size: 11px; } dd { margin: 0; color: var(--color-font); font-size: 13px; overflow-wrap: anywhere; } }
.filePath { grid-column: 1 / -1; }
.footer { margin-top: auto; min-height: 52px; padding: 10px 26px; display: flex; align-items: center; justify-content: flex-end; gap: 10px; border-top: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); font-size: 12px; button { min-width: 72px; } > span:first-child { margin-right: auto; color: var(--color-font-label); } }

@media (max-width: 620px) { .hero { grid-template-columns: 88px minmax(0, 1fr); } .cover { width: 88px; } .status { display: none; } .fields, .fileGrid { grid-template-columns: 1fr; } .wide, .filePath { grid-column: auto; } }
</style>
