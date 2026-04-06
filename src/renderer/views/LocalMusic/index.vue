<template>
  <div ref="pageRef" :class="$style.page">
    <section :class="$style.headerRow">
      <h1 :class="$style.pageTitle">本地音乐</h1>
      <div :class="$style.headerActions">
        <button type="button" :class="[$style.actionBtn, $style.primary]" :disabled="!tracks.length" @click="playAllTracks">
          播放全部
        </button>
        <button type="button" :class="[$style.actionBtn, $style.primary]" @click="handleImport">
          导入文件
        </button>
        <button type="button" :class="$style.actionBtn" @click="handleImportFolder">
          导入文件夹
        </button>
        <button type="button" :class="$style.actionBtn" @click="scrollToTop">
          回到顶部
        </button>
      </div>
    </section>

    <section :class="$style.contentCard">
      <div :class="$style.searchRow">
        <label :class="$style.searchBox">
          <span :class="$style.searchIcon">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 425.2 425.2" width="16" height="16" space="preserve">
              <use xlink:href="#icon-search-2" />
            </svg>
          </span>
          <input
            v-model="keyword"
            type="text"
            :placeholder="searchPlaceholder"
          >
          <button v-if="keyword" type="button" :class="$style.clearBtn" aria-label="清除搜索" @click="keyword = ''">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" width="14" height="14" space="preserve">
              <use xlink:href="#icon-window-close" />
            </svg>
          </button>
        </label>
      </div>

      <div v-show="normalizedView == 'tracks'" :class="$style.listShell">
        <template v-if="hasKeyword">
          <div v-if="filteredTrackItems.length" :class="$style.tableHead">
            <span :class="[$style.cell, $style.numCell]">#</span>
            <span :class="[$style.cell, $style.nameCell]">歌曲名</span>
            <span :class="[$style.cell, $style.singerCell]">艺术家</span>
            <span :class="[$style.cell, $style.albumCell]">专辑名</span>
            <span :class="[$style.cell, $style.timeCell]">时长</span>
          </div>
          <div v-if="filteredTrackItems.length" :class="$style.tableBody">
            <button
              v-for="(item, rowIndex) in filteredTrackItems"
              :key="item.track.id"
              type="button"
              :class="$style.row"
              @click="playTrack(item.track)"
            >
              <span :class="[$style.cell, $style.numCell]">{{ Number(rowIndex) + 1 }}</span>
              <span :class="[$style.cell, $style.nameCell]" :title="item.track.name">{{ item.track.name }}</span>
              <span :class="[$style.cell, $style.singerCell]" :title="item.track.singer">{{ item.track.singer || '--' }}</span>
              <span :class="[$style.cell, $style.albumCell]" :title="item.track.meta.albumName">{{ item.track.meta.albumName || '--' }}</span>
              <span :class="[$style.cell, $style.timeCell]">{{ item.track.interval || '--/--' }}</span>
            </button>
          </div>
          <div v-else :class="$style.emptyState">没有匹配到本地歌曲。</div>
        </template>
        <template v-else>
          <MusicList v-if="localListId" ref="musicList" :list-id="localListId" play-mode="single-temp" play-on-click :temp-list-id-prefix="LOCAL_MUSIC_LIST_ID" />
          <div v-else :class="$style.emptyState">正在准备本地曲库...</div>
        </template>
      </div>

      <div v-show="normalizedView == 'albums'" ref="albumGridRef" :class="$style.gridShell" @scroll.passive="handleAlbumScroll">
        <button
          v-for="album in visibleAlbums"
          :key="album.key"
          type="button"
          :class="$style.albumCard"
          :title="album.name"
          @click="openDetail('albums', album.key)"
        >
          <div :class="$style.coverFrame">
            <img v-if="albumCovers[album.key]" :src="albumCovers[album.key]" :alt="album.name" decoding="async" loading="lazy">
            <div v-else :class="$style.coverFallback">{{ album.initial }}</div>
          </div>
          <div :class="$style.albumMeta">
            <strong :class="$style.cardTitle">{{ album.name }}</strong>
            <span :class="$style.cardMeta">{{ album.singer }} · {{ album.count }} 首</span>
          </div>
        </button>
        <div v-if="!albums.length" :class="$style.emptyState">
          {{ hasKeyword ? '没有匹配到本地专辑。' : '导入歌曲后会在这里生成专辑墙。' }}
        </div>
      </div>

      <div v-show="normalizedView == 'artists'" ref="artistGridRef" :class="$style.artistShell" @scroll.passive="handleArtistScroll">
        <button
          v-for="artist in visibleArtists"
          :key="artist.key"
          type="button"
          :class="$style.artistCard"
          :title="artist.name"
          @click="openDetail('artists', artist.key)"
        >
          <div :class="$style.artistCover">
            <img v-if="artistCovers[artist.key]" :src="artistCovers[artist.key]" :alt="artist.name" decoding="async" loading="lazy">
            <span v-else :class="$style.artistInitial">{{ artist.initial }}</span>
          </div>
          <div :class="$style.artistMeta">
            <strong :class="$style.cardTitle">{{ artist.name }}</strong>
            <span :class="$style.cardMeta">{{ artist.subtitle }} · {{ artist.count }} 首</span>
          </div>
        </button>
        <div v-if="!artists.length" :class="$style.emptyState">
          {{ hasKeyword ? '没有匹配到本地音乐家。' : '导入歌曲后会在这里汇总音乐家。' }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { getPicPath } from '@renderer/core/music'
import { getListMusics } from '@renderer/store/list/action'
import {
  LOCAL_MUSIC_LIST_ID,
  buildLocalAlbumGroups,
  buildLocalArtistGroups,
  ensureLocalMusicList,
  getCachedLocalGroupCover,
  getCachedLocalTracks,
  playLocalTempTracks,
  playSingleLocalTrack,
  setCachedLocalGroupCover,
  setCachedLocalTracks,
} from '@renderer/utils/localMusic'
import { addLocalFile, addLocalFolder } from '@renderer/views/List/MyList/actions'
import MusicList from '@renderer/views/List/MusicList/index.vue'

interface LocalTrackItem {
  index: number
  track: LX.Music.MusicInfoLocal
}

const GRID_BATCH_SIZE = 20
const GRID_LOAD_OFFSET = 120

const route = useRoute()
const router = useRouter()
const pageRef = ref<HTMLElement | null>(null)
const musicList = ref<any>(null)
const albumGridRef = ref<HTMLElement | null>(null)
const artistGridRef = ref<HTMLElement | null>(null)
const localListInfo = ref<any>(null)
const localListId = ref('')
const tracks = ref<LX.Music.MusicInfoLocal[]>([])
const albumCovers = ref<Record<string, string>>({})
const artistCovers = ref<Record<string, string>>({})
const defaultAlbumGroups = ref<ReturnType<typeof buildLocalAlbumGroups>>([])
const defaultArtistGroups = ref<ReturnType<typeof buildLocalArtistGroups>>([])
const visibleAlbumCount = ref(GRID_BATCH_SIZE)
const visibleArtistCount = ref(GRID_BATCH_SIZE)
const keyword = ref('')
let albumResolveTaskId = 0
let artistResolveTaskId = 0
let albumResolveTimer: ReturnType<typeof setTimeout> | null = null
let artistResolveTimer: ReturnType<typeof setTimeout> | null = null
let groupWarmupTimer: ReturnType<typeof setTimeout> | null = null

const normalizedView = computed(() => {
  const view = typeof route.query.view == 'string' ? route.query.view : ''
  return ['tracks', 'albums', 'artists'].includes(view) ? view : 'albums'
})

const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())
const hasKeyword = computed(() => !!normalizedKeyword.value)

