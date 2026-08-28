<template>
  <material-modal
    :show="show"
    :teleport="teleportTarget"
    bg-close
    :close-btn="false"
    :hide-header="true"
    overlay-filter-mode="on"
    host-effect-mode="blur"
    :content-class="$style.modalFrame"
    min-width="0"
    width="min(820px, calc(100vw - 64px))"
    max-width="calc(100vw - 64px)"
    height="min(650px, calc(100vh - 80px))"
    max-height="calc(100vh - 80px)"
    @close="close"
  >
    <form :class="$style.form" @submit.prevent="save">
      <header :class="$style.hero">
        <div :class="$style.coverActions">
          <button type="button" :class="$style.cover" :disabled="readOnly" :aria-label="readOnly ? readOnlyTip : '更换封面'" @click="selectCover">
            <img v-if="metadata.coverDataUrl" :src="metadata.coverDataUrl" alt="当前歌曲封面">
            <span v-else>{{ readOnly ? '暂无封面' : '选择封面' }}</span>
          </button>
          <button v-if="metadata.coverDataUrl && !readOnly" type="button" :class="$style.textButton" @click="removeCover">移除封面</button>
        </div>
        <div :class="$style.heroMeta">
          <span :class="$style.eyebrow">{{ readOnly ? '查看歌曲信息' : '编辑歌曲信息' }}</span>
          <h2>{{ metadata.title || musicInfo.name || '未命名歌曲' }}</h2>
          <p>{{ artistsText || musicInfo.singer || '未知艺术家' }}</p>
          <small>{{ [metadata.album, metadata.year || ''].filter(Boolean).join(' · ') || '未填写专辑' }}</small>
        </div>
        <div :class="$style.heroActions">
          <div :class="$style.heroButtons">
            <span v-if="activeTab == 'information'" :title="readOnly ? readOnlyTip : undefined">
              <origin-button type="submit" :disabled="readOnly || loading || !!error || saving">{{ saving ? '覆写中…' : '覆写' }}</origin-button>
            </span>
            <span v-else-if="activeTab == 'lyrics'" :title="readOnly ? readOnlyTip : undefined">
              <origin-button type="button" :disabled="readOnly || loading || !!error || !lyricsPanelRef?.canOverwrite" @click="lyricsPanelRef?.overwrite()">
                {{ lyricsPanelRef?.overwriteLabel || '覆写歌词' }}
              </origin-button>
            </span>
            <button type="button" :class="$style.closeButton" aria-label="关闭" @click="close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-close" /></svg>
            </button>
          </div>
          <span :class="$style.status">歌词：{{ lyricStatus }}</span>
        </div>
      </header>

      <div :class="$style.workspace">
        <nav :class="$style.tabs" aria-label="歌曲信息类别">
          <button type="button" :class="{ [$style.activeTab]: activeTab == 'information' }" @click="activeTab = 'information'"><span>信</span><span>息</span></button>
          <button type="button" :class="{ [$style.activeTab]: activeTab == 'lyrics' }" @click="activeTab = 'lyrics'"><span>歌</span><span>词</span></button>
          <button type="button" :class="{ [$style.activeTab]: activeTab == 'file' }" @click="activeTab = 'file'"><span>文</span><span>件</span></button>
        </nav>

        <main :class="$style.contentPanel">
          <div v-if="loading" :class="$style.state" role="status">正在读取 Metadata…</div>
          <div v-else-if="error" :class="$style.state" role="alert">{{ error }}</div>
          <div v-else-if="activeTab == 'information'" :class="$style.contentScroll">
            <section :class="$style.card">
              <h3>主要信息</h3>
              <div :class="$style.fields">
                <label :class="$style.wide"><span>标题</span><input v-model="metadata.title" :disabled="readOnly" required></label>
                <label><span>艺术家</span><input v-model="artistsText" :disabled="readOnly" placeholder="多个艺术家以 ; 分隔"></label>
                <label><span>专辑</span><input v-model="metadata.album" :disabled="readOnly"></label>
                <label :class="$style.wide"><span>专辑艺术家</span><input v-model="albumArtistsText" :disabled="readOnly" placeholder="多个艺术家以 ; 分隔"></label>
              </div>
            </section>

            <section :class="$style.card">
              <h3>分类与排序</h3>
              <div :class="$style.fields">
                <label><span>流派</span><input v-model="genreText" :disabled="readOnly" placeholder="多个流派以 ; 分隔"></label>
                <label><span>作曲</span><input v-model="composerText" :disabled="readOnly" placeholder="多个作曲者以 ; 分隔"></label>
                <label><span>年份</span><input :value="metadata.year" :disabled="readOnly" type="number" min="0" max="9999" @input="updateNumber('year', $event)"></label>
                <label><span>音轨</span><input :value="metadata.trackNumber" :disabled="readOnly" type="number" min="0" @input="updateNumber('trackNumber', $event)"></label>
                <label><span>总音轨</span><input :value="metadata.totalTracks" :disabled="readOnly" type="number" min="0" @input="updateNumber('totalTracks', $event)"></label>
                <label><span>碟片</span><input :value="metadata.discNumber" :disabled="readOnly" type="number" min="0" @input="updateNumber('discNumber', $event)"></label>
                <label><span>总碟片</span><input :value="metadata.totalDiscs" :disabled="readOnly" type="number" min="0" @input="updateNumber('totalDiscs', $event)"></label>
              </div>
            </section>

            <section :class="$style.card">
              <h3>备注</h3>
              <label :class="$style.noteField"><span>Comment</span><textarea v-model="metadata.comment" :disabled="readOnly" rows="4" /></label>
            </section>
          </div>
          <LyricsMatchPanel
            v-else-if="activeTab == 'lyrics'"
            ref="lyricsPanelRef"
            :active="show && activeTab == 'lyrics'"
            :music-info="musicInfo"
            :read-only="readOnly"
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

        </main>
      </div>
    </form>
  </material-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from '@common/utils/vueTools'
