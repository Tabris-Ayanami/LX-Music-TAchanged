<template>
  <div :class="$style.page">
    <section :class="$style.contentCard">
      <div :class="$style.searchRow">
        <label :class="$style.searchBox">
          <LiquidGlassLayer
            variant="search"
            :active="true"
            :interactive="true"
            :blur-amount="0.78"
            :saturation="150"
          />
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
          <MusicList v-if="localListId" :list-id="localListId" play-mode="single-temp" play-on-click :temp-list-id-prefix="LOCAL_MUSIC_LIST_ID" />
          <div v-else :class="$style.emptyState">正在准备本地曲库...</div>
        </template>
      </div>

      <div
        v-show="normalizedView == 'albums'"
        ref="albumGridRef"
        :class="[$style.gridShell, { [$style.detailMode]: selectedAlbum }]"
        @wheel.prevent="handleAlbumWheel"
        @click="handleAlbumBackdropClick"
      >
        <div v-if="selectedAlbum" :class="[$style.flyingCover, { [$style.detailOpen]: albumDetailVisible }]">
          <img v-if="selectedAlbumCover" :src="selectedAlbumCover" :alt="selectedAlbumName">
          <div v-else :class="$style.coverFallback">{{ selectedAlbumInitial }}</div>
        </div>
        <div
          v-if="selectedAlbum"
          :class="[$style.albumDetailPanel, { [$style.detailOpen]: albumDetailVisible }]"
          @click.stop
        >
          <LiquidGlassLayer
            variant="island"
            :active="true"
            :interactive="true"
            :blur-amount="1.05"
            :saturation="152"
            :displacement-scale="14"
          />
          <div :class="$style.albumDetailBody" @wheel.stop>
            <button
              v-for="(item, index) in selectedAlbumItems"
              :key="item.track.id"
              type="button"
              :class="$style.albumTrackRow"
              @click="playTrack(item.track)"
            >
              <span :class="$style.trackIndex">{{ Number(index) + 1 }}</span>
              <span :class="$style.trackName" :title="item.track.name">{{ item.track.name }}</span>
              <span :class="$style.trackSinger" :title="item.track.singer">{{ item.track.singer || '--' }}</span>
              <span :class="$style.trackTime">{{ item.track.interval || '--/--' }}</span>
            </button>
          </div>
        </div>
        <div v-if="albums.length" :class="$style.albumStage">
          <div :class="$style.albumDeck">
            <button
              v-for="album in carouselAlbums"
              :key="album.key"
              type="button"
              :class="[$style.albumSlide, $style[album.slot]]"
              :title="album.name"
              @click.stop="handleAlbumSlideClick(album)"
            >
              <span :class="$style.albumBubble">
                <strong>{{ album.name }}</strong>
                <span>{{ album.singer }} · {{ album.count }} 首</span>
              </span>
              <div :class="$style.coverFrame">
                <img v-if="albumCovers[album.key]" :src="albumCovers[album.key]" :alt="album.name" decoding="async" loading="lazy">
                <div v-else :class="$style.coverFallback">{{ album.initial }}</div>
              </div>
            </button>
          </div>
        </div>
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
import LiquidGlassLayer from '@renderer/components/common/liquidGlass/LiquidGlassLayer.vue'
import { getListMusics } from '@renderer/store/list/action'
import {
  LOCAL_MUSIC_LIST_ID,
  buildLocalAlbumGroups,
  buildLocalArtistGroups,
  ensureLocalMusicList,
  getCachedLocalGroupCover,
  getCachedLocalTracks,
  type LocalMusicGroup,
  playSingleLocalTrack,
  setCachedLocalGroupCover,
  setCachedLocalTracks,
} from '@renderer/utils/localMusic'
import MusicList from '@renderer/views/List/MusicList/index.vue'

interface LocalTrackItem {
  index: number
  track: LX.Music.MusicInfoLocal
}

type LocalView = 'tracks' | 'albums' | 'artists'

const GRID_BATCH_SIZE = 20
const GRID_LOAD_OFFSET = 120