const matchTrack = (track: LX.Music.MusicInfoLocal) => {
  if (!normalizedKeyword.value) return true
  const fields = [
    track.name,
    track.singer,
    track.meta.albumName,
    track.meta.filePath,
  ].filter((field): field is string => Boolean(field))
  return fields.some(field => field.toLowerCase().includes(normalizedKeyword.value))
}

const filteredTrackItems = computed<LocalTrackItem[]>(() => {
  return tracks.value
    .map((track, index) => ({ track, index }))
    .filter(item => matchTrack(item.track))
})

const filteredTracks = computed(() => filteredTrackItems.value.map(item => item.track))
const albums = computed(() => {
  if (normalizedView.value != 'albums') return []
  return hasKeyword.value ? buildLocalAlbumGroups(filteredTracks.value) : defaultAlbumGroups.value
})
const artists = computed(() => {
  if (normalizedView.value != 'artists') return []
  return hasKeyword.value ? buildLocalArtistGroups(filteredTracks.value) : defaultArtistGroups.value
})
const visibleAlbums = computed(() => albums.value.slice(0, visibleAlbumCount.value))
const visibleArtists = computed(() => artists.value.slice(0, visibleArtistCount.value))

const searchPlaceholder = computed(() => {
  switch (normalizedView.value) {
    case 'tracks':
      return '搜索本地歌曲、歌手、专辑'
    case 'artists':
      return '搜索本地音乐家'
    default:
      return '搜索本地专辑或歌手'
  }
})

