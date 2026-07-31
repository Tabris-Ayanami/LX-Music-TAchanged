<template>
  <material-modal
    :show="show"
    bg-close="bg-close"
    teleport="#root"
    :close-btn="false"
    :hide-header="true"
    overlay-filter-mode="on"
    host-effect-mode="blur"
    :content-class="$style.frame"
    min-width="0"
    width="min(680px, calc(100vw - 48px))"
    max-width="calc(100vw - 48px)"
    max-height="calc(100vh - 48px)"
    @close="close"
  >
    <div :class="$style.panel">
      <header :class="$style.header">
        <div>
          <strong>{{ $t('setting__play_detail_immersive_source') }}</strong>
          <small>{{ $t('setting__play_detail_immersive_source_tip') }}</small>
        </div>
        <button type="button" :class="$style.close" :aria-label="$t('close')" @click="close">×</button>
      </header>

      <section :class="$style.section">
        <h3>{{ $t('setting__play_detail_immersive_mv_source') }}</h3>
        <div :class="$style.sourceGrid">
          <button
            v-for="item in mvSources"
            :key="item.id"
            type="button"
            :class="[$style.sourceCard, { [$style.active]: appSetting['playDetail.immersiveMvSource'] == item.id }]"
            :aria-pressed="appSetting['playDetail.immersiveMvSource'] == item.id"
            @click="selectMvSource(item.id)"
          >
            <strong>{{ item.name }}</strong>
            <small>{{ item.description }}</small>
          </button>
        </div>
        <h4>{{ $t('setting__play_detail_immersive_mv_candidates') }}</h4>
        <div :class="[$style.mvStatus, $style[`mvStatus-${mvStatus}`]]" role="status">
          <span v-if="mvStatus == 'loading'">{{ $t('setting__play_detail_immersive_mv_loading') }}</span>
          <span v-else-if="mvStatus == 'ready'">{{ $t('setting__play_detail_immersive_mv_ready') }}</span>
          <span v-else-if="mvStatus == 'error'">{{ mvError || $t('setting__play_detail_immersive_mv_failed') }}</span>
          <button v-if="mvStatus == 'error'" type="button" @click="$emit('retry-mv')">{{ $t('setting__play_detail_immersive_retry') }}</button>
        </div>
        <p v-if="loading" :class="$style.tip">{{ $t('setting__play_detail_immersive_searching') }}</p>
        <p v-else-if="!candidates.length" :class="$style.tip">{{ $t('setting__play_detail_immersive_no_candidates') }}</p>
        <div v-else :class="$style.candidates">
          <button v-for="candidate in candidates" :key="`${candidate.bvid}:${candidate.page}`" type="button" :class="[$style.candidate, { [$style.active]: activeMvKey == `${candidate.bvid}:${candidate.cid ?? candidate.page ?? 1}` }]" @click="selectCandidate(candidate)">
            <img :src="candidate.cover" alt="" loading="lazy">
            <span><strong>{{ candidate.title }}</strong><small>{{ candidate.author }} · {{ candidate.pageTitle }}</small></span>
          </button>
        </div>
      </section>

      <section :class="$style.section">
        <h3>{{ $t('setting__play_detail_immersive_lyric_source') }}</h3>
        <div :class="$style.sourceGrid">
          <button
            v-for="item in lyricSources"
            :key="item.id"
            type="button"
            :class="[$style.sourceCard, { [$style.active]: appSetting['playDetail.immersiveLyricSource'] == item.id }]"
            :aria-pressed="appSetting['playDetail.immersiveLyricSource'] == item.id"
            @click="selectLyricSource(item.id)"
          >
            <strong>{{ item.name }}</strong>
            <small>{{ item.description }}</small>
          </button>
        </div>
        <h4>{{ $t('setting__play_detail_immersive_lyric_candidates') }}</h4>
        <p v-if="lyricLoading" :class="$style.tip">{{ $t('setting__play_detail_immersive_searching') }}</p>
        <p v-else-if="!lyricCandidates.length" :class="$style.tip">{{ $t('setting__play_detail_immersive_no_candidates') }}</p>
        <div v-else :class="$style.lyricCandidates">
          <button v-for="(candidate, index) in lyricCandidates" :key="`${candidate.source}:${candidate.title}:${index}`" type="button" :class="$style.lyricCandidate" @click="selectLyricCandidate(candidate)">
            <strong>{{ candidate.title }}</strong>
            <small>{{ candidate.preview }}</small>
          </button>
        </div>
      </section>
    </div>
  </material-modal>
</template>

<script setup>
import { ref, watch } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { biliSearch, getBiliLyricSourceCandidates, getBiliPic } from '@renderer/utils/ipc'