const route = useRoute()
const router = useRouter()
const albumGridRef = ref<HTMLElement | null>(null)
const artistGridRef = ref<HTMLElement | null>(null)
const localListId = ref('')
const tracks = ref<LX.Music.MusicInfoLocal[]>([])
const albumCovers = ref<Record<string, string>>({})
const artistCovers = ref<Record<string, string>>({})
const defaultAlbumGroups = ref<ReturnType<typeof buildLocalAlbumGroups>>([])
const defaultArtistGroups = ref<ReturnType<typeof buildLocalArtistGroups>>([])
const visibleAlbumCount = ref(GRID_BATCH_SIZE)
const visibleArtistCount = ref(GRID_BATCH_SIZE)
const activeAlbumIndex = ref(0)
const selectedAlbum = ref<LocalMusicGroup | null>(null)
const selectedAlbumCoverCache = ref('')
const albumDetailVisible = ref(false)
const normalizedView = ref<LocalView>('albums')
const keyword = ref('')
let albumResolveTaskId = 0
let artistResolveTaskId = 0
let albumResolveTimer: ReturnType<typeof setTimeout> | null = null
let artistResolveTimer: ReturnType<typeof setTimeout> | null = null
let groupWarmupTimer: ReturnType<typeof setTimeout> | null = null
let albumDetailCloseTimer: ReturnType<typeof setTimeout> | null = null

const resolveLocalView = (view: unknown): LocalView => {
  if (view == 'tracks') return 'tracks'
  if (view == 'artists') return 'artists'
  return 'albums'
}

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
  return hasKeyword.value ? buildLocalAlbumGroups(filteredTracks.value) : defaultAlbumGroups.value
})
const artists = computed(() => {
  return hasKeyword.value ? buildLocalArtistGroups(filteredTracks.value) : defaultArtistGroups.value
})
const visibleArtists = computed(() => artists.value.slice(0, visibleArtistCount.value))
const selectedAlbumCover = computed(() => selectedAlbum.value
  ? selectedAlbumCoverCache.value || albumCovers.value[selectedAlbum.value.key] || selectedAlbum.value.cover
  : '')
const selectedAlbumName = computed(() => selectedAlbum.value?.name ?? '')
const selectedAlbumInitial = computed(() => selectedAlbum.value?.initial ?? '')
const selectedAlbumItems = computed(() => selectedAlbum.value?.items ?? [])
const wrapAlbumIndex = (index: number) => {
  const length = albums.value.length
  if (!length) return 0
  return (index + length) % length
}
const carouselAlbums = computed(() => {
  const length = albums.value.length
  if (!length) return []
  const offsets = length >= 7
    ? [-3, -2, -1, 0, 1, 2, 3]
    : Array.from({ length }, (_, index) => index - Math.floor(length / 2))

  return offsets.map(offset => {
    const album = albums.value[wrapAlbumIndex(activeAlbumIndex.value + offset)]
    return {
      ...album,
      offset,
      slot: offset == 0
        ? 'centerSlide'
        : offset < 0
          ? `leftSlide${Math.abs(offset)}`
          : `rightSlide${offset}`,
    }
  })
})

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

  if (type == 'albums') {
    while (
      container.scrollWidth <= container.clientWidth + GRID_LOAD_OFFSET &&
      increaseVisibleGroups(type)
    ) {
      await nextTick()
    }
    return
  }

  while (container.scrollHeight <= container.clientHeight + GRID_LOAD_OFFSET && increaseVisibleGroups(type)) {
    await nextTick()
  }
}

const handleGridScroll = (type: 'albums' | 'artists') => {
  const container = type == 'albums' ? albumGridRef.value : artistGridRef.value
  if (!container) return
  if (type == 'albums') {
    if (container.scrollLeft + container.clientWidth < container.scrollWidth - GRID_LOAD_OFFSET) return
    if (!increaseVisibleGroups(type)) return
    void ensureVisibleGroups(type)
    return
  }
  if (container.scrollTop + container.clientHeight < container.scrollHeight - GRID_LOAD_OFFSET) return
  if (!increaseVisibleGroups(type)) return
  void ensureVisibleGroups(type)
}

const prevAlbum = () => {
  activeAlbumIndex.value = wrapAlbumIndex(activeAlbumIndex.value - 1)
}

const nextAlbum = () => {
  activeAlbumIndex.value = wrapAlbumIndex(activeAlbumIndex.value + 1)
}

const handleAlbumWheel = (event: Event) => {
  const wheelEvent = event as WheelEvent
  wheelEvent.deltaY > 0 || wheelEvent.deltaX > 0 ? nextAlbum() : prevAlbum()
}

const handleAlbumSlideClick = (album: { offset: number, key: string }) => {
  if (album.offset == 0) {
    openAlbumDetail(album.key)
    return
  }
  activeAlbumIndex.value = wrapAlbumIndex(activeAlbumIndex.value + album.offset)
}