const refreshTracks = async() => {
  if (!localListId.value) return
  tracks.value = await getListMusics(localListId.value) as LX.Music.MusicInfoLocal[]
  setCachedLocalTracks(tracks.value)
}

const warmupDefaultGroups = () => {
  if (groupWarmupTimer) clearTimeout(groupWarmupTimer)
  if (!tracks.value.length) {
    defaultAlbumGroups.value = []
    defaultArtistGroups.value = []
    return
  }

  if (normalizedView.value == 'artists') defaultArtistGroups.value = buildLocalArtistGroups(tracks.value)
  else defaultAlbumGroups.value = buildLocalAlbumGroups(tracks.value)

  groupWarmupTimer = setTimeout(() => {
    const sourceTracks = tracks.value
    if (!sourceTracks.length) return
    defaultAlbumGroups.value = buildLocalAlbumGroups(sourceTracks)
    defaultArtistGroups.value = buildLocalArtistGroups(sourceTracks)
  }, 32)
}

const increaseVisibleGroups = (type: 'albums' | 'artists') => {
  const total = type == 'albums' ? albums.value.length : artists.value.length
  const target = type == 'albums' ? visibleAlbumCount : visibleArtistCount
  if (target.value >= total) return false
  target.value = Math.min(total, target.value + GRID_BATCH_SIZE)
  return true
}

const ensureVisibleGroups = async(type: 'albums' | 'artists') => {
  await nextTick()
  const container = type == 'albums' ? albumGridRef.value : artistGridRef.value
  if (!container) return

  while (
    container.scrollHeight <= container.clientHeight + GRID_LOAD_OFFSET &&
    increaseVisibleGroups(type)
  ) {
    await nextTick()
  }
}

const handleGridScroll = (type: 'albums' | 'artists') => {
  const container = type == 'albums' ? albumGridRef.value : artistGridRef.value
  if (!container) return
  if (container.scrollTop + container.clientHeight < container.scrollHeight - GRID_LOAD_OFFSET) return
  if (!increaseVisibleGroups(type)) return
  void ensureVisibleGroups(type)
}

const handleAlbumScroll = () => {
  handleGridScroll('albums')
}

const handleArtistScroll = () => {
  handleGridScroll('artists')
}

const waitForCoverBatch = async() => new Promise<void>(resolve => {
  window.setTimeout(resolve, 0)
})

const resolveGroupCovers = async(
  type: 'albums' | 'artists',
  groups: ReturnType<typeof buildLocalAlbumGroups>,
  target: typeof albumCovers,
  taskId: number,
) => {
  if (!localListId.value) return

  const resolvedCovers = Object.fromEntries(groups.map(group => {
    const cachedCover = group.cover || getCachedLocalGroupCover(type, group.key)
    return [group.key, cachedCover]
  }).filter(([, cover]) => cover))
  target.value = resolvedCovers

  const pendingGroups = groups.filter(group => {
    const cachedCover = group.cover || getCachedLocalGroupCover(type, group.key)
    return !cachedCover
  })
  if (!pendingGroups.length) return

  let handledCount = 0
  for (const group of pendingGroups) {
    const latestTaskId = type == 'albums' ? albumResolveTaskId : artistResolveTaskId
    if (taskId != latestTaskId) return

    try {
      const cover = await getPicPath({
        musicInfo: group.sourceTrack,
        listId: localListId.value,
        isRefresh: false,
      })
      if (cover) {
        setCachedLocalGroupCover(type, group.key, cover)
        resolvedCovers[group.key] = cover
      }
    } catch {}

    handledCount += 1
    if (handledCount % 6 == 0) {
      if (taskId != (type == 'albums' ? albumResolveTaskId : artistResolveTaskId)) return
      target.value = { ...resolvedCovers }
      await waitForCoverBatch()
    }
  }

  if (taskId != (type == 'albums' ? albumResolveTaskId : artistResolveTaskId)) return
  target.value = { ...resolvedCovers }
}

