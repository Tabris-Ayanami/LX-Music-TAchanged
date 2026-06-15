<template>
  <dt id="local_music_library">本地音乐库</dt>
  <dd>
    <div :class="$style.panel">
      <div :class="$style.stats">
        <div :class="$style.statItem">
          <span>歌曲总数</span>
          <strong>{{ tracks.length }}</strong>
        </div>
        <div :class="$style.statItem">
          <span>专辑数</span>
          <strong>{{ albumCount }}</strong>
        </div>
        <div :class="$style.statItem">
          <span>歌手数</span>
          <strong>{{ artistCount }}</strong>
        </div>
        <div :class="$style.statItem">
          <span>文件夹</span>
          <strong>{{ folders.length }}</strong>
        </div>
      </div>

      <div :class="$style.actions">
        <base-btn class="btn" min :disabled="isBusy" @click="handleAddFolders">添加文件夹</base-btn>
        <base-btn class="btn" min :disabled="isBusy || !folders.length" @click="handleRescan">重新扫描</base-btn>
      </div>

      <p v-if="statusText" class="p small" :class="$style.statusText">{{ statusText }}</p>
    </div>
  </dd>

  <dd>
    <h3 id="local_music_library_folders">添加的文件夹</h3>
    <div :class="$style.folderList">
      <div v-for="folder in folders" :key="folder" :class="$style.folderItem">
        <span :class="$style.folderPath" :title="folder">{{ folder }}</span>
        <base-btn class="btn" min :disabled="isBusy" @click="handleRemoveFolder(folder)">移除</base-btn>
      </div>
      <div v-if="!folders.length" :class="$style.emptyState">
        暂无文件夹。添加文件夹后可在这里统一重新扫描本地音乐库。
      </div>
    </div>
  </dd>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from '@common/utils/vueTools'
import { getListMusics } from '@renderer/store/list/action'
import { showSelectDialog } from '@renderer/utils/ipc'
import {
  addLocalMusicLibraryFolders,
  buildLocalAlbumGroups,
  buildLocalArtistGroups,
  ensureLocalMusicList,
  getLocalMusicLibraryFolders,
  removeLocalMusicLibraryFolder,
  removeLocalMusicLibraryFolderTracks,
  rescanLocalMusicLibrary,
  setCachedLocalTracks,
} from '@renderer/utils/localMusic'

const folders = ref<string[]>([])
const tracks = ref<LX.Music.MusicInfoLocal[]>([])
const isBusy = ref(false)
const statusText = ref('')
const localListId = ref('')

const albumCount = computed(() => buildLocalAlbumGroups(tracks.value).length)
const artistCount = computed(() => buildLocalArtistGroups(tracks.value).length)

const refreshFolders = () => {
  folders.value = getLocalMusicLibraryFolders()
}

const refreshTracks = async() => {
  const list = await ensureLocalMusicList()
  localListId.value = list.id
  tracks.value = (await getListMusics(list.id)).filter((track): track is LX.Music.MusicInfoLocal => track.source == 'local')
  setCachedLocalTracks(tracks.value)
}

const refreshAll = async() => {
  refreshFolders()
  await refreshTracks()
}

const handleListUpdate = (ids: string[]) => {
  if (!localListId.value || !ids.includes(localListId.value)) return
  void refreshTracks()
}

const handleRescan = async() => {
  isBusy.value = true
  statusText.value = '正在扫描本地音乐库...'
  try {
    const result = await rescanLocalMusicLibrary()
    await refreshAll()
    statusText.value = `扫描完成：${result.folderCount} 个文件夹，找到 ${result.scannedFileCount} 个媒体文件，当前共 ${result.totalCount} 首歌曲。`
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    statusText.value = `扫描失败：${message}`
  } finally {
    isBusy.value = false
  }
}

const handleAddFolders = async() => {
  const { canceled, filePaths } = await showSelectDialog({
    title: '选择本地音乐文件夹',
    properties: ['openDirectory', 'multiSelections'],
  })
  if (canceled || !filePaths.length) return

  folders.value = addLocalMusicLibraryFolders(filePaths)
  await handleRescan()
}

const handleRemoveFolder = async(folder: string) => {
  isBusy.value = true
  statusText.value = '正在移除文件夹歌曲...'
  folders.value = removeLocalMusicLibraryFolder(folder)
  try {
    await removeLocalMusicLibraryFolderTracks(folder)
    await handleRescan()
  } finally {
    isBusy.value = false
  }
}

onMounted(() => {
  void refreshAll()
  window.app_event.on('myListUpdate', handleListUpdate)
})

onBeforeUnmount(() => {
  window.app_event.off('myListUpdate', handleListUpdate)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.panel {
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.statItem {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(140, 170, 210, 0.18);
  border-radius: 8px;
  background: var(--color-button-background);

  span,
  strong {
    display: block;
    min-width: 0;
    .mixin-ellipsis-1();
  }

  span {
    font-size: 12px;
    color: var(--color-font-label);
  }

  strong {
    margin-top: 6px;
    font-size: 20px;
    line-height: 1.1;
    color: var(--color-font);
  }
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.statusText {
  color: var(--color-font-label);
}

.folderList {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
}

.folderItem {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--color-button-background);
}

.folderPath {
  min-width: 0;
  color: var(--color-font);
  .mixin-ellipsis-1();
}

.emptyState {
  padding: 14px 0;
  color: var(--color-font-label);
}

@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