const openAlbumDetail = (key: string) => {
  const album = albums.value.find(item => item.key == key)
  if (!album) return
  if (albumDetailCloseTimer) {
    clearTimeout(albumDetailCloseTimer)
    albumDetailCloseTimer = null
  }
  selectedAlbum.value = album
  selectedAlbumCoverCache.value = albumCovers.value[album.key] || album.cover || getCachedLocalGroupCover('albums', album.key) || ''
  albumDetailVisible.value = false
  void nextTick(() => {
    albumDetailVisible.value = true
  })
}

const closeAlbumDetail = () => {
  if (!selectedAlbum.value || !albumDetailVisible.value) return
  albumDetailVisible.value = false
  if (albumDetailCloseTimer) clearTimeout(albumDetailCloseTimer)
  albumDetailCloseTimer = setTimeout(() => {
    selectedAlbum.value = null
    selectedAlbumCoverCache.value = ''
    albumDetailCloseTimer = null
  }, 320)
}

const handleAlbumBackdropClick = () => {
  closeAlbumDetail()
}

const handleArtistScroll = () => {
  handleGridScroll('artists')
}

const waitForCoverBatch = async() => new Promise<void>(resolve => {
  window.setTimeout(resolve, 0)
})

const syncSelectedAlbumCoverCache = (covers: Record<string, string>) => {
  if (!selectedAlbum.value || selectedAlbumCoverCache.value) return
  const cover = covers[selectedAlbum.value.key]
  if (cover) selectedAlbumCoverCache.value = cover
}

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
      if (type == 'albums') syncSelectedAlbumCoverCache(resolvedCovers)
      await waitForCoverBatch()
    }
  }

  if (taskId != (type == 'albums' ? albumResolveTaskId : artistResolveTaskId)) return
  target.value = { ...resolvedCovers }
  if (type == 'albums') syncSelectedAlbumCoverCache(resolvedCovers)
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
  if (albumDetailCloseTimer) clearTimeout(albumDetailCloseTimer)
})

watch(tracks, () => {
  warmupDefaultGroups()
}, { immediate: true })

watch(() => [route.path, route.query.view] as const, ([path, view]) => {
  if (path != '/local') return
  normalizedView.value = resolveLocalView(view)
}, { immediate: true })

watch(normalizedView, view => {
  closeAlbumDetail()
  if (view == 'albums' && tracks.value.length && !defaultAlbumGroups.value.length) {
    defaultAlbumGroups.value = buildLocalAlbumGroups(tracks.value)
  } else if (view == 'artists' && tracks.value.length && !defaultArtistGroups.value.length) {
    defaultArtistGroups.value = buildLocalArtistGroups(tracks.value)
  }
  if (view == 'albums' || view == 'artists') void ensureVisibleGroups(view)
})

watch(albums, groups => {
  visibleAlbumCount.value = Math.min(GRID_BATCH_SIZE, groups.length)
  activeAlbumIndex.value = Math.min(activeAlbumIndex.value, Math.max(groups.length - 1, 0))
  if (selectedAlbum.value && !groups.some(group => group.key == selectedAlbum.value?.key)) closeAlbumDetail()
  if (normalizedView.value == 'albums') void ensureVisibleGroups('albums')
}, { immediate: true })

watch(artists, groups => {
  visibleArtistCount.value = Math.min(GRID_BATCH_SIZE, groups.length)
  if (normalizedView.value == 'artists') void ensureVisibleGroups('artists')
}, { immediate: true })

watch([normalizedView, carouselAlbums], ([view, groups]) => {
  if (view != 'albums') return
  scheduleResolveGroupCovers('albums', groups, albumCovers)
}, { immediate: true })

watch([normalizedView, visibleArtists], ([view, groups]) => {
  if (view != 'artists') return
  scheduleResolveGroupCovers('artists', groups, artistCovers)
}, { immediate: true })

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
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.page {
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  padding: 10px;
  box-sizing: border-box;
  color: var(--shell-text, var(--color-font));
  overflow: auto;
}

.contentCard {
  border-radius: 14px;
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18));
  background: var(--shell-surface, rgba(255, 255, 255, 0.62));
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 28px rgba(32, 50, 80, 0.06);
}

.contentCard {
  position: relative;
  flex: auto;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 14px;
  padding: 14px;
  overflow: hidden;
}

.searchRow {
  flex: none;
  display: flex;
  align-items: center;
}

