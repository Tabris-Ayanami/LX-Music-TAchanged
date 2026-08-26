<template>
  <section :class="$style.panel">
    <header :class="$style.header">
      <div>
        <h3>{{ mode == 'current' ? '内嵌歌词' : '在线匹配' }}</h3>
        <p>{{ mode == 'current' ? '这里显示音频 Metadata 中的歌词，也会读取播放器缓存作为补充。' : '选择任一来源查看完整歌词；只有点击覆写后才会写入歌曲文件。' }}</p>
      </div>
      <div :class="$style.headerActions">
        <button type="button" @click="switchMode(mode == 'current' ? 'search' : 'current')">
          {{ mode == 'current' ? '在线匹配' : '查看内嵌歌词' }}
        </button>
        <button v-if="mode == 'search'" type="button" :disabled="loading || applying" @click="load">重新搜索</button>
      </div>
    </header>

    <div v-if="mode == 'current'" :class="$style.editor">
      <textarea
        v-model="currentLyric"
        :readonly="readOnly"
        aria-label="内嵌歌词"
        placeholder="尚无内嵌歌词。可在此粘贴 LRC / Enhanced LRC，或使用在线匹配。"
      />
      <small>支持普通文本、LRC 与 Enhanced LRC。在线匹配获得的逐字、翻译和罗马音会一并写入歌词标签。</small>
    </div>
    <div v-else-if="loading" :class="$style.state" role="status">正在搜索 QQ 音乐、网易云音乐、酷狗与 LRCLIB…</div>
    <div v-else-if="error" :class="$style.state" role="alert">
      <p>{{ error }}</p>
      <base-btn type="button" @click="load">重试</base-btn>
    </div>
    <div v-else :class="$style.matchWorkspace">
      <div :class="[$style.list, 'scroll']" role="listbox" aria-label="歌词候选">
        <button
          v-for="candidate in candidates"
          :key="candidate.id"
          type="button"
          role="option"
          :aria-selected="selected?.id == candidate.id"
          :class="[$style.item, { [$style.selected]: selected?.id == candidate.id }]"
          @click="selectCandidate(candidate)"
        >
          <span :class="$style.score">{{ candidate.score }}<small>%</small></span>
          <span :class="$style.meta">
            <strong>{{ candidate.title }}</strong>
            <span>{{ candidate.artist || '未知艺术家' }}<template v-if="candidate.album"> · {{ candidate.album }}</template></span>
            <small>{{ candidate.sourceLabel }} · {{ formatDuration(candidate.duration) }} · {{ candidate.lyricType }}</small>
          </span>
        </button>
      </div>

      <section :class="$style.preview" aria-live="polite">
        <div v-if="selected" :class="$style.previewHeader">
          <div>
            <strong>{{ selected?.sourceLabel }}</strong>
            <span>{{ selected?.title }} · {{ selected?.artist || '未知艺术家' }}</span>
          </div>
          <span>{{ selected?.lyricType }}</span>
        </div>
        <div v-if="previewLoading" :class="$style.previewState" role="status">正在读取该来源歌词…</div>
        <div v-else-if="previewError" :class="$style.previewState" role="alert">
          <p>{{ previewError }}</p>
          <button type="button" @click="retryPreview">重新读取</button>
        </div>
        <textarea v-else-if="selectedLyrics" :value="previewText" readonly aria-label="在线歌词预览" />
        <div v-else :class="$style.previewState">选择左侧候选后可在这里查看歌词</div>
      </section>
    </div>

  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from '@common/utils/vueTools'
import { dialog } from '@renderer/plugins/Dialog'
import { applyLocalLyrics, fetchCandidateLyrics, searchLocalLyrics, type LyricsCandidate, type RichLyrics } from '@renderer/services/localLyrics'
import { getLyricRaw } from '@renderer/utils/ipc'
import { backend } from '@renderer/backend'

const props = withDefaults(defineProps<{
  active: boolean
  musicInfo: LX.Music.MusicInfoLocal
  startMode?: 'current' | 'search'
  readOnly?: boolean
}>(), {
  startMode: 'current',
  readOnly: false,
})
const emit = defineEmits<{ applied: [] }>()
const loading = ref(false)
const applying = ref(false)
const previewLoading = ref(false)
const error = ref('')
const previewError = ref('')
const candidates = ref<LyricsCandidate[]>([])
const selected = ref<LyricsCandidate | null>(null)
const selectedLyrics = ref<RichLyrics | null>(null)
const currentLyric = ref('')
const mode = ref<'current' | 'search'>(props.startMode)
let searchId = 0
let previewId = 0

