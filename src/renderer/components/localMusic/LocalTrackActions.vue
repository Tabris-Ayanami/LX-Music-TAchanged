<template>
  <base-menu v-if="withMenu" v-model="menuVisible" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  <MetadataEditModal
    v-if="track"
    v-model:show="metadataVisible"
    :music-info="track"
    :lyric-status="lyricStatus"
    @saved="handleSaved"
    @lyrics-applied="handleLyricsApplied"
  />
  <LyricsMatchModal v-if="track" v-model:show="lyricsVisible" :music-info="track" @applied="handleLyricsApplied" />
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from '@common/utils/vueTools'
import { playSingleLocalTrack, setCachedLocalTracks, getCachedLocalTracks, LOCAL_MUSIC_LIST_ID } from '@renderer/utils/localMusic'
import { getLyricRaw } from '@renderer/utils/ipc'
import { updateListMusics } from '@renderer/store/list/action'
import { setMusicInfo } from '@renderer/store/player/action'
import { playMusicInfo } from '@renderer/store/player/state'
import MetadataEditModal from './MetadataEditModal.vue'
import LyricsMatchModal from './LyricsMatchModal.vue'

const props = withDefaults(defineProps<{ withMenu?: boolean, listId?: string }>(), { withMenu: false, listId: LOCAL_MUSIC_LIST_ID })
const emit = defineEmits<{ updated: [track: LX.Music.MusicInfoLocal] }>()
const track = ref<LX.Music.MusicInfoLocal | null>(null)
const menuVisible = ref(false)
const metadataVisible = ref(false)
const lyricsVisible = ref(false)
const hasLyrics = ref(false)
const menuLocation = reactive({ x: 0, y: 0 })
const lyricStatus = computed(() => hasLyrics.value ? '已匹配 / 已缓存' : '未匹配')
const menus = computed(() => [
  { name: '播放', action: 'play' },
  { name: '编辑歌曲信息', action: 'editMetadata' },
  { name: hasLyrics.value ? '重新匹配歌词' : '匹配歌词', action: 'matchLyrics' },
])

const refreshLyricStatus = async() => {
  if (!track.value) return
  const [cachedLyrics, fileLyrics] = await Promise.all([
    getLyricRaw(track.value).catch(() => null),
    window.lx.worker.main.getMusicFileLyric(track.value.meta.filePath).catch(() => null),
  ])
  hasLyrics.value = !!(fileLyrics?.lyric ?? cachedLyrics?.lyric)
}

const setTrack = (value: LX.Music.MusicInfoLocal) => {
  track.value = value
  void refreshLyricStatus()
}

const showMenu = (event: MouseEvent, value: LX.Music.MusicInfoLocal) => {
  event.preventDefault()
  event.stopPropagation()
  setTrack(value)
  menuLocation.x = event.pageX
  menuLocation.y = event.pageY
  menuVisible.value = false
  void nextTick(() => { menuVisible.value = true })
}

const openMetadata = (value?: LX.Music.MusicInfoLocal) => {
  if (value) setTrack(value)
  if (track.value) metadataVisible.value = true
}
const openLyrics = (_force = false, value?: LX.Music.MusicInfoLocal) => {
  if (value) setTrack(value)
  if (track.value) lyricsVisible.value = true
}
const handleMenuClick = (item: { action: string } | null) => {
  menuVisible.value = false
  if (!item || !track.value) return
  if (item.action == 'play') void playSingleLocalTrack(track.value)
  if (item.action == 'editMetadata') openMetadata()
  if (item.action == 'matchLyrics') openLyrics(true)
}

const handleSaved = async(metadata: LX.LocalMusic.Metadata) => {
  if (!track.value) return
  const updated: LX.Music.MusicInfoLocal = {
    ...track.value,
    name: metadata.title,
    singer: metadata.artists.join('、'),
    meta: { ...track.value.meta, albumName: metadata.album, picUrl: metadata.coverDataUrl || null },
  }
  track.value = updated
  await updateListMusics([{ id: props.listId, musicInfo: updated }])
  const cached = getCachedLocalTracks()
  if (cached.length) setCachedLocalTracks(cached.map(item => item.id == updated.id ? updated : item))
  if (playMusicInfo.musicInfo?.id == updated.id) setMusicInfo({ name: updated.name, singer: updated.singer, album: updated.meta.albumName, pic: updated.meta.picUrl ?? null })
  emit('updated', updated)
}

const handleLyricsApplied = () => {
  hasLyrics.value = true
}

defineExpose({ showMenu, openMetadata, openLyrics })
</script>