.searchBox {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--shell-search-border, rgba(255, 255, 255, 0.18)) 84%, rgba(255, 255, 255, 0.18));
  background: transparent;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 8px 18px rgba(12, 16, 24, 0.08);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  overflow: hidden;
  isolation: isolate;
  transition: border-color @transition-fast, box-shadow @transition-fast, background-color @transition-fast;

  &:focus-within {
    border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 34%, rgba(255, 255, 255, 0.28));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 10px 22px color-mix(in srgb, var(--shell-accent, var(--color-primary)) 8%, transparent);
  }

  input {
    position: relative;
    z-index: 1;
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
  position: relative;
  z-index: 1;
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
  display: flex;
  flex-flow: column nowrap;
}

.gridShell,
.artistShell {
  padding-top: 4px;
}

.gridShell {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: hidden;
  padding: 34px 48px 52px;
  background:
    linear-gradient(180deg, transparent 0 56%, rgba(255, 255, 255, 0.1) 72%, transparent 100%),
    radial-gradient(ellipse at center 78%, rgba(255, 255, 255, 0.2), transparent 58%);
}

.detailMode {
  .albumStage {
    margin-top: 74px;
  }
}

.albumStage {
  position: relative;
  width: min(1080px, 100%);
  height: min(520px, 100%);
  min-height: 390px;
  margin-top: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1200px;
  transition: margin-top .36s cubic-bezier(.16, 1, .3, 1);
}

.albumDeck {
  position: relative;
  width: 100%;
  height: 330px;
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
  scrollbar-color: var(--shell-scroll-thumb, var(--color-primary-alpha-600)) transparent;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    background-color: transparent;
  }

  &::-webkit-scrollbar-track {
    background-color: transparent;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background-color: var(--shell-scroll-thumb, var(--color-primary-alpha-600));
    transition: background-color .24s ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: var(--shell-scroll-thumb-hover, var(--color-primary-alpha-400));
  }
}

.albumSlide,
.artistCard {
  border: 1px solid var(--shell-control-border, rgba(255, 255, 255, 0.14));
  background: var(--shell-card, rgba(255, 255, 255, 0.54));
  color: inherit;
  border-radius: 14px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: transform .22s ease, box-shadow .22s ease, background-color .22s ease;
  backdrop-filter: blur(14px);
  overflow: hidden;
  align-self: start;
}

.artistCard:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(28, 44, 68, 0.08);
  background: var(--shell-card-strong, rgba(255, 255, 255, 0.62));
}

.albumSlide {
  position: relative;
  position: absolute;
  left: 50%;
  top: 54%;
  width: clamp(132px, 20vw, 220px);
  aspect-ratio: 1 / 1;
  padding: 0;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  overflow: visible;
  will-change: transform, opacity, filter;
  transition:
    transform .46s cubic-bezier(.22, .84, .28, 1),
    opacity .36s ease,
    filter .36s ease,
    border-color .24s ease,
    background-color .24s ease;

  &:hover {
    background: var(--shell-card-strong, rgba(255, 255, 255, 0.62));
    border-color: color-mix(in srgb, var(--color-primary) 28%, var(--shell-control-border, rgba(255, 255, 255, .16)));

    .albumBubble {
      opacity: 1;
      transform: translate(-50%, -10px) scale(1);
      pointer-events: auto;
    }

    .coverFrame {
      animation: album-cover-hop .42s cubic-bezier(.2, .9, .24, 1);
    }
  }

  &::after {
    content: '';
    position: absolute;
    left: 8%;
    right: 8%;
    bottom: -28px;
    height: 28px;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.3), transparent 68%);
    opacity: .7;
    pointer-events: none;
  }
}

.albumBubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 18px);
  z-index: 4;
  width: max-content;
  max-width: 230px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--shell-control-border, rgba(255, 255, 255, .18));
  background: color-mix(in srgb, var(--shell-card-strong, rgba(255, 255, 255, .9)) 88%, transparent);
  box-shadow: 0 16px 36px rgba(20, 29, 46, .16);
  backdrop-filter: blur(28px) saturate(170%);
  -webkit-backdrop-filter: blur(28px) saturate(170%);
  color: var(--shell-text, var(--color-font));
  opacity: 0;
  transform: translate(-50%, 0) scale(.96);
  transition: opacity .2s ease, transform .24s cubic-bezier(.16, 1, .3, 1);
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -8px;
    width: 14px;
    height: 14px;
    border-right: 1px solid var(--shell-control-border, rgba(255, 255, 255, .18));
    border-bottom: 1px solid var(--shell-control-border, rgba(255, 255, 255, .18));
    background: color-mix(in srgb, var(--shell-card-strong, rgba(255, 255, 255, .9)) 88%, transparent);
    transform: translateX(-50%) rotate(45deg);
  }

  strong,
  span {
    position: relative;
    z-index: 1;
    display: block;
    .mixin-ellipsis-1();
  }

  strong {
    font-size: 13px;
    line-height: 1.3;
  }

  span {
    margin-top: 3px;
    font-size: 12px;
    color: var(--shell-muted, var(--color-font-label));
  }
}

