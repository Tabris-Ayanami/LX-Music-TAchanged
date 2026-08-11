<template>
  <section :class="$style.panel">
    <header>
      <div>
        <h3>{{ mode == 'current' ? '内嵌歌词' : '在线匹配' }}</h3>
        <p>{{ mode == 'current' ? '歌词保存在音频 Metadata 中，同时保留播放器缓存。' : '并行搜索 QQ 音乐、网易云音乐、酷狗与 LRCLIB；高置信度结果会自动写入歌曲文件。' }}</p>
      </div>
      <div :class="$style.headerActions">
        <button type="button" @click="switchMode(mode == 'current' ? 'search' : 'current')">{{ mode == 'current' ? '在线匹配' : '查看 / 编辑歌词' }}</button>
        <base-btn v-if="mode == 'search'" :disabled="loading || applying" @click="load">重新搜索</base-btn>
      </div>
    </header>

    <div v-if="mode == 'current'" :class="$style.editor">
      <textarea v-model="currentLyric" aria-label="内嵌歌词" placeholder="尚无内嵌歌词。可在此粘贴 LRC / Enhanced LRC，或使用在线匹配。" />
      <small>支持普通文本、LRC 与 Enhanced LRC。在线匹配获得的逐字、翻译和罗马音会编码保存在同一歌词标签中。</small>
    </div>
    <div v-else-if="loading" :class="$style.state" role="status">正在搜索多个歌词源…</div>
    <div v-else-if="error" :class="$style.state" role="alert">
      <p>{{ error }}</p>
      <base-btn @click="load">重试</base-btn>
    </div>
    <div v-else :class="$style.list" class="scroll" role="listbox" aria-label="歌词候选">
      <button
        v-for="candidate in candidates"
        :key="candidate.id"
        type="button"
        :class="[$style.item, { [$style.selected]: selected?.id == candidate.id }]"
        @click="selected = candidate"
        @dblclick="apply"
      >
        <span :class="$style.score">{{ candidate.score }}<small>%</small></span>
        <span :class="$style.meta">
          <strong>{{ candidate.title }}</strong>
          <span>{{ candidate.artist || '未知艺术家' }}<template v-if="candidate.album"> · {{ candidate.album }}</template></span>
          <small>{{ candidate.sourceLabel }} · {{ formatDuration(candidate.duration) }} · {{ candidate.lyricType }}</small>
        </span>
      </button>
    </div>

    <footer>
      <span>{{ applying ? '正在写入音频 Metadata…' : mode == 'current' ? '修改后将安全写入音频文件并复读验证' : candidates.length ? `共 ${candidates.length} 个候选，已按匹配度排序` : '' }}</span>
      <base-btn v-if="mode == 'current'" :disabled="!currentLyric.trim() || applying" @click="saveCurrent">{{ applying ? '写入中…' : '保存内嵌歌词' }}</base-btn>
      <base-btn v-else :disabled="!selected || applying" @click="apply">{{ applying ? '写入中…' : '应用并内嵌' }}</base-btn>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from '@common/utils/vueTools'
import { dialog } from '@renderer/plugins/Dialog'
import { applyLocalLyrics, canAutoApply, fetchCandidateLyrics, searchLocalLyrics, type LyricsCandidate } from '@renderer/services/localLyrics'
import { getLyricRaw } from '@renderer/utils/ipc'
import { backend } from '@renderer/backend'

const props = withDefaults(defineProps<{ active: boolean, musicInfo: LX.Music.MusicInfoLocal, startMode?: 'current' | 'search' }>(), { startMode: 'current' })
const emit = defineEmits<{ applied: [] }>()
const loading = ref(false)
const applying = ref(false)
const error = ref('')
const candidates = ref<LyricsCandidate[]>([])
const selected = ref<LyricsCandidate | null>(null)
const currentLyric = ref('')
const mode = ref<'current' | 'search'>(props.startMode)
let searchId = 0