const props = defineProps({
  show: Boolean,
  title: { type: String, default: '' },
  artist: { type: String, default: '' },
  duration: { type: Number, default: 0 },
  biliTrack: { type: Object, default: null },
  mvStatus: { type: String, default: 'idle' },
  mvError: { type: String, default: '' },
  activeMvKey: { type: String, default: '' },
})
const emit = defineEmits(['update:show', 'select-mv', 'select-lyric', 'retry-mv'])
const close = () => {
  emit('update:show', false)
}
const loading = ref(false)
const candidates = ref([])
const lyricLoading = ref(false)
const lyricCandidates = ref([])
let searchCacheKey = ''
let searchPromise = null
const candidatesResultKey = ref('')
const lyricResultKey = ref('')
const mvSources = [
  { id: 'auto', name: window.i18n.t('setting__play_detail_immersive_source_auto'), description: '优先当前来源，再自动匹配' },
  { id: 'current', name: window.i18n.t('setting__play_detail_immersive_source_current'), description: '仅使用当前歌曲的 MV' },
  { id: 'bili', name: window.i18n.t('setting__play_detail_immersive_source_bili'), description: '从 B 站搜索匹配候选' },
]
const lyricSources = [
  { id: 'auto', name: window.i18n.t('setting__play_detail_immersive_source_auto'), description: 'B 站优先，失败后在线匹配' },
  { id: 'current', name: window.i18n.t('setting__play_detail_immersive_source_current'), description: '保持播放器当前歌词' },
  { id: 'bili', name: window.i18n.t('setting__play_detail_immersive_source_bili'), description: '优先获取 B 站字幕' },
  { id: 'netease', name: window.i18n.t('setting__play_detail_immersive_source_netease'), description: '网易云歌词与逐字歌词' },
  { id: 'lrclib', name: window.i18n.t('setting__play_detail_immersive_source_lrclib'), description: 'LRCLIB 同步歌词' },
]
const getSearchKey = () => [props.title, props.artist].map(value => String(value ?? '').trim()).join('\u0000')
const getLyricKey = () => [
  getSearchKey(),
  Number(props.duration || 0),
  props.biliTrack?.bvid ?? '',
  props.biliTrack?.cid ?? props.biliTrack?.page ?? '',
].join('\u0000')
const getSearchResults = () => {
  const key = getSearchKey()
  if (!String(props.title ?? '').trim()) return Promise.resolve([])
  if (key != searchCacheKey || !searchPromise) {
    searchCacheKey = key
    const keyword = [props.title, props.artist].filter(Boolean).join(' ')
    searchPromise = biliSearch({ keyword, page: 1, limit: 8 })
      .then(result => result.list ?? [])
      .catch(error => {
        if (searchCacheKey == key) searchPromise = null
        throw error
      })
  }
  return searchPromise
}
const searchCandidates = async() => {
  if (!props.title) return
  const requestKey = getSearchKey()
  if (candidatesResultKey.value == requestKey) return
  loading.value = true
  try {
    const list = await getSearchResults()
    const nextCandidates = await Promise.all(list.map(async(candidate) => ({
      ...candidate,
      cover: await getBiliPic(candidate).catch(() => candidate.cover),
    })))
    if (requestKey != getSearchKey()) return
    candidates.value = nextCandidates
    candidatesResultKey.value = requestKey
  } catch {
    if (requestKey == getSearchKey()) candidates.value = []
  } finally {
    if (requestKey == getSearchKey()) loading.value = false
  }
}
const searchLyricCandidates = async() => {
  if (!props.title) return
  const requestKey = getLyricKey()
  if (lyricResultKey.value == requestKey) return
  lyricLoading.value = true
  try {
    const list = await getSearchResults()
    const biliCandidate = props.biliTrack ?? list[0] ?? null
    const nextCandidates = await getBiliLyricSourceCandidates({
      source: 'auto',
      bvid: biliCandidate?.bvid,
      cid: biliCandidate?.cid,
      page: biliCandidate?.page,
      title: props.title,
      artist: props.artist,
      duration: props.duration || null,
    })
    if (requestKey != getLyricKey()) return
    lyricCandidates.value = nextCandidates
    lyricResultKey.value = requestKey
  } catch {
    if (requestKey == getLyricKey()) lyricCandidates.value = []
  } finally {
    if (requestKey == getLyricKey()) lyricLoading.value = false
  }
}
const selectMvSource = id => {
  updateSetting({
    'playDetail.immersiveMvSource': id,
    'playDetail.immersiveBackground': 'mv',
  })
  void searchCandidates()
}
const selectLyricSource = id => {
  updateSetting({ 'playDetail.immersiveLyricSource': id })
  void searchLyricCandidates()
}
const selectCandidate = candidate => {
  updateSetting({
    'playDetail.immersiveMvSource': 'bili',
    'playDetail.immersiveBackground': 'mv',
  })
  emit('select-mv', candidate)
  close()
}
const selectLyricCandidate = candidate => {
  updateSetting({ 'playDetail.immersiveLyricSource': candidate.source })
  emit('select-lyric', candidate)
  close()
}
watch(() => [
  props.show,
  props.title,
  props.artist,
  props.duration,
  props.biliTrack?.bvid,
  props.biliTrack?.cid,
  props.biliTrack?.page,
], ([show]) => {
  if (!show) return
  const key = getSearchKey()
  if (candidatesResultKey.value != key) candidates.value = []
  if (lyricResultKey.value != getLyricKey()) lyricCandidates.value = []
  void searchCandidates()
  void searchLyricCandidates()
})
</script>