.centerSlide {
  transform: translate(-50%, -50%) translateX(0) scale(1.18);
  opacity: 1;
  z-index: 20;
}

.leftSlide1 {
  transform: translate(-50%, -50%) translateX(clamp(-190px, -16vw, -120px)) scale(.88) rotateY(9deg);
  opacity: .82;
  z-index: 14;
}

.rightSlide1 {
  transform: translate(-50%, -50%) translateX(clamp(120px, 16vw, 190px)) scale(.88) rotateY(-9deg);
  opacity: .82;
  z-index: 14;
}

.leftSlide2 {
  transform: translate(-50%, -50%) translateX(clamp(-380px, -31vw, -240px)) scale(.72) rotateY(14deg);
  opacity: .62;
  z-index: 10;
}

.rightSlide2 {
  transform: translate(-50%, -50%) translateX(clamp(240px, 31vw, 380px)) scale(.72) rotateY(-14deg);
  opacity: .62;
  z-index: 10;
}

.leftSlide3 {
  transform: translate(-50%, -50%) translateX(clamp(-540px, -42vw, -330px)) scale(.58) rotateY(18deg);
  opacity: .42;
  z-index: 6;
}

.rightSlide3 {
  transform: translate(-50%, -50%) translateX(clamp(330px, 42vw, 540px)) scale(.58) rotateY(-18deg);
  opacity: .42;
  z-index: 6;
}

.leftSlide1,
.rightSlide1 {
  filter: saturate(.96) brightness(.92);
}

.leftSlide2,
.rightSlide2 {
  filter: saturate(.82) brightness(.78);
}

.leftSlide3,
.rightSlide3 {
  filter: saturate(.68) brightness(.66);
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
  box-shadow: 0 18px 30px rgba(0, 0, 0, .22);
  -webkit-box-reflect: below 12px linear-gradient(transparent 50%, rgba(0, 0, 0, .28));
  transform-origin: center bottom;
  will-change: transform;
}

.flyingCover {
  position: absolute;
  left: 50%;
  top: 54%;
  z-index: 50;
  width: clamp(132px, 20vw, 220px);
  aspect-ratio: 1 / 1;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 24px 46px rgba(0, 0, 0, .24);
  opacity: 0;
  transform: translate(-50%, -50%) scale(1.18);
  transition:
    left .48s cubic-bezier(.16, 1, .3, 1),
    top .48s cubic-bezier(.16, 1, .3, 1),
    width .48s cubic-bezier(.16, 1, .3, 1),
    opacity .2s ease,
    transform .48s cubic-bezier(.16, 1, .3, 1);
  pointer-events: none;

  img,
  div {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.flyingCover.detailOpen {
  left: 22px;
  top: 18px;
  width: 96px;
  opacity: 1;
  transform: translate(0, 0) scale(1);
}

.albumDetailPanel {
  position: absolute;
  left: 132px;
  top: -56px;
  z-index: 46;
  width: min(720px, calc(100% - 160px));
  height: 164px;
  min-height: 0;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--shell-control-border, rgba(255, 255, 255, .14)) 74%, transparent);
  background: color-mix(in srgb, var(--shell-card, rgba(255, 255, 255, .54)) 62%, rgba(16, 18, 22, .28));
  box-shadow: 0 18px 42px rgba(0, 0, 0, .18);
  opacity: 0;
  transform: translateY(-18px) scale(.96);
  transition:
    opacity .24s ease,
    transform .36s cubic-bezier(.16, 1, .3, 1),
    top .36s cubic-bezier(.16, 1, .3, 1);
  pointer-events: none;
  isolation: isolate;
}

.albumDetailPanel.detailOpen {
  top: 18px;
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.albumDetailBody {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 10px 12px;
  box-sizing: border-box;
  overflow: auto;
  scrollbar-color: var(--shell-scroll-thumb, var(--color-primary-alpha-600)) transparent;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 6px;
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background-color: var(--shell-scroll-thumb, var(--color-primary-alpha-600));
  }
}