const scheduleResolveGroupCovers = (
  type: 'albums' | 'artists',
  groups: ReturnType<typeof buildLocalAlbumGroups>,
  target: typeof albumCovers,
) => {
  const taskId = type == 'albums' ? ++albumResolveTaskId : ++artistResolveTaskId
  const timer = type == 'albums' ? albumResolveTimer : artistResolveTimer
  if (timer) clearTimeout(timer)

  const nextTimer = setTimeout(() => {
    void resolveGroupCovers(type, groups, target, taskId)
  }, 48)

  if (type == 'albums') albumResolveTimer = nextTimer
  else artistResolveTimer = nextTimer
}

const init = async() => {
  const list = await ensureLocalMusicList()
  localListInfo.value = list
  localListId.value = list.id
  const cachedTracks = getCachedLocalTracks()
  if (cachedTracks.length) tracks.value = cachedTracks
  await refreshTracks()
}

onMounted(() => {
  void init()
})

onBeforeUnmount(() => {
  if (albumResolveTimer) clearTimeout(albumResolveTimer)
  if (artistResolveTimer) clearTimeout(artistResolveTimer)
  if (groupWarmupTimer) clearTimeout(groupWarmupTimer)
})

watch(tracks, () => {
  warmupDefaultGroups()
}, { immediate: true })

watch(normalizedView, view => {
  if (view == 'albums' && tracks.value.length && !defaultAlbumGroups.value.length) {
    defaultAlbumGroups.value = buildLocalAlbumGroups(tracks.value)
  } else if (view == 'artists' && tracks.value.length && !defaultArtistGroups.value.length) {
    defaultArtistGroups.value = buildLocalArtistGroups(tracks.value)
  }
  if (view == 'albums' || view == 'artists') void ensureVisibleGroups(view)
})

watch(albums, groups => {
  visibleAlbumCount.value = Math.min(GRID_BATCH_SIZE, groups.length)
  if (normalizedView.value == 'albums') void ensureVisibleGroups('albums')
}, { immediate: true })

watch(artists, groups => {
  visibleArtistCount.value = Math.min(GRID_BATCH_SIZE, groups.length)
  if (normalizedView.value == 'artists') void ensureVisibleGroups('artists')
}, { immediate: true })

watch([normalizedView, visibleAlbums], ([view, groups]) => {
  if (view != 'albums') return
  scheduleResolveGroupCovers('albums', groups, albumCovers)
}, { immediate: true })

watch([normalizedView, visibleArtists], ([view, groups]) => {
  if (view != 'artists') return
  scheduleResolveGroupCovers('artists', groups, artistCovers)
}, { immediate: true })

const handleImport = async() => {
  if (!localListInfo.value) return
  await addLocalFile(localListInfo.value)
  await refreshTracks()
}

const handleImportFolder = async() => {
  if (!localListInfo.value) return
  await addLocalFolder(localListInfo.value)
  await refreshTracks()
}

const scrollToTop = () => {
  if (normalizedView.value == 'tracks' && !hasKeyword.value) {
    musicList.value?.scrollToTop?.()
    return
  }
  if (normalizedView.value == 'albums') {
    albumGridRef.value?.scrollTo?.({ top: 0, behavior: 'smooth' })
    return
  }
  if (normalizedView.value == 'artists') {
    artistGridRef.value?.scrollTo?.({ top: 0, behavior: 'smooth' })
    return
  }
  pageRef.value?.scrollTo?.({ top: 0, behavior: 'smooth' })
}

const openDetail = (type: 'albums' | 'artists', key: string) => {
  void router.push({
    path: '/local/detail',
    query: {
      type,
      key,
    },
  })
}

const playTrack = (track: LX.Music.MusicInfoLocal) => {
  void playSingleLocalTrack(track)
}

const playAllTracks = () => {
  void playLocalTempTracks(`${LOCAL_MUSIC_LIST_ID}__all`, tracks.value, 0, {
    interrupt: false,
  })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.page {
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
  padding: 10px;
  color: var(--shell-text, var(--color-font));
  overflow: auto;
}

.headerRow,
.contentCard {
  border-radius: 14px;
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18));
  background: var(--shell-surface, rgba(255, 255, 255, 0.62));
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 28px rgba(32, 50, 80, 0.06);
}

.headerRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
}

.pageTitle {
  margin: 0;
  font-size: 24px;
  line-height: 1;
}

.headerActions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.actionBtn {
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.2));
  background: rgba(255, 255, 255, 0.08);
  color: var(--shell-text, var(--color-font));
  border-radius: 10px;
  padding: 0 14px;
  min-width: 88px;
  height: 34px;
  font-size: 13px;
  cursor: pointer;
  transition: @transition-fast;
  transition-property: transform, opacity, background-color, border-color;

  &:hover {
    opacity: .86;
    transform: translateY(-1px);
  }

  &:active {
    opacity: .72;
    transform: translateY(0);
  }
}

