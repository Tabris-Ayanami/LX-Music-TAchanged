<template>
  <base-menu v-if="withMenu" v-model="menuVisible" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  <common-list-add-modal
    v-if="track"
    v-model:show="addVisible"
    :music-info="track"
    :from-list-id="listId"
    teleport="#view"
  />
  <MetadataEditModal
    v-if="track"
    v-model:show="metadataVisible"
    :music-info="track"
    :lyric-status="lyricStatus"
    :teleport-target="teleportTarget"
    :read-only="metadataReadOnly"
    @saved="handleSaved"
    @lyrics-applied="handleLyricsApplied"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from '@common/utils/vueTools'
import { clipboardWriteText } from '@common/utils/electron'
import { playSingleLocalTrack, setCachedLocalTracks, getCachedLocalTracks, LOCAL_MUSIC_LIST_ID } from '@renderer/utils/localMusic'
import { getLyricRaw } from '@renderer/utils/ipc'
import { updateListMusics } from '@renderer/store/list/action'
import { addTempPlayList, setMusicInfo } from '@renderer/store/player/action'
import { playMusicInfo } from '@renderer/store/player/state'
import { backend } from '@renderer/backend'
import MetadataEditModal from './MetadataEditModal.vue'
import { buildLocalTrackMenuItems, type LocalTrackMenuItem } from './localTrackMenu'

const props = withDefaults(defineProps<{ withMenu?: boolean, listId?: string, canRemoveFromList?: boolean, teleportTarget?: string }>(), {
  withMenu: false,
  listId: LOCAL_MUSIC_LIST_ID,
  canRemoveFromList: false,
  teleportTarget: '#view',
})
const emit = defineEmits<{
  updated: [track: LX.Music.MusicInfoLocal]
  remove: [track: LX.Music.MusicInfoLocal]
}>()
const track = ref<LX.Music.MusicInfoLocal | null>(null)
const menuVisible = ref(false)
const metadataVisible = ref(false)
const metadataReadOnly = ref(false)
const addVisible = ref(false)
const hasLyrics = ref(false)
const menuLocation = reactive({ x: 0, y: 0 })
const lyricStatus = computed(() => hasLyrics.value ? '已匹配 / 已缓存' : '未匹配')
const menus = computed(() => buildLocalTrackMenuItems({ canRemoveFromList: props.canRemoveFromList }))

const refreshLyricStatus = async() => {
  if (!track.value) return
  const [cachedLyrics, fileLyrics] = await Promise.all([
    getLyricRaw(track.value).catch(() => null),
    backend.metadata.readLyrics(track.value.meta.filePath),
  ])
  hasLyrics.value = !!(fileLyrics?.lyric ?? cachedLyrics?.lyric)
}

const setTrack = (value: LX.Music.MusicInfoLocal) => {
  track.value = value
  hasLyrics.value = false
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

const openMetadata = (value?: LX.Music.MusicInfoLocal, readOnly = false) => {
  if (value) setTrack(value)
  if (track.value) {
    metadataReadOnly.value = readOnly
    metadataVisible.value = true
  }
}
const handleMenuClick = (item: LocalTrackMenuItem | null) => {
  menuVisible.value = false
  if (!item || !track.value) return
  switch (item.action) {
    case 'play':
      void playSingleLocalTrack(track.value)
      break
    case 'playLater':
      addTempPlayList([{ listId: props.listId, musicInfo: track.value }])
      break
    case 'addTo':
      addVisible.value = true
      break
    case 'editMetadata':
      openMetadata()
      break
    case 'revealFile':
      backend.platform.revealInFileManager(track.value.meta.filePath)
      break
    case 'copyName':
      clipboardWriteText(`${track.value.name} - ${track.value.singer}`)
      break
    case 'remove':
      emit('remove', track.value)
      break
  }
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

defineExpose({ showMenu, openMetadata })
</script>