.albumTrackRow {
  width: 100%;
  height: 40px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1.5fr) minmax(0, 1fr) 70px;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 10px;
  padding: 0 10px;
  background: transparent;
  color: var(--shell-text, var(--color-font));
  text-align: left;
  cursor: pointer;
  transition: background-color .18s ease, transform .18s ease;

  &:hover {
    background: rgba(255, 255, 255, .18);
    transform: translateY(-1px);
  }
}

.trackIndex,
.trackSinger,
.trackTime {
  color: var(--shell-muted, var(--color-font-label));
}

.trackName,
.trackSinger {
  .mixin-ellipsis-1();
}

.trackTime {
  text-align: right;
}

@keyframes album-cover-hop {
  0% {
    transform: translateY(0) scale(1);
  }
  42% {
    transform: translateY(-10px) scale(1.035);
  }
  72% {
    transform: translateY(2px) scale(.995);
  }
  100% {
    transform: translateY(0) scale(1);
  }
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
  color: var(--shell-text, var(--color-font));
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

@media (max-width: 1180px) {
  .artistShell {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .gridShell {
    padding-inline: 34px;
  }

  .detailMode {
    .albumStage {
      margin-top: 74px;
    }
  }

  .albumSlide {
    width: clamp(104px, 28vw, 150px);
  }

  .centerSlide {
    transform: translate(-50%, -50%) translateX(0) scale(1.12);
  }

  .leftSlide1 {
    transform: translate(-50%, -50%) translateX(clamp(-118px, -22vw, -82px)) scale(.86) rotateY(8deg);
  }

  .rightSlide1 {
    transform: translate(-50%, -50%) translateX(clamp(82px, 22vw, 118px)) scale(.86) rotateY(-8deg);
  }

  .leftSlide2 {
    transform: translate(-50%, -50%) translateX(clamp(-236px, -42vw, -164px)) scale(.7) rotateY(12deg);
  }

  .rightSlide2 {
    transform: translate(-50%, -50%) translateX(clamp(164px, 42vw, 236px)) scale(.7) rotateY(-12deg);
  }

  .leftSlide3 {
    transform: translate(-50%, -50%) translateX(clamp(-330px, -58vw, -230px)) scale(.56) rotateY(16deg);
  }

  .rightSlide3 {
    transform: translate(-50%, -50%) translateX(clamp(230px, 58vw, 330px)) scale(.56) rotateY(-16deg);
  }

  .albumDetailPanel {
    left: 108px;
    width: min(520px, calc(100% - 124px));
    height: 154px;
  }

  .flyingCover.detailOpen {
    width: 78px;
  }

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
  color: var(--shell-soft-text, var(--color-font-label));
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
  color: var(--shell-soft-text, var(--color-font-label));
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

:global(.themeShellDark) {
  .contentCard {
    background: rgba(10, 11, 13, .82);
    border-color: rgba(255, 255, 255, .08);
  }

  .gridShell {
    background:
      linear-gradient(180deg, transparent 0 58%, rgba(255, 255, 255, .035) 72%, transparent 100%),
      radial-gradient(ellipse at center 78%, rgba(255, 255, 255, .11), transparent 58%);
  }

  .artistCard,
  .albumSlide {
    background: rgba(24, 26, 30, .92);
    border-color: rgba(255, 255, 255, .09);
    box-shadow: 0 16px 30px rgba(0, 0, 0, .22);

    &:hover {
      background: rgba(32, 35, 40, .98);
      border-color: rgba(255, 255, 255, .16);
    }
  }

  .albumDetailPanel {
    background: rgba(24, 26, 30, .84);
    border-color: rgba(255, 255, 255, .1);
    box-shadow: 0 18px 46px rgba(0, 0, 0, .34);
  }

  .artistCover,
  .coverFrame {
    background: rgba(255, 255, 255, .08);
  }

  .tableHead,
  .row,
  .cell {
    color: rgba(246, 247, 248, .94);
  }

  .tableHead,
  .numCell {
    color: rgba(235, 238, 241, .72);
  }

  .row {
    &:hover {
      background: rgba(255, 255, 255, .075);
    }
  }

  .albumBubble {
    background: rgba(24, 26, 30, .92);

    &::after {
      background: rgba(24, 26, 30, .92);
    }
  }

  .albumTrackRow {
    &:hover {
      background: rgba(255, 255, 255, .09);
    }
  }
}
</style>