const formatDuration = (duration: number) => duration ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}` : '--:--'

const previewText = computed(() => {
  const lyrics = selectedLyrics.value
  if (!lyrics) return ''
  const parts = [lyrics.lyric]
  if (lyrics.translatedLyric) parts.push(`【翻译】\n${lyrics.translatedLyric}`)
  if (lyrics.romanizedLyric) parts.push(`【罗马音】\n${lyrics.romanizedLyric}`)
  if (lyrics.wordByWordLyric && lyrics.wordByWordLyric != lyrics.lyric) parts.push(`【逐字歌词】\n${lyrics.wordByWordLyric}`)
  return parts.filter(Boolean).join('\n\n')
})

const selectCandidate = async(candidate: LyricsCandidate, force = false) => {
  if (!force && selected.value?.id == candidate.id && selectedLyrics.value) return
  const currentId = ++previewId
  selected.value = candidate
  selectedLyrics.value = null
  previewLoading.value = true
  previewError.value = ''
  try {
    const lyrics = await fetchCandidateLyrics(candidate)
    if (currentId != previewId) return
    selectedLyrics.value = lyrics
  } catch (err) {
    if (currentId == previewId) previewError.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (currentId == previewId) previewLoading.value = false
  }
}

const retryPreview = () => {
  if (selected.value) void selectCandidate(selected.value, true)
}

const applyCandidate = async(candidate: LyricsCandidate, lyrics: RichLyrics) => {
  if (props.readOnly) return
  applying.value = true
  try {
    await applyLocalLyrics(props.musicInfo, lyrics)
    currentLyric.value = lyrics.lyric
    emit('applied')
    void dialog(`歌词已覆写到歌曲文件并保存到缓存。\n来源：${candidate.sourceLabel}`)
  } catch (err) {
    void dialog(`歌词覆写失败：${err instanceof Error ? err.message : String(err)}\n音乐播放不会受到影响。`)
  } finally {
    applying.value = false
  }
}

const loadCurrent = async() => {
  const [embedded, cached] = await Promise.all([
    backend.metadata.readEmbeddedLyrics(props.musicInfo.meta.filePath).catch(() => ''),
    getLyricRaw(props.musicInfo).catch(() => null),
  ])
  const embeddedLyric = embedded.replace(/(?:^|\n\s*)\[awlrc:[^\]]+]\s*$/i, '').trim()
  if (embeddedLyric) currentLyric.value = embeddedLyric
  else currentLyric.value = cached?.lyric ?? ''
}

const saveCurrent = async() => {
  if (props.readOnly || !currentLyric.value.trim()) return
  applying.value = true
  try {
    await applyLocalLyrics(props.musicInfo, { source: 'lrclib', lyric: currentLyric.value.trim() })
    emit('applied')
    void dialog('歌词已覆写到歌曲文件并保存到缓存。')
  } catch (err) {
    void dialog(`歌词覆写失败：${err instanceof Error ? err.message : String(err)}\n原始音频未被替换。`)
  } finally {
    applying.value = false
  }
}

const switchMode = (value: 'current' | 'search') => {
  mode.value = value
  if (value == 'search' && !candidates.value.length) void load()
  if (value == 'current') void loadCurrent()
}

const load = async() => {
  const currentId = ++searchId
  previewId++
  loading.value = true
  error.value = ''
  candidates.value = []
  selected.value = null
  selectedLyrics.value = null
  previewError.value = ''
  try {
    const result = await searchLocalLyrics(props.musicInfo)
    if (currentId != searchId) return
    candidates.value = result
    const first = result[0]
    if (first) void selectCandidate(first)
  } catch (err) {
    if (currentId == searchId) error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (currentId == searchId) loading.value = false
  }
}

const apply = () => {
  if (props.readOnly || !selected.value || !selectedLyrics.value || applying.value) return
  void applyCandidate(selected.value, selectedLyrics.value)
}

const canOverwrite = computed(() => mode.value == 'current'
  ? !props.readOnly && !!currentLyric.value.trim() && !applying.value
  : !props.readOnly && !!selectedLyrics.value && !previewLoading.value && !applying.value)
const overwriteLabel = computed(() => applying.value ? '覆写中…' : mode.value == 'current' ? '覆写歌词' : '覆写内嵌歌词')
const overwrite = () => {
  if (!canOverwrite.value) return
  if (mode.value == 'current') void saveCurrent()
  else apply()
}

defineExpose({ canOverwrite, overwriteLabel, overwrite })

watch(() => props.active, active => {
  if (active) {
    mode.value = props.startMode
    if (mode.value == 'search') void load()
    else void loadCurrent()
  } else {
    searchId++
    previewId++
  }
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.panel { --metadata-surface: #fff; --metadata-surface-raised: #fbfcfe; --metadata-surface-subtle: #f1f5fa; --metadata-border: rgba(51, 66, 88, .14); min-height: 0; height: 100%; display: flex; flex-direction: column; color: var(--color-font); background: var(--metadata-surface); }
:global(.themeShellDark) .panel { --metadata-surface: #252a34; --metadata-surface-raised: #2b313d; --metadata-surface-subtle: #1d222c; --metadata-border: rgba(255, 255, 255, .12); }
.header { padding: 15px 18px 13px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--metadata-border); background: var(--metadata-surface-raised); h3 { margin: 0; font-size: 15px; } p { margin: 4px 0 0; color: var(--color-font-label); font-size: 12px; line-height: 1.45; } }
.headerActions { flex: none; display: flex; gap: 8px; button { border: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); border-radius: 8px; padding: 7px 10px; color: var(--color-font); background: color-mix(in srgb, var(--color-primary) 10%, transparent); cursor: pointer; transition: background-color @transition-fast; &:hover:not(:disabled) { background: color-mix(in srgb, var(--color-primary) 18%, transparent); } &:disabled { opacity: .45; cursor: default; } } }
.editor { flex: 1; min-height: 0; padding: 16px 18px 12px; display: flex; flex-direction: column; gap: 9px; background: var(--metadata-surface); textarea { flex: 1; min-height: 230px; resize: none; border: 1px solid var(--metadata-border); border-radius: 11px; padding: 14px; outline: none; color: var(--color-font); background: var(--metadata-surface-raised); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; line-height: 1.6; &:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 16%, transparent); } &:read-only { color: var(--color-font-label); } } small { color: var(--color-font-label); line-height: 1.4; } }
.state { flex: 1; min-height: 220px; display: grid; place-items: center; align-content: center; gap: 14px; padding: 20px; color: var(--color-font-label); text-align: center; }
.matchWorkspace { flex: 1; min-height: 0; padding: 12px; display: grid; grid-template-columns: minmax(220px, 34%) minmax(0, 1fr); gap: 12px; }
.list { min-height: 0; padding-right: 4px; overflow: hidden auto; }
.item { width: 100%; min-height: 68px; margin-bottom: 7px; padding: 9px 10px; display: flex; align-items: center; gap: 11px; text-align: left; border: 1px solid var(--metadata-border); border-radius: 10px; color: var(--color-font); background: var(--metadata-surface-raised); cursor: pointer; transition: background-color @transition-fast, border-color @transition-fast, transform @transition-fast; &:hover { transform: translateX(1px); background: color-mix(in srgb, var(--color-primary) 9%, var(--metadata-surface-raised)); } &.selected { border-color: color-mix(in srgb, var(--color-primary) 56%, var(--metadata-border)); background: color-mix(in srgb, var(--color-primary) 13%, var(--metadata-surface-raised)); } }
.score { width: 42px; flex: none; color: var(--color-primary); font-size: 20px; font-variant-numeric: tabular-nums; small { font-size: 9px; } }
.meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; strong, span, small { .mixin-ellipsis-1(); } strong { font-size: 13px; } span { font-size: 12px; color: var(--color-font-label); } small { font-size: 11px; color: var(--color-font-label); opacity: .8; } }
.preview { min-width: 0; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--metadata-border); border-radius: 12px; background: var(--metadata-surface-raised); overflow: hidden; > textarea { flex: 1; min-height: 0; resize: none; padding: 14px 16px; border: 0; outline: 0; color: var(--color-font); background: var(--metadata-surface-raised); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; line-height: 1.65; } }
.previewHeader { min-height: 50px; padding: 9px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--metadata-border); background: color-mix(in srgb, var(--color-primary) 7%, var(--metadata-surface-raised)); div { min-width: 0; display: flex; flex-direction: column; gap: 3px; } strong { font-size: 13px; } div span { color: var(--color-font-label); font-size: 11px; .mixin-ellipsis-1(); } > span { flex: none; padding: 3px 7px; border-radius: 999px; color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, var(--metadata-surface-raised)); font-size: 10px; } }
.previewState { flex: 1; display: grid; place-items: center; align-content: center; gap: 12px; padding: 18px; color: var(--color-font-label); font-size: 12px; text-align: center; button { border: 0; border-radius: 7px; padding: 7px 10px; color: var(--color-font); background: var(--color-primary-background-hover); cursor: pointer; } }

@media (max-width: 720px) { .header { align-items: stretch; flex-direction: column; } .headerActions { align-self: flex-end; } .matchWorkspace { grid-template-columns: 1fr; grid-template-rows: minmax(150px, 38%) minmax(180px, 1fr); } }
</style>