const formatDuration = (duration: number) => duration ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}` : '--:--'

const applyCandidate = async(candidate: LyricsCandidate) => {
  applying.value = true
  try {
    const lyrics = await fetchCandidateLyrics(candidate)
    await applyLocalLyrics(props.musicInfo, lyrics)
    currentLyric.value = lyrics.lyric
    emit('applied')
    void dialog(`歌词已写入歌曲文件并保存到缓存。\n来源：${candidate.sourceLabel}`)
  } catch (err) {
    void dialog(`歌词应用失败：${err instanceof Error ? err.message : String(err)}\n音乐播放不会受到影响。`)
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
  if (!currentLyric.value.trim()) return
  applying.value = true
  try {
    await applyLocalLyrics(props.musicInfo, { source: 'lrclib', lyric: currentLyric.value.trim() })
    emit('applied')
    void dialog('歌词已写入歌曲文件并保存到缓存。')
  } catch (err) {
    void dialog(`歌词写入失败：${err instanceof Error ? err.message : String(err)}\n原始音频未被替换。`)
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
  loading.value = true
  error.value = ''
  candidates.value = []
  selected.value = null
  try {
    const result = await searchLocalLyrics(props.musicInfo)
    if (currentId != searchId) return
    candidates.value = result
    selected.value = result[0] ?? null
    if (canAutoApply(result)) await applyCandidate(result[0])
  } catch (err) {
    if (currentId == searchId) error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (currentId == searchId) loading.value = false
  }
}

const apply = () => { if (selected.value && !applying.value) void applyCandidate(selected.value) }

watch(() => props.active, active => {
  if (active) {
    mode.value = props.startMode
    if (mode.value == 'search') void load()
    else void loadCurrent()
  } else searchId++
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.panel { min-height: 0; height: 100%; display: flex; flex-direction: column; color: var(--color-font); }
header { padding: 14px 22px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); h3 { font-size: 15px; } p { margin-top: 4px; color: var(--color-font-label); font-size: 12px; } }
.headerActions { flex: none; display: flex; gap: 8px; button { border: 0; border-radius: 5px; padding: 7px 10px; color: var(--color-font); background: var(--color-primary-background-hover); cursor: pointer; } }
.editor { flex: 1; min-height: 0; padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; textarea { flex: 1; min-height: 240px; resize: none; border: 1px solid color-mix(in srgb, var(--color-font) 16%, transparent); border-radius: 7px; padding: 12px; outline: none; color: var(--color-font); background: var(--color-content-background); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; line-height: 1.55; &:focus { border-color: var(--color-primary); } } small { color: var(--color-font-label); } }
.state { flex: 1; min-height: 220px; display: grid; place-items: center; align-content: center; gap: 14px; color: var(--color-font-label); }
.list { flex: 1; min-height: 220px; padding: 10px 14px; }
.item { width: 100%; min-height: 68px; margin-bottom: 6px; padding: 9px 12px; display: flex; align-items: center; gap: 14px; text-align: left; border: 1px solid transparent; border-radius: 7px; color: var(--color-font); background: transparent; cursor: pointer; transition: background-color .18s ease, border-color .18s ease; &:hover { background: var(--color-primary-background-hover); } &.selected { border-color: color-mix(in srgb, var(--color-primary) 56%, transparent); background: color-mix(in srgb, var(--color-primary) 12%, transparent); } }
.score { width: 46px; flex: none; color: var(--color-primary); font-size: 22px; font-variant-numeric: tabular-nums; small { font-size: 10px; } }
.meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; strong, span, small { .mixin-ellipsis-1(); } span { font-size: 12px; color: var(--color-font-label); } small { font-size: 11px; color: var(--color-font-label); opacity: .8; } }
footer { min-height: 48px; padding: 8px 20px; display: flex; align-items: center; gap: 10px; border-top: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent); > span { margin-right: auto; color: var(--color-font-label); font-size: 12px; } }
</style>