<style lang="less" module>
.frame { width: min(680px, calc(100vw - 48px)) !important; max-width: calc(100vw - 48px) !important; max-height: calc(100vh - 48px) !important; min-width: 0 !important; padding: 0 !important; background: transparent !important; box-shadow: none !important; }
.panel { box-sizing: border-box; width: 100%; max-height: calc(100vh - 48px); overflow: auto; padding: 22px; border: 1px solid rgba(255,255,255,.16); border-radius: 20px; color: #f5f7fb; background: rgba(17,22,33,.97); box-shadow: 0 24px 64px rgba(0,0,0,.46); }
.header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; strong, small { display: block; } strong { font-size: 18px; } small { margin-top: 5px; color: rgba(222,228,238,.68); font-size: 12px; line-height: 1.45; } }
.close { width: 34px; height: 34px; border: 0; border-radius: 50%; color: rgba(255,255,255,.78); background: rgba(255,255,255,.1); font-size: 24px; line-height: 1; cursor: pointer; }
.section { margin-top: 18px; &:first-of-type { margin-top: 0; } h3 { margin: 0 0 10px; font-size: 15px; } h4 { margin: 18px 0 9px; font-size: 13px; color: rgba(238,243,251,.88); } }
.sourceGrid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.sourceCard { min-width: 0; padding: 11px; border: 1px solid rgba(255,255,255,.14); border-radius: 12px; color: inherit; background: rgba(255,255,255,.045); text-align: left; cursor: pointer; &.active { border: 2px solid rgba(169,207,255,.9); box-shadow: 0 0 0 2px rgba(169,207,255,.16); background: rgba(169,207,255,.1); } strong, small { display: block; } strong { font-size: 13px; } small { margin-top: 4px; color: rgba(222,228,238,.64); font-size: 11px; line-height: 1.35; } }
.tip { color: rgba(222,228,238,.66); font-size: 12px; }
.mvStatus { display: flex; align-items: center; justify-content: space-between; min-height: 30px; margin-bottom: 8px; padding: 6px 9px; border-radius: 8px; color: rgba(222,228,238,.72); background: rgba(255,255,255,.04); font-size: 11px; &:empty { display: none; } button { border: 0; border-radius: 7px; color: #fff; background: rgba(169,207,255,.18); cursor: pointer; } }
.mvStatus-ready { color: rgba(168,239,201,.9); }
.mvStatus-error { color: rgba(255,183,183,.94); }
.candidates { display: grid; gap: 7px; }
.candidate { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 7px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: inherit; background: rgba(255,255,255,.04); text-align: left; cursor: pointer; &:hover { background: rgba(169,207,255,.1); } &.active { border: 2px solid rgba(169,207,255,.86); background: rgba(169,207,255,.1); box-shadow: 0 0 0 2px rgba(169,207,255,.14); } img { width: 64px; height: 38px; flex: none; border-radius: 5px; object-fit: cover; } span { min-width: 0; } strong, small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } strong { font-size: 12px; } small { margin-top: 3px; color: rgba(222,228,238,.64); font-size: 11px; } }
.lyricCandidates { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
.lyricCandidate { min-width: 0; padding: 10px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: inherit; background: rgba(255,255,255,.04); text-align: left; cursor: pointer; &:hover { border-color: rgba(169,207,255,.55); background: rgba(169,207,255,.1); } strong, small { display: block; } strong { font-size: 12px; } small { margin-top: 4px; overflow: hidden; color: rgba(222,228,238,.64); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; } }
@media (max-width: 560px) { .panel { padding: 16px; } .sourceGrid { grid-template-columns: 1fr; } }
</style>