.primary {
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 70%, white 30%));
  border-color: transparent;
  color: #fff;
}

.contentCard {
  position: relative;
  flex: auto;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  padding: 14px;
  overflow: hidden;
}

.searchRow {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  z-index: 6;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.searchBox {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--shell-search-border, rgba(255, 255, 255, 0.22)) 76%, rgba(255, 255, 255, 0.38));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.08)),
    rgba(255, 255, 255, 0.09);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 10px 24px rgba(39, 60, 92, 0.06);
  backdrop-filter: blur(28px) saturate(185%);
  -webkit-backdrop-filter: blur(28px) saturate(185%);
  pointer-events: auto;
  transition: border-color @transition-fast, box-shadow @transition-fast, background-color @transition-fast;

  &:focus-within {
    border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 42%, rgba(255, 255, 255, 0.48));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.34),
      0 14px 30px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 12%, transparent);
  }

  input {
    flex: 1 1 auto;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--shell-text, var(--color-font));
    font-size: 14px;

    &::placeholder {
      color: var(--shell-muted, var(--color-font-label));
    }
  }
}

.searchIcon,
.clearBtn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-muted, var(--color-font-label));
}

.clearBtn {
  width: 24px;
  height: 24px;
  border: none;
  padding: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.listShell,
.gridShell,
.artistShell {
  flex: auto;
  min-height: 0;
}

.listShell {
  padding-top: 58px;
  display: flex;
  flex-flow: column nowrap;
}

.gridShell,
.artistShell {
  padding-top: 18px;
}

.gridShell {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px 16px;
  align-content: start;
  align-items: start;
  grid-auto-flow: row;
  grid-auto-rows: min-content;
  overflow: auto;
}

.artistShell {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px 16px;
  align-content: start;
  align-items: start;
  grid-auto-flow: row;
  grid-auto-rows: min-content;
  overflow: auto;
}

.albumCard,
.artistCard {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.54);
  color: inherit;
  border-radius: 14px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: transform .22s ease, box-shadow .22s ease, background-color .22s ease;
  backdrop-filter: blur(14px);
  overflow: hidden;
  align-self: start;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 26px rgba(28, 44, 68, 0.08);
    background: rgba(255, 255, 255, 0.62);
  }
}

.albumCard {
  display: flex;
  flex-flow: column nowrap;
  align-items: stretch;
  justify-content: flex-start;
  gap: 10px;
  min-height: 0;
}

.coverFrame,
.artistCover {
  flex: none;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.14);

  img,
  div,
  span {
    width: 100%;
    height: 100%;
  }

  img {
    display: block;
    object-fit: cover;
  }
}

.coverFrame {
  width: 100%;
  aspect-ratio: 1 / 1;
}

.artistCover {
  width: 74px;
  height: 74px;
  border-radius: 16px;
  flex: none;
}

.coverFallback,
.artistInitial {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 72%, white 28%));
}

.artistCard {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 98px;
}

.albumMeta,
.artistMeta {
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
  padding: 0 2px 2px;
}

.albumMeta {
  flex: 1 1 auto;
}

.artistMeta {
  align-self: center;
  padding: 0;
}

.artistCard .cardTitle {
  -webkit-line-clamp: 2;
}

.artistCard .cardMeta {
  -webkit-line-clamp: 1;
}

.cardTitle {
  display: block;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.24;
  white-space: normal;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.cardMeta {
  display: block;
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--shell-muted, var(--color-font-label));
  white-space: normal;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

@media (max-width: 1600px) {
  .gridShell,
  .artistShell {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1180px) {
  .gridShell,
  .artistShell {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .gridShell,
  .artistShell {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.tableHead,
.row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1.7fr) minmax(0, 1.2fr) minmax(0, 1.2fr) 90px;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
}

.tableHead {
  flex: none;
  height: 42px;
  border-bottom: 1px solid rgba(140, 170, 210, 0.14);
  color: var(--shell-muted, var(--color-font-label));
  font-size: 12px;
}

.tableBody {
  flex: auto;
  min-height: 0;
  overflow: auto;
}

.row {
  width: 100%;
  height: 52px;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color .2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.14);
  }
}

.cell {
  min-width: 0;
  .mixin-ellipsis-1();
}

.numCell {
  color: var(--shell-muted, var(--color-font-label));
}

.timeCell {
  text-align: right;
}

.emptyState {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-muted, var(--color-font-label));
}
</style>