import { dialog } from '@renderer/plugins/Dialog'
import { backend } from '@renderer/backend'
import OriginButton from '@renderer/components/common/OriginButton.vue'
import LyricsMatchPanel from './LyricsMatchPanel.vue'

const props = defineProps<{
  show: boolean
  musicInfo: LX.Music.MusicInfoLocal
  lyricStatus: string
  teleportTarget?: string
  readOnly?: boolean
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
const readOnlyTip = '播放过程中无法覆写'
const lyricsPanelRef = ref<{
  canOverwrite: boolean
  overwriteLabel: string
  overwrite: () => void
} | null>(null)

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

const buildMetadataWriteRequest = (): LX.LocalMusic.MetadataWriteRequest => ({
  filePath: props.musicInfo.meta.filePath,
  metadata: {
    title: String(metadata.value.title),
    artists: Array.from(metadata.value.artists, String),
    album: String(metadata.value.album),
    albumArtists: Array.from(metadata.value.albumArtists, String),
    trackNumber: Number(metadata.value.trackNumber) || 0,
    totalTracks: Number(metadata.value.totalTracks) || 0,
    discNumber: Number(metadata.value.discNumber) || 0,
    totalDiscs: Number(metadata.value.totalDiscs) || 0,
    year: Number(metadata.value.year) || 0,
    genre: Array.from(metadata.value.genre, String),
    comment: String(metadata.value.comment),
    composer: Array.from(metadata.value.composer, String),
    coverDataUrl: String(metadata.value.coverDataUrl),
    duration: Number(metadata.value.duration) || 0,
  },
  coverChanged: Boolean(coverChanged.value),
  ...(coverSourcePath.value ? { coverSourcePath: String(coverSourcePath.value) } : {}),
})

const selectCover = async() => {
  if (props.readOnly) return
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
  if (props.readOnly) return
  metadata.value.coverDataUrl = ''
  coverSourcePath.value = ''
  coverChanged.value = true
}

const save = async() => {
  if (props.readOnly || saving.value) return
  saving.value = true
  try {
    const result = await backend.metadata.write(buildMetadataWriteRequest())
    emit('saved', result)
    emit('update:show', false)
    void dialog('歌曲信息已覆写并重新读取验证。')
  } catch (err) {
    void dialog(`覆写失败：${err instanceof Error ? err.message : String(err)}\n原始音频未被替换。`)
  } finally {
    saving.value = false
  }
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.modalFrame { width: min(820px, calc(100vw - 64px)) !important; max-width: calc(100vw - 64px) !important; height: min(650px, calc(100vh - 80px)) !important; max-height: calc(100vh - 80px) !important; min-width: 0 !important; border: 0 !important; border-radius: 22px !important; background: transparent !important; box-shadow: none !important; overflow: visible !important; }
.form { --metadata-surface: #fff; --metadata-surface-raised: #fbfcfe; --metadata-surface-subtle: #f1f5fa; --metadata-border: rgba(51, 66, 88, .14); width: 100%; max-width: 100%; height: 100%; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; border: 1px solid var(--metadata-border); border-radius: 22px; color: var(--color-font); background: var(--metadata-surface); box-shadow: 0 28px 72px rgba(8, 12, 20, .34), inset 0 1px 0 rgba(255, 255, 255, .72); overflow: hidden; isolation: isolate; }
:global(.themeShellDark) .form { --metadata-surface: #252a34; --metadata-surface-raised: #2b313d; --metadata-surface-subtle: #1d222c; --metadata-border: rgba(255, 255, 255, .12); }
.hero { position: relative; display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; align-items: center; gap: 20px; padding: 20px 22px; background: var(--metadata-surface-raised); border-bottom: 1px solid var(--metadata-border); }
.coverActions { display: flex; flex-direction: column; gap: 7px; }
.cover { width: 112px; aspect-ratio: 1; overflow: hidden; border: 1px solid color-mix(in srgb, var(--color-font) 14%, transparent); border-radius: 16px; color: var(--color-font-label); background: color-mix(in srgb, var(--color-content-background) 94%, var(--color-font) 6%); box-shadow: 0 14px 34px rgba(18, 25, 39, .18); cursor: pointer; img { width: 100%; height: 100%; object-fit: cover; } &:disabled { cursor: default; } }
.textButton { border: 0; border-radius: 7px; padding: 6px 9px; color: var(--color-font); background: var(--color-primary-background-hover); cursor: pointer; }
.heroMeta { min-width: 0; h2 { margin: 4px 0 7px; font-size: 26px; line-height: 1.12; .mixin-ellipsis-1(); } p { margin: 0 0 5px; color: var(--color-font); font-size: 14px; .mixin-ellipsis-1(); } small { color: var(--color-font-label); .mixin-ellipsis-1(); } }
.eyebrow { color: var(--color-primary); font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.heroActions { align-self: stretch; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 12px; }
.heroButtons { display: flex; align-items: center; gap: 8px; }
.status { padding: 5px 9px; border-radius: 999px; color: var(--color-primary); background: var(--color-primary-background-hover); font-size: 12px; white-space: nowrap; }
.closeButton { width: 30px; height: 30px; padding: 7px; display: grid; place-items: center; border: 0; border-radius: 50%; color: var(--color-font-label); background: color-mix(in srgb, var(--color-font) 8%, transparent); cursor: pointer; transition: transform @transition-fast, color @transition-fast, background-color @transition-fast; svg { width: 100%; height: 100%; fill: currentColor; } &:hover { transform: translateY(-1px); color: var(--color-font); background: color-mix(in srgb, var(--color-font) 14%, transparent); } }
.workspace { flex: 1; min-height: 0; padding: 14px 14px 14px 10px; display: flex; background: var(--metadata-surface-subtle); }
.tabs { width: 46px; flex: none; padding-top: 10px; display: flex; flex-direction: column; gap: 8px; position: relative; z-index: 2; button { position: relative; z-index: 1; width: 100%; padding: 12px 0; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 1px solid transparent; border-right: 0; border-radius: 10px 0 0 10px; color: var(--color-font-label); background: transparent; cursor: pointer; transition: color @transition-fast, border-color @transition-fast, background-color @transition-fast; &:hover { color: var(--color-font); background: var(--metadata-surface); } &.activeTab { z-index: 3; margin-right: -1px; color: var(--color-primary); border-color: var(--metadata-border); background: var(--metadata-surface); box-shadow: -5px 8px 18px rgba(8, 12, 20, .09); } &.activeTab::after { position: absolute; top: 0; right: -2px; bottom: 0; width: 3px; background: var(--metadata-surface); content: ''; } } }
.contentPanel { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--metadata-border); border-radius: 14px; background: var(--metadata-surface); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .72); overflow: hidden; }
.state { min-height: 280px; display: grid; place-items: center; padding: 24px; color: var(--color-font-label); }
.contentScroll { flex: 1; min-height: 0; padding: 18px 20px 22px; display: grid; gap: 14px; overflow: auto; }
.card { padding: 16px; border: 1px solid var(--metadata-border); border-radius: 13px; background: var(--metadata-surface-raised); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .72); h3 { margin: 0 0 13px; color: var(--color-font); font-size: 14px; } }
.fields { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
.fields label, .noteField { display: flex; flex-direction: column; gap: 5px; color: var(--color-font-label); font-size: 12px; }
.fields input, .noteField textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--metadata-border); border-radius: 8px; padding: 8px 10px; outline: none; color: var(--color-font); background: var(--metadata-surface); &:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 18%, transparent); } &:disabled { color: var(--color-font-label); background: var(--metadata-surface-subtle); cursor: default; } }
.wide { grid-column: 1 / -1; }
.fileGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; div { padding: 12px; border-radius: 9px; background: var(--metadata-surface-subtle); } dt { margin-bottom: 5px; color: var(--color-font-label); font-size: 11px; } dd { margin: 0; color: var(--color-font); font-size: 13px; overflow-wrap: anywhere; } }
.filePath { grid-column: 1 / -1; }
@media (max-width: 620px) { .modalFrame { width: calc(100vw - 32px) !important; max-width: calc(100vw - 32px) !important; height: calc(100vh - 32px) !important; max-height: calc(100vh - 32px) !important; } .hero { grid-template-columns: 82px minmax(0, 1fr) auto; padding: 16px; gap: 14px; } .cover { width: 82px; } .status { display: none; } .workspace { padding: 10px 10px 10px 6px; } .tabs { width: 40px; } .fields, .fileGrid { grid-template-columns: 1fr; } .wide, .filePath { grid-column: auto; } }
</style>
