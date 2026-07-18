<template>
  <div :class="[$style.page, { [$style.reduceMotion]: !appSetting['common.isShowAnimation'] }]">
    <section ref="contentCardRef" :class="$style.contentCard">
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

      <div
        v-if="selectedAlbum && selectedAlbumDetailStyle == 'planet'"
        :style="planetPortalStyle"
        :class="[
          $style.planetPortal,
          { [$style.detailOpen]: albumDetailVisible },
          { [$style.reduceMotion]: !appSetting['common.isShowAnimation'] },
        ]"
        @click="closePlanetAlbum"
      >
        <span :class="[$style.planetEdgeCue, $style.edgeCueTop]" aria-hidden="true">
          <svg viewBox="0 0 512 512"><use xlink:href="#icon-back" /></svg>
        </span>
        <span :class="[$style.planetEdgeCue, $style.edgeCueRight]" aria-hidden="true">
          <svg viewBox="0 0 512 512"><use xlink:href="#icon-back" /></svg>
        </span>
        <span :class="[$style.planetEdgeCue, $style.edgeCueBottom]" aria-hidden="true">
          <svg viewBox="0 0 512 512"><use xlink:href="#icon-back" /></svg>
        </span>
        <span :class="[$style.planetEdgeCue, $style.edgeCueLeft]" aria-hidden="true">
          <svg viewBox="0 0 512 512"><use xlink:href="#icon-back" /></svg>
        </span>
        <div :class="$style.planetPortalSurface" @click.stop>
          <header :class="$style.planetDetailHeader">
            <div :class="$style.planetHeroCover">
              <img v-if="selectedAlbumCover" :src="selectedAlbumCover" :alt="selectedAlbumName">
              <div v-else :class="$style.coverFallback">{{ selectedAlbumInitial }}</div>
            </div>
            <div :class="$style.planetDetailMeta">
              <span>专辑行星系</span>
              <strong>{{ selectedAlbumName }}</strong>
              <small>{{ selectedAlbum?.singer }} · {{ selectedAlbumItems.length }} 首歌曲</small>
            </div>
          </header>
          <div
            ref="songPlanetViewportRef"
            :class="[$style.songPlanetViewport, { [$style.spatialDragging]: songPlanetDragging }]"
            tabindex="0"
            aria-label="歌曲二维行星画布，可拖拽浏览"
            @pointerdown="startSpatialDrag('songs', $event)"
            @pointermove="moveSpatialDrag('songs', $event)"
            @pointerup="endSpatialDrag('songs', $event)"
            @pointercancel="endSpatialDrag('songs', $event)"
            @wheel.prevent="handleSpatialWheel('songs', $event)"
          >
            <div v-if="selectedAlbumItems.length" :class="$style.spatialLayer" role="list" :aria-label="`${selectedAlbumName}的歌曲`">
              <button
                v-for="entry in songPlanetEntries"
                :key="`${entry.item.track.id}_${entry.index}`"
                type="button"
                role="listitem"
                :style="entry.style"
                :class="$style.songPlanet"
                :aria-label="`播放 ${entry.item.track.name}`"
                @click.stop="handleSongPlanetClick(entry.item.track)"
              >
                <span :class="$style.spatialCardBody">
                  <span :class="$style.songPlanetHalo">
                  <span :class="$style.songPlanetCover">
                    <img
                      v-if="entry.item.track.meta.picUrl || selectedAlbumCover"
                      :src="entry.item.track.meta.picUrl || selectedAlbumCover"
                      :alt="entry.item.track.name"
                      decoding="async"
                      loading="eager"
                      draggable="false"
                    >
                    <span v-else :class="$style.coverFallback">{{ entry.item.track.name.slice(0, 1).toUpperCase() }}</span>
                  </span>
                  </span>
                  <span :class="$style.songPlanetLabel">
                    <strong>{{ entry.item.track.name }}</strong>
                    <small>{{ entry.item.track.singer || '--' }}</small>
                  </span>
                </span>
              </button>
            </div>
            <div v-else :class="$style.emptyState">这个专辑下暂时还没有歌曲。</div>
          </div>
        </div>
      </div>

      <div v-if="normalizedView == 'tracks'" :class="$style.listShell">
        <template v-if="hasKeyword">
          <div v-if="filteredTrackItems.length" :class="$style.tableHead">
            <span :class="[$style.cell, $style.numCell]">#</span>
            <span :class="[$style.cell, $style.nameCell]">歌曲名</span>
            <span :class="[$style.cell, $style.singerCell]">艺术家</span>
            <span :class="[$style.cell, $style.albumCell]">专辑名</span>
            <span :class="[$style.cell, $style.timeCell]">时长</span>
          </div>
          <base-virtualized-list
            v-if="filteredTrackItems.length"
            v-slot="{ item, index }: { item: unknown, index: number }"
            :list="filteredTrackItems"
            key-name="id"
            :item-height="52"
            :container-class="['scroll', $style.tableBody].join(' ')"
            content-class="list"
          >
            <button
              type="button"
              :class="$style.row"
              @click="playTrack(toLocalTrackItem(item).track)"
            >
              <span :class="[$style.cell, $style.numCell]">{{ Number(index) + 1 }}</span>
              <span :class="[$style.cell, $style.nameCell]" :title="toLocalTrackItem(item).track.name">{{ toLocalTrackItem(item).track.name }}</span>
              <span :class="[$style.cell, $style.singerCell]" :title="toLocalTrackItem(item).track.singer">{{ toLocalTrackItem(item).track.singer || '--' }}</span>
              <span :class="[$style.cell, $style.albumCell]" :title="toLocalTrackItem(item).track.meta.albumName">{{ toLocalTrackItem(item).track.meta.albumName || '--' }}</span>
              <span :class="[$style.cell, $style.timeCell]">{{ toLocalTrackItem(item).track.interval || '--/--' }}</span>
            </button>
          </base-virtualized-list>
          <div v-else :class="$style.emptyState">没有匹配到本地歌曲。</div>
        </template>
        <template v-else>
          <MusicList v-if="localListId" :list-id="localListId" play-mode="single-temp" play-on-click :temp-list-id-prefix="LOCAL_MUSIC_LIST_ID" />
          <div v-else :class="$style.emptyState">正在准备本地曲库...</div>
        </template>
      </div>

      <div
        v-else-if="normalizedView == 'albums'"
        ref="albumGridRef"
        :class="[
          $style.gridShell,
          { [$style.waterfallGridShell]: albumViewStyle == 'waterfall' },
          { [$style.planetGridShell]: albumViewStyle == 'planet' },
          { [$style.detailMode]: selectedAlbum && selectedAlbumDetailStyle == 'carousel' },
        ]"
        @scroll.passive="handleAlbumScroll"
        @wheel="handleAlbumWheel"
        @click="handleAlbumBackdropClick"
      >
        <div v-if="selectedAlbum && selectedAlbumDetailStyle == 'carousel'" :class="[$style.flyingCover, { [$style.detailOpen]: albumDetailVisible }]">
          <img v-if="selectedAlbumCover" :src="selectedAlbumCover" :alt="selectedAlbumName">
          <div v-else :class="$style.coverFallback">{{ selectedAlbumInitial }}</div>
        </div>
        <div
          v-if="selectedAlbum && selectedAlbumDetailStyle == 'carousel'"
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
        <div v-if="albums.length && albumViewStyle == 'waterfall'" :class="$style.waterfallGrid">
          <button
            v-for="album in visibleAlbums"
            :key="album.key"
            type="button"
            :class="[$style.groupCard, $style.albumWaterfallCard]"
            :title="`${album.name} · ${album.singer}`"
            @click.stop="openDetail('albums', album.key)"
          >
            <span :class="$style.albumWaterfallCover">
              <img v-if="albumCovers[album.key]" :src="albumCovers[album.key]" :alt="album.name" decoding="async" loading="lazy">
              <span v-else :class="$style.coverFallback">{{ album.initial }}</span>
            </span>
            <span :class="$style.groupMeta">
              <strong :class="$style.cardTitle">{{ album.name }}</strong>
              <span :class="$style.cardMeta">{{ album.singer }} · {{ album.count }} 首</span>
            </span>
          </button>
        </div>
        <div v-if="albums.length && albumViewStyle == 'carousel'" :class="$style.albumStage">
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
        <div
          v-else-if="albums.length && albumViewStyle == 'planet'"
          ref="planetStageRef"
          :class="[$style.planetStage, { [$style.spatialDragging]: albumPlanetDragging }]"
          tabindex="0"
          aria-label="本地专辑二维行星画布，可拖拽浏览"
          @pointerdown="startSpatialDrag('albums', $event)"
          @pointermove="moveSpatialDrag('albums', $event)"
          @pointerup="endSpatialDrag('albums', $event)"
          @pointercancel="endSpatialDrag('albums', $event)"
          @wheel.prevent="handleSpatialWheel('albums', $event)"
        >
          <div :class="$style.planetAlbumCluster" role="list" aria-label="本地专辑行星视图">
            <button
              v-for="entry in albumPlanetEntries"
              :key="entry.album.key"
              type="button"
              role="listitem"
              :style="entry.style"
              :class="$style.planetAlbum"
              :title="`${entry.album.name} · ${entry.album.singer}`"
              :aria-label="`打开专辑 ${entry.album.name}，${entry.album.count} 首歌曲`"
              @click.stop="handlePlanetAlbumClick(entry.album, $event)"
            >
              <span :class="$style.spatialCardBody">
                <span :class="$style.planetAlbumHalo">
                  <span :class="$style.planetAlbumCover">
                    <img v-if="albumCovers[entry.album.key]" :src="albumCovers[entry.album.key]" :alt="entry.album.name" decoding="async" loading="eager" draggable="false">
                    <span v-else :class="$style.coverFallback">{{ entry.album.initial }}</span>
                  </span>
                </span>
                <span :class="$style.planetAlbumLabel">
                  <strong>{{ entry.album.name }}</strong>
                  <small>{{ entry.album.singer }} · {{ entry.album.count }} 首</small>
                </span>
              </span>
            </button>
          </div>
        </div>
        <div v-if="!albums.length" :class="$style.emptyState">
          {{ hasKeyword ? '没有匹配到本地专辑。' : '导入歌曲后会在这里生成专辑墙。' }}
        </div>
      </div>

      <div
        v-else
        ref="artistGridRef"
        :class="[
          $style.artistViewShell,
          { [$style.waterfallGridShell]: artistViewStyle == 'waterfall' },
          { [$style.planetGridShell]: artistViewStyle == 'planet' },
        ]"
        @scroll.passive="handleArtistScroll"
        @wheel="handleArtistWheel"
      >
        <div v-if="artists.length && artistViewStyle == 'waterfall'" :class="$style.waterfallGrid">
          <button
            v-for="artist in visibleArtists"
            :key="artist.key"
            type="button"
            :class="[$style.groupCard, $style.artistCard]"
            :title="artist.name"
            @click="openDetail('artists', artist.key)"
          >
            <span :class="$style.artistCover">
              <img v-if="artistCovers[artist.key]" :src="artistCovers[artist.key]" :alt="artist.name" decoding="async" loading="lazy">
              <span v-else :class="$style.artistInitial">{{ artist.initial }}</span>
            </span>
            <span :class="$style.groupMeta">
              <strong :class="$style.cardTitle">{{ artist.name }}</strong>
              <span :class="$style.cardMeta">{{ artist.subtitle }} · {{ artist.count }} 首</span>
            </span>
          </button>
        </div>
        <div v-else-if="artists.length && artistViewStyle == 'carousel'" :class="$style.albumStage">
          <div :class="$style.albumDeck">
            <button
              v-for="artist in carouselArtists"
              :key="artist.key"
              type="button"
              :class="[$style.albumSlide, $style.artistSlide, $style[artist.slot]]"
              :title="artist.name"
              @click.stop="handleArtistSlideClick(artist)"
            >
              <span :class="$style.albumBubble">
                <strong>{{ artist.name }}</strong>
                <span>{{ artist.subtitle }} · {{ artist.count }} 首</span>
              </span>
              <span :class="[$style.coverFrame, $style.artistCarouselCover]">
                <img v-if="artistCovers[artist.key]" :src="artistCovers[artist.key]" :alt="artist.name" decoding="async" loading="lazy">
                <span v-else :class="$style.artistInitial">{{ artist.initial }}</span>
              </span>
            </button>
          </div>
        </div>
        <div
          v-else-if="artists.length && artistViewStyle == 'planet'"
          ref="artistPlanetStageRef"
          :class="[$style.planetStage, { [$style.spatialDragging]: artistPlanetDragging }]"
          tabindex="0"
          aria-label="本地歌手二维行星画布，可拖拽浏览"
          @pointerdown="startSpatialDrag('artists', $event)"
          @pointermove="moveSpatialDrag('artists', $event)"
          @pointerup="endSpatialDrag('artists', $event)"
          @pointercancel="endSpatialDrag('artists', $event)"
          @wheel.prevent="handleSpatialWheel('artists', $event)"
        >
          <div :class="$style.planetAlbumCluster" role="list" aria-label="本地歌手行星视图">
            <button
              v-for="entry in artistPlanetEntries"
              :key="entry.artist.key"
              type="button"
              role="listitem"
              :style="entry.style"
              :class="[$style.planetAlbum, $style.artistPlanet]"
              :title="entry.artist.name"
              :aria-label="`打开歌手 ${entry.artist.name}，${entry.artist.count} 首歌曲`"
              @click.stop="handlePlanetArtistClick(entry.artist)"
            >
              <span :class="$style.spatialCardBody">
                <span :class="[$style.planetAlbumHalo, $style.artistPlanetHalo]">
                  <span :class="$style.planetAlbumCover">
                    <img v-if="artistCovers[entry.artist.key]" :src="artistCovers[entry.artist.key]" :alt="entry.artist.name" decoding="async" loading="eager" draggable="false">
                    <span v-else :class="$style.artistInitial">{{ entry.artist.initial }}</span>
                  </span>
                </span>
                <span :class="$style.planetAlbumLabel">
                  <strong>{{ entry.artist.name }}</strong>
                  <small>{{ entry.artist.subtitle }} · {{ entry.artist.count }} 首</small>
                </span>
              </span>
            </button>
          </div>
        </div>
        <div v-if="!artists.length" :class="$style.emptyState">
          {{ hasKeyword ? '没有匹配到本地音乐家。' : '导入歌曲后会在这里汇总音乐家。' }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { getPicPath } from '@renderer/core/music'
import LiquidGlassLayer from '@renderer/components/common/liquidGlass/LiquidGlassLayer.vue'
import { getListMusics } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'
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
import {
  buildSpatialHexLayout,
  buildSpatialIndex,
  querySpatialIndex,
  resolveSpatialFrame,
  type SpatialPan,
  type SpatialPoint,
  type SpatialViewport,
} from './spatialCanvas'

interface LocalTrackItem {
  id: string
  index: number
  track: LX.Music.MusicInfoLocal
}

interface LocalTrackSearchItem extends LocalTrackItem {
  searchText: string
}

const toLocalTrackItem = (item: unknown) => item as LocalTrackItem

type LocalView = 'tracks' | 'albums' | 'artists'
type SpatialCanvasKind = 'albums' | 'artists' | 'songs'

interface SpatialMetrics {
  spacingX: number
  spacingY: number
  visibilityBuffer: number
}

interface SpatialDragState {
  active: boolean
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

const GRID_BATCH_SIZE = 20
const GRID_LOAD_OFFSET = 120
const DEFAULT_SPATIAL_VIEWPORT = { width: 1040, height: 640 }
const DRAG_THRESHOLD = 7
const MAX_MOUNTED_SPATIAL_PLANETS = 50

const route = useRoute()
const router = useRouter()
const contentCardRef = ref<HTMLElement | null>(null)
const albumGridRef = ref<HTMLElement | null>(null)
const planetStageRef = ref<HTMLElement | null>(null)
const artistPlanetStageRef = ref<HTMLElement | null>(null)
const songPlanetViewportRef = ref<HTMLElement | null>(null)
const artistGridRef = ref<HTMLElement | null>(null)
const localListId = ref('')
const tracks = shallowRef<LX.Music.MusicInfoLocal[]>([])
const albumCovers = shallowRef<Record<string, string>>({})
const artistCovers = shallowRef<Record<string, string>>({})
const defaultAlbumGroups = shallowRef<ReturnType<typeof buildLocalAlbumGroups>>([])
const defaultArtistGroups = shallowRef<ReturnType<typeof buildLocalArtistGroups>>([])
const visibleAlbumCount = ref(GRID_BATCH_SIZE)
const visibleArtistCount = ref(GRID_BATCH_SIZE)
const activeAlbumIndex = ref(0)
const activeArtistIndex = ref(0)
const selectedAlbum = ref<LocalMusicGroup | null>(null)
const selectedAlbumCoverCache = ref('')
const selectedAlbumDetailStyle = ref<LX.AppSetting['localMusic.albumViewStyle']>('carousel')
const albumDetailVisible = ref(false)
const planetPortalOrigin = ref({ top: 24, right: 24, bottom: 24, left: 24 })
const normalizedView = ref<LocalView>('albums')
const keyword = ref('')
const albumPlanetPan = ref<SpatialPan>({ x: 0, y: 0 })
const artistPlanetPan = ref<SpatialPan>({ x: 0, y: 0 })
const songPlanetPan = ref<SpatialPan>({ x: 0, y: 0 })
const albumPlanetViewport = ref<SpatialViewport>({ ...DEFAULT_SPATIAL_VIEWPORT })
const artistPlanetViewport = ref<SpatialViewport>({ ...DEFAULT_SPATIAL_VIEWPORT })
const songPlanetViewport = ref<SpatialViewport>({ ...DEFAULT_SPATIAL_VIEWPORT })
const albumPlanetDragging = ref(false)
const artistPlanetDragging = ref(false)
const songPlanetDragging = ref(false)
const albumDragState: SpatialDragState = { active: false, pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0, moved: false }
const artistDragState: SpatialDragState = { active: false, pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0, moved: false }
const songDragState: SpatialDragState = { active: false, pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0, moved: false }
let lastPlanetTrigger: HTMLElement | null = null
let albumClickSuppressedUntil = 0
let artistClickSuppressedUntil = 0
let songClickSuppressedUntil = 0
let albumPanFrame = 0
let artistPanFrame = 0
let songPanFrame = 0
let pendingAlbumPan: SpatialPan | null = null
let pendingArtistPan: SpatialPan | null = null
let pendingSongPan: SpatialPan | null = null
let spatialResizeObserver: ResizeObserver | null = null
let albumResolveTaskId = 0
let artistResolveTaskId = 0
let albumResolveTimer: ReturnType<typeof setTimeout> | null = null
let artistResolveTimer: ReturnType<typeof setTimeout> | null = null
let groupWarmupTimer: ReturnType<typeof setTimeout> | null = null
let albumDetailCloseTimer: ReturnType<typeof setTimeout> | null = null
let planetOpenFrame = 0

const resolveLocalView = (view: unknown): LocalView => {
  if (view == 'tracks') return 'tracks'
  if (view == 'artists') return 'artists'
  return 'albums'
}

const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())
const hasKeyword = computed(() => !!normalizedKeyword.value)
const albumViewStyle = computed(() => appSetting['localMusic.albumViewStyle'])
const artistViewStyle = computed(() => appSetting['localMusic.artistViewStyle'])

const trackSearchItems = computed<LocalTrackSearchItem[]>(() => {
  return tracks.value.map((track, index) => ({
    id: `${track.id}_${index}`,
    track,
    index,
    searchText: [
      track.name,
      track.singer,
      track.meta.albumName,
      track.meta.filePath,
    ].filter(Boolean).join('\n').toLowerCase(),
  }))
})

const filteredTrackItems = computed<LocalTrackItem[]>(() => {
  const keyword = normalizedKeyword.value
  if (!keyword) return trackSearchItems.value
  return trackSearchItems.value.filter(item => item.searchText.includes(keyword))
})

const filteredTracks = computed(() => filteredTrackItems.value.map(item => item.track))
const albums = computed(() => {
  return hasKeyword.value ? buildLocalAlbumGroups(filteredTracks.value) : defaultAlbumGroups.value
})
const artists = computed(() => {
  return hasKeyword.value ? buildLocalArtistGroups(filteredTracks.value) : defaultArtistGroups.value
})
const visibleAlbums = computed(() => albums.value.slice(0, visibleAlbumCount.value))
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
const wrapArtistIndex = (index: number) => {
  const length = artists.value.length
  if (!length) return 0
  return (index + length) % length
}
const carouselArtists = computed(() => {
  const length = artists.value.length
  if (!length) return []
  const offsets = length >= 7
    ? [-3, -2, -1, 0, 1, 2, 3]
    : Array.from({ length }, (_, index) => index - Math.floor(length / 2))

  return offsets.map(offset => {
    const artist = artists.value[wrapArtistIndex(activeArtistIndex.value + offset)]
    return {
      ...artist,
      offset,
      slot: offset == 0
        ? 'centerSlide'
        : offset < 0
          ? `leftSlide${Math.abs(offset)}`
          : `rightSlide${offset}`,
    }
  })
})
const resolveSpatialMetrics = (kind: SpatialCanvasKind, viewport: SpatialViewport): SpatialMetrics => {
  const compact = viewport.width < 820 || viewport.height < 520
  const visibilityBuffer = Math.min(420, Math.max(compact ? 280 : 340, Math.min(viewport.width, viewport.height) * 0.55))
  if (kind != 'songs') {
    return compact
      ? { spacingX: 148, spacingY: 172, visibilityBuffer }
      : { spacingX: 176, spacingY: 202, visibilityBuffer }
  }
  return compact
    ? { spacingX: 132, spacingY: 154, visibilityBuffer }
    : { spacingX: 150, spacingY: 174, visibilityBuffer }
}
const albumSpatialMetrics = computed(() => resolveSpatialMetrics('albums', albumPlanetViewport.value))
const artistSpatialMetrics = computed(() => resolveSpatialMetrics('artists', artistPlanetViewport.value))
const songSpatialMetrics = computed(() => resolveSpatialMetrics('songs', songPlanetViewport.value))
const albumSpatialPoints = computed(() => buildSpatialHexLayout(
  albums.value.length,
  albumSpatialMetrics.value.spacingX,
  albumSpatialMetrics.value.spacingY,
))
const artistSpatialPoints = computed(() => buildSpatialHexLayout(
  artists.value.length,
  artistSpatialMetrics.value.spacingX,
  artistSpatialMetrics.value.spacingY,
))
const songSpatialPoints = computed(() => buildSpatialHexLayout(
  selectedAlbumItems.value.length,
  songSpatialMetrics.value.spacingX,
  songSpatialMetrics.value.spacingY,
))
const getSpatialBucketSize = (metrics: SpatialMetrics) => Math.max(metrics.spacingX, metrics.spacingY) * 2
const albumSpatialIndex = computed(() => buildSpatialIndex(
  albumSpatialPoints.value,
  getSpatialBucketSize(albumSpatialMetrics.value),
))
const artistSpatialIndex = computed(() => buildSpatialIndex(
  artistSpatialPoints.value,
  getSpatialBucketSize(artistSpatialMetrics.value),
))
const songSpatialIndex = computed(() => buildSpatialIndex(
  songSpatialPoints.value,
  getSpatialBucketSize(songSpatialMetrics.value),
))
const getSpatialItemStyle = (
  point: SpatialPoint,
  pan: SpatialPan,
  viewport: SpatialViewport,
  metrics: SpatialMetrics,
  index: number,
  kind: SpatialCanvasKind,
) => {
  const frame = resolveSpatialFrame(point, pan, viewport, {
    peakScale: kind == 'songs' ? 1.08 : 1.12,
    minScale: kind == 'songs' ? 0.5 : 0.48,
    minOpacity: 0.58,
    viewportBuffer: kind == 'songs' ? 92 : 102,
    visibilityBuffer: metrics.visibilityBuffer,
  })
  return {
    frame,
    style: {
      transform: `translate3d(calc(-50% + ${frame.x.toFixed(2)}px), calc(-50% + ${frame.y.toFixed(2)}px), 0) scale(${frame.scale.toFixed(4)})`,
      zIndex: frame.zIndex,
      '--spatial-opacity': frame.opacity.toFixed(3),
      '--planet-delay': `${Math.min(index, 12) * 18}ms`,
    },
  }
}
const albumPlanetEntries = computed(() => {
  if (selectedAlbum.value && selectedAlbumDetailStyle.value == 'planet') return []
  return querySpatialIndex(
    albumSpatialIndex.value,
    albumPlanetPan.value,
    albumPlanetViewport.value,
    albumSpatialMetrics.value.visibilityBuffer,
  ).flatMap(point => {
    const index = point.index
    const album = albums.value[index]
    if (!album) return []
    const { frame, style } = getSpatialItemStyle(
      point,
      albumPlanetPan.value,
      albumPlanetViewport.value,
      albumSpatialMetrics.value,
      index,
      'albums',
    )
    return frame.visible ? [{ album, index, style, distance: frame.distance, inViewport: frame.inViewport }] : []
  })
    .sort((a, b) => Number(b.inViewport) - Number(a.inViewport) || a.distance - b.distance)
    .slice(0, MAX_MOUNTED_SPATIAL_PLANETS)
    .sort((a, b) => a.index - b.index)
})
const artistPlanetEntries = computed(() => querySpatialIndex(
  artistSpatialIndex.value,
  artistPlanetPan.value,
  artistPlanetViewport.value,
  artistSpatialMetrics.value.visibilityBuffer,
).flatMap(point => {
  const index = point.index
  const artist = artists.value[index]
  if (!artist) return []
  const { frame, style } = getSpatialItemStyle(
    point,
    artistPlanetPan.value,
    artistPlanetViewport.value,
    artistSpatialMetrics.value,
    index,
    'artists',
  )
  return frame.visible ? [{ artist, index, style, distance: frame.distance, inViewport: frame.inViewport }] : []
})
  .sort((a, b) => Number(b.inViewport) - Number(a.inViewport) || a.distance - b.distance)
  .slice(0, MAX_MOUNTED_SPATIAL_PLANETS)
  .sort((a, b) => a.index - b.index))
const songPlanetEntries = computed(() => querySpatialIndex(
  songSpatialIndex.value,
  songPlanetPan.value,
  songPlanetViewport.value,
  songSpatialMetrics.value.visibilityBuffer,
).flatMap(point => {
  const index = point.index
  const item = selectedAlbumItems.value[index]
  if (!item) return []
  const { frame, style } = getSpatialItemStyle(
    point,
    songPlanetPan.value,
    songPlanetViewport.value,
    songSpatialMetrics.value,
    index,
    'songs',
  )
  return frame.visible ? [{ item, index, style, distance: frame.distance, inViewport: frame.inViewport }] : []
})
  .sort((a, b) => Number(b.inViewport) - Number(a.inViewport) || a.distance - b.distance)
  .slice(0, MAX_MOUNTED_SPATIAL_PLANETS)
  .sort((a, b) => a.index - b.index))
const albumCoverGroups = computed(() => {
  if (albumViewStyle.value == 'waterfall') return visibleAlbums.value
  if (albumViewStyle.value == 'carousel') return carouselAlbums.value
  return [...albumPlanetEntries.value]
    .sort((a, b) => Number(b.inViewport) - Number(a.inViewport) || a.distance - b.distance)
    .map(entry => entry.album)
})
const artistCoverGroups = computed(() => {
  if (artistViewStyle.value == 'waterfall') return visibleArtists.value
  if (artistViewStyle.value == 'carousel') return carouselArtists.value
  return [...artistPlanetEntries.value]
    .sort((a, b) => Number(b.inViewport) - Number(a.inViewport) || a.distance - b.distance)
    .map(entry => entry.artist)
})
const planetPortalStyle = computed<Record<string, string>>(() => ({
  '--planet-origin-top': `${planetPortalOrigin.value.top}px`,
  '--planet-origin-right': `${planetPortalOrigin.value.right}px`,
  '--planet-origin-bottom': `${planetPortalOrigin.value.bottom}px`,
  '--planet-origin-left': `${planetPortalOrigin.value.left}px`,
}))

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

const readSpatialViewport = (element: HTMLElement | null, current: SpatialViewport): SpatialViewport => {
  if (!element) return current
  const width = Math.max(1, element.clientWidth)
  const height = Math.max(1, element.clientHeight)
  return current.width == width && current.height == height ? current : { width, height }
}

const syncSpatialViewportSizes = () => {
  albumPlanetViewport.value = readSpatialViewport(planetStageRef.value, albumPlanetViewport.value)
  artistPlanetViewport.value = readSpatialViewport(artistPlanetStageRef.value, artistPlanetViewport.value)
  songPlanetViewport.value = readSpatialViewport(songPlanetViewportRef.value, songPlanetViewport.value)
}

const observeSpatialStages = async() => {
  await nextTick()
  spatialResizeObserver?.disconnect()
  if (planetStageRef.value) spatialResizeObserver?.observe(planetStageRef.value)
  if (artistPlanetStageRef.value) spatialResizeObserver?.observe(artistPlanetStageRef.value)
  if (songPlanetViewportRef.value) spatialResizeObserver?.observe(songPlanetViewportRef.value)
  syncSpatialViewportSizes()
}

const increaseVisibleGroups = (type: 'albums' | 'artists') => {
  const groups = type == 'albums' ? albums.value : artists.value
  const visibleCount = type == 'albums' ? visibleAlbumCount : visibleArtistCount
  if (visibleCount.value >= groups.length) return false
  visibleCount.value = Math.min(groups.length, visibleCount.value + GRID_BATCH_SIZE)
  return true
}

const ensureVisibleGroups = async(type: 'albums' | 'artists') => {
  await nextTick()
  const viewStyle = type == 'albums' ? albumViewStyle.value : artistViewStyle.value
  if (viewStyle == 'planet') {
    syncSpatialViewportSizes()
    return
  }
  if (viewStyle != 'waterfall') return

  const container = type == 'albums' ? albumGridRef.value : artistGridRef.value
  if (!container) return
  while (container.scrollHeight <= container.clientHeight + GRID_LOAD_OFFSET && increaseVisibleGroups(type)) {
    await nextTick()
  }
}

const handleGridScroll = (type: 'albums' | 'artists') => {
  const viewStyle = type == 'albums' ? albumViewStyle.value : artistViewStyle.value
  if (viewStyle != 'waterfall') return
  const container = type == 'albums' ? albumGridRef.value : artistGridRef.value
  if (!container) return
  if (container.scrollTop + container.clientHeight < container.scrollHeight - GRID_LOAD_OFFSET) return
  if (!increaseVisibleGroups(type)) return
  void ensureVisibleGroups(type)
}

const getSpatialDragState = (kind: SpatialCanvasKind) => {
  if (kind == 'albums') return albumDragState
  if (kind == 'artists') return artistDragState
  return songDragState
}

const applyPendingSpatialPan = (kind: SpatialCanvasKind) => {
  if (kind == 'albums') {
    albumPanFrame = 0
    if (!pendingAlbumPan) return
    albumPlanetPan.value = pendingAlbumPan
    pendingAlbumPan = null
    return
  }
  if (kind == 'artists') {
    artistPanFrame = 0
    if (!pendingArtistPan) return
    artistPlanetPan.value = pendingArtistPan
    pendingArtistPan = null
    return
  }
  songPanFrame = 0
  if (!pendingSongPan) return
  songPlanetPan.value = pendingSongPan
  pendingSongPan = null
}

const scheduleSpatialPan = (kind: SpatialCanvasKind, pan: SpatialPan) => {
  if (kind == 'albums') {
    pendingAlbumPan = pan
    if (!albumPanFrame) {
      albumPanFrame = requestAnimationFrame(() => {
        applyPendingSpatialPan(kind)
      })
    }
    return
  }
  if (kind == 'artists') {
    pendingArtistPan = pan
    if (!artistPanFrame) {
      artistPanFrame = requestAnimationFrame(() => {
        applyPendingSpatialPan(kind)
      })
    }
    return
  }
  pendingSongPan = pan
  if (!songPanFrame) {
    songPanFrame = requestAnimationFrame(() => {
      applyPendingSpatialPan(kind)
    })
  }
}

const getPendingSpatialPan = (kind: SpatialCanvasKind) => {
  if (kind == 'albums') return pendingAlbumPan ?? albumPlanetPan.value
  if (kind == 'artists') return pendingArtistPan ?? artistPlanetPan.value
  return pendingSongPan ?? songPlanetPan.value
}

const startSpatialDrag = (kind: SpatialCanvasKind, event: PointerEvent) => {
  if (event.button != 0) return
  const dragState = getSpatialDragState(kind)
  const pan = getPendingSpatialPan(kind)
  dragState.active = true
  dragState.pointerId = event.pointerId
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.originX = pan.x
  dragState.originY = pan.y
  dragState.moved = false
}

const moveSpatialDrag = (kind: SpatialCanvasKind, event: PointerEvent) => {
  const dragState = getSpatialDragState(kind)
  if (!dragState.active || dragState.pointerId != event.pointerId) return
  const deltaX = event.clientX - dragState.startX
  const deltaY = event.clientY - dragState.startY
  if (!dragState.moved && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
    dragState.moved = true
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    if (kind == 'albums') albumPlanetDragging.value = true
    else if (kind == 'artists') artistPlanetDragging.value = true
    else songPlanetDragging.value = true
  }
  if (!dragState.moved) return
  event.preventDefault()
  scheduleSpatialPan(kind, {
    x: dragState.originX + deltaX,
    y: dragState.originY + deltaY,
  })
}

const endSpatialDrag = (kind: SpatialCanvasKind, event: PointerEvent) => {
  const dragState = getSpatialDragState(kind)
  if (!dragState.active || dragState.pointerId != event.pointerId) return
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  if (dragState.moved) {
    if (kind == 'albums') albumClickSuppressedUntil = performance.now() + 220
    else if (kind == 'artists') artistClickSuppressedUntil = performance.now() + 220
    else songClickSuppressedUntil = performance.now() + 220
  }
  dragState.active = false
  dragState.pointerId = -1
  if (kind == 'albums') albumPlanetDragging.value = false
  else if (kind == 'artists') artistPlanetDragging.value = false
  else songPlanetDragging.value = false
}

const handleSpatialWheel = (kind: SpatialCanvasKind, event: WheelEvent) => {
  event.preventDefault()
  const viewport = kind == 'albums'
    ? albumPlanetViewport.value
    : kind == 'artists'
      ? artistPlanetViewport.value
      : songPlanetViewport.value
  const pan = getPendingSpatialPan(kind)
  const deltaUnit = event.deltaMode == 1 ? 28 : event.deltaMode == 2 ? Math.max(viewport.height, 1) : 1
  const useShiftAxis = event.shiftKey && Math.abs(event.deltaX) < 1
  const deltaX = (useShiftAxis ? event.deltaY : event.deltaX) * deltaUnit
  const deltaY = (useShiftAxis ? 0 : event.deltaY) * deltaUnit
  scheduleSpatialPan(kind, {
    x: pan.x - deltaX,
    y: pan.y - deltaY,
  })
}

const handlePlanetAlbumClick = (album: LocalMusicGroup, event: MouseEvent) => {
  if (performance.now() < albumClickSuppressedUntil) return
  openPlanetAlbum(album, event)
}

const handlePlanetArtistClick = (artist: LocalMusicGroup) => {
  if (performance.now() < artistClickSuppressedUntil) return
  openDetail('artists', artist.key)
}

const handleSongPlanetClick = (track: LX.Music.MusicInfoLocal) => {
  if (performance.now() < songClickSuppressedUntil) return
  playTrack(track)
}

const prevAlbum = () => {
  activeAlbumIndex.value = wrapAlbumIndex(activeAlbumIndex.value - 1)
}

const nextAlbum = () => {
  activeAlbumIndex.value = wrapAlbumIndex(activeAlbumIndex.value + 1)
}

const prevArtist = () => {
  activeArtistIndex.value = wrapArtistIndex(activeArtistIndex.value - 1)
}

const nextArtist = () => {
  activeArtistIndex.value = wrapArtistIndex(activeArtistIndex.value + 1)
}

const handleAlbumWheel = (event: Event) => {
  if (albumViewStyle.value != 'carousel' || selectedAlbum.value) return
  const wheelEvent = event as WheelEvent
  wheelEvent.preventDefault()
  wheelEvent.deltaY > 0 || wheelEvent.deltaX > 0 ? nextAlbum() : prevAlbum()
}

const handleArtistWheel = (event: Event) => {
  if (artistViewStyle.value != 'carousel') return
  const wheelEvent = event as WheelEvent
  wheelEvent.preventDefault()
  wheelEvent.deltaY > 0 || wheelEvent.deltaX > 0 ? nextArtist() : prevArtist()
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
  selectedAlbumDetailStyle.value = 'carousel'
  selectedAlbum.value = album
  selectedAlbumCoverCache.value = albumCovers.value[album.key] || album.cover || getCachedLocalGroupCover('albums', album.key) || ''
  albumDetailVisible.value = false
  void nextTick(() => {
    albumDetailVisible.value = true
  })
}

const handleArtistSlideClick = (artist: { offset: number, key: string }) => {
  if (artist.offset == 0) {
    openDetail('artists', artist.key)
    return
  }
  activeArtistIndex.value = wrapArtistIndex(activeArtistIndex.value + artist.offset)
}

const clearSelectedAlbum = (delay: number, onCleared?: () => void) => {
  if (albumDetailCloseTimer) clearTimeout(albumDetailCloseTimer)
  albumDetailCloseTimer = setTimeout(() => {
    selectedAlbum.value = null
    selectedAlbumCoverCache.value = ''
    albumDetailCloseTimer = null
    onCleared?.()
  }, delay)
}

const closeCarouselAlbum = () => {
  if (!selectedAlbum.value || selectedAlbumDetailStyle.value != 'carousel' || !albumDetailVisible.value) return
  albumDetailVisible.value = false
  clearSelectedAlbum(appSetting['common.isShowAnimation'] ? 320 : 0)
}

const cancelPlanetOpenFrame = () => {
  if (!planetOpenFrame) return
  cancelAnimationFrame(planetOpenFrame)
  planetOpenFrame = 0
}

const revealPlanetAlbum = () => {
  cancelPlanetOpenFrame()
  if (!appSetting['common.isShowAnimation']) {
    albumDetailVisible.value = true
    return
  }
  planetOpenFrame = requestAnimationFrame(() => {
    planetOpenFrame = requestAnimationFrame(() => {
      planetOpenFrame = 0
      if (!selectedAlbum.value || selectedAlbumDetailStyle.value != 'planet') return
      albumDetailVisible.value = true
    })
  })
}

const openPlanetAlbum = (album: LocalMusicGroup, event: MouseEvent) => {
  const contentCard = contentCardRef.value
  const trigger = event.currentTarget as HTMLElement | null
  if (!contentCard || !trigger) return
  if (albumDetailCloseTimer) {
    clearTimeout(albumDetailCloseTimer)
    albumDetailCloseTimer = null
  }
  const contentRect = contentCard.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  planetPortalOrigin.value = {
    top: Math.max(0, triggerRect.top - contentRect.top),
    right: Math.max(0, contentRect.right - triggerRect.right),
    bottom: Math.max(0, contentRect.bottom - triggerRect.bottom),
    left: Math.max(0, triggerRect.left - contentRect.left),
  }
  lastPlanetTrigger = trigger
  selectedAlbumDetailStyle.value = 'planet'
  selectedAlbum.value = album
  selectedAlbumCoverCache.value = albumCovers.value[album.key] || album.cover || getCachedLocalGroupCover('albums', album.key) || ''
  albumDetailVisible.value = false
  songPlanetPan.value = { x: 0, y: 0 }
  void nextTick(() => {
    void observeSpatialStages()
    revealPlanetAlbum()
  })
}

const closePlanetAlbum = () => {
  if (!selectedAlbum.value || selectedAlbumDetailStyle.value != 'planet' || !albumDetailVisible.value) return
  cancelPlanetOpenFrame()
  albumDetailVisible.value = false
  clearSelectedAlbum(appSetting['common.isShowAnimation'] ? 460 : 0, () => {
    void nextTick(() => lastPlanetTrigger?.focus())
  })
}

const closeAlbumDetail = () => {
  if (selectedAlbumDetailStyle.value == 'planet') closePlanetAlbum()
  else closeCarouselAlbum()
}

const handleAlbumBackdropClick = () => {
  closeCarouselAlbum()
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
  }, type == 'albums' ? 12 : 48)

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

const handlePlanetKeydown = (event: KeyboardEvent) => {
  if (event.key != 'Escape' || selectedAlbumDetailStyle.value != 'planet' || !selectedAlbum.value) return
  event.preventDefault()
  closePlanetAlbum()
}

onMounted(() => {
  if (typeof ResizeObserver != 'undefined') spatialResizeObserver = new ResizeObserver(syncSpatialViewportSizes)
  void init()
  void observeSpatialStages()
  window.addEventListener('keydown', handlePlanetKeydown)
  window.addEventListener('resize', syncSpatialViewportSizes)
})

onBeforeUnmount(() => {
  if (albumResolveTimer) clearTimeout(albumResolveTimer)
  if (artistResolveTimer) clearTimeout(artistResolveTimer)
  if (groupWarmupTimer) clearTimeout(groupWarmupTimer)
  if (albumDetailCloseTimer) clearTimeout(albumDetailCloseTimer)
  cancelPlanetOpenFrame()
  if (albumPanFrame) cancelAnimationFrame(albumPanFrame)
  if (artistPanFrame) cancelAnimationFrame(artistPanFrame)
  if (songPanFrame) cancelAnimationFrame(songPanFrame)
  spatialResizeObserver?.disconnect()
  window.removeEventListener('keydown', handlePlanetKeydown)
  window.removeEventListener('resize', syncSpatialViewportSizes)
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
  void observeSpatialStages()
  if (view == 'albums' || view == 'artists') void ensureVisibleGroups(view)
})

watch(albumViewStyle, () => {
  closeAlbumDetail()
  visibleAlbumCount.value = Math.min(GRID_BATCH_SIZE, albums.value.length)
  albumPlanetPan.value = { x: 0, y: 0 }
  void observeSpatialStages()
  if (normalizedView.value == 'albums') void ensureVisibleGroups('albums')
})

watch(artistViewStyle, () => {
  visibleArtistCount.value = Math.min(GRID_BATCH_SIZE, artists.value.length)
  artistPlanetPan.value = { x: 0, y: 0 }
  void observeSpatialStages()
  if (normalizedView.value == 'artists') void ensureVisibleGroups('artists')
})

watch(albums, groups => {
  visibleAlbumCount.value = Math.min(GRID_BATCH_SIZE, groups.length)
  activeAlbumIndex.value = Math.min(activeAlbumIndex.value, Math.max(groups.length - 1, 0))
  albumPlanetPan.value = { x: 0, y: 0 }
  if (selectedAlbum.value && !groups.some(group => group.key == selectedAlbum.value?.key)) closeAlbumDetail()
  void observeSpatialStages()
  if (normalizedView.value == 'albums') void ensureVisibleGroups('albums')
}, { immediate: true })

watch(artists, groups => {
  visibleArtistCount.value = Math.min(GRID_BATCH_SIZE, groups.length)
  activeArtistIndex.value = Math.min(activeArtistIndex.value, Math.max(groups.length - 1, 0))
  artistPlanetPan.value = { x: 0, y: 0 }
  void observeSpatialStages()
  if (normalizedView.value == 'artists') void ensureVisibleGroups('artists')
}, { immediate: true })

watch([normalizedView, albumCoverGroups], ([view, groups]) => {
  if (view != 'albums') return
  if (selectedAlbum.value && selectedAlbumDetailStyle.value == 'planet') return
  scheduleResolveGroupCovers('albums', groups, albumCovers)
}, { immediate: true })

watch([normalizedView, artistCoverGroups], ([view, groups]) => {
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
.artistViewShell {
  flex: auto;
  min-height: 0;
}

.listShell {
  display: flex;
  flex-flow: column nowrap;
}

.gridShell,
.artistViewShell {
  padding-top: 4px;
}

.gridShell,
.artistViewShell {
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

.waterfallGridShell {
  display: block;
  padding: 4px 6px 36px;
  overflow: auto;
  background: transparent;
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

.planetGridShell {
  padding: 0;
  align-items: stretch;
  background:
    radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--color-primary) 13%, transparent), transparent 34%),
    radial-gradient(circle at 16% 20%, rgba(255, 255, 255, .3), transparent 22%),
    linear-gradient(180deg, rgba(255, 255, 255, .08), transparent 62%);
}

.planetStage {
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
  outline: none;

  &:focus-visible {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 65%, transparent);
  }
}

.planetAlbumCluster,
.songPlanetCluster,
.spatialLayer {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.planetAlbum,
.songPlanet {
  --spatial-opacity: 1;
  --planet-delay: 0ms;
  position: absolute;
  left: 0;
  top: 0;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  opacity: var(--spatial-opacity);
  transform-origin: center;
  transition: opacity .16s ease;
  will-change: transform, opacity;
  contain: layout style;

  &:focus-visible {
    outline: none;

    .spatialCardBody {
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--color-primary) 74%, white),
        0 18px 44px rgba(18, 27, 44, .22);
    }
  }
}

.planetAlbum {
  width: 148px;
  height: 190px;
}

.songPlanet {
  width: 130px;
  height: 170px;
  opacity: 0;

  .spatialCardBody {
    opacity: 0;
    transform: translateY(42px) scale(.68);
  }
}

.spatialCardBody {
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  padding: 6px 6px 8px;
  border: 1px solid var(--shell-control-border, rgba(127, 145, 170, .2));
  border-radius: 17px;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--shell-card-strong, rgba(255, 255, 255, .9)) 94%, transparent);
  box-shadow: 0 15px 38px rgba(24, 36, 54, .15);
  backdrop-filter: blur(16px) saturate(135%);
  transform-origin: center;
  transition:
    opacity .3s ease,
    transform .28s cubic-bezier(.16, 1, .3, 1),
    box-shadow .22s ease,
    border-color .22s ease;
}

.planetAlbum:hover,
.songPlanet:hover {
  .spatialCardBody {
    transform: translateY(-5px) scale(1.035);
    border-color: color-mix(in srgb, var(--color-primary) 42%, transparent);
    box-shadow:
      0 22px 48px color-mix(in srgb, var(--color-primary) 17%, transparent),
      0 14px 30px rgba(24, 36, 54, .18);
  }
}

.planetAlbum:active,
.songPlanet:active {
  .spatialCardBody {
    transform: translateY(-1px) scale(.98);
  }
}

.planetAlbumHalo,
.songPlanetHalo {
  display: block;
  flex: none;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary) 12%, rgba(255, 255, 255, .26));
  box-shadow: 0 7px 18px rgba(18, 27, 44, .17);
}

.planetAlbumCover,
.songPlanetCover {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 0;
  border-radius: inherit;
  background: var(--shell-card-strong, rgba(255, 255, 255, .88));
  box-sizing: border-box;

  img,
  > span {
    display: block;
    width: 100%;
    height: 100%;
  }

  img {
    object-fit: cover;
  }
}

.planetAlbumLabel,
.songPlanetLabel {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0 2px;
  box-sizing: border-box;
  text-align: left;
  pointer-events: none;

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 11px;
    line-height: 1.3;
  }

  small {
    margin-top: 1px;
    color: var(--shell-muted, var(--color-font-label));
    font-size: 9px;
  }
}

.spatialDragging {
  cursor: grabbing;

  .planetAlbum,
  .songPlanet {
    transition: none;
  }

  .spatialCardBody {
    pointer-events: none;
  }
}

.planetPortal {
  --planet-frame: rgba(252, 252, 250, .97);
  --planet-inner: rgba(241, 245, 249, .96);
  --planet-surface-inset: 24px;
  position: absolute;
  inset: 0;
  z-index: 90;
  overflow: hidden;
  clip-path: inset(
    var(--planet-origin-top)
    var(--planet-origin-right)
    var(--planet-origin-bottom)
    var(--planet-origin-left)
    round 24px
  );
  background: var(--planet-frame);
  box-shadow: 0 24px 70px rgba(17, 25, 38, .24);
  opacity: .9;
  pointer-events: none;
  cursor: pointer;
  transition:
    clip-path .46s cubic-bezier(.16, 1, .3, 1),
    opacity .22s ease,
    box-shadow .32s ease;
  will-change: clip-path;

  &.detailOpen {
    clip-path: inset(8px round 26px);
    opacity: 1;
    pointer-events: auto;

    .planetPortalSurface {
      opacity: 1;
      transform: scale(1);
    }

    .planetHeroCover {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .planetDetailMeta {
      opacity: 1;
      transform: translateY(0);
    }

    .songPlanet {
      opacity: var(--spatial-opacity);
      transition-delay: var(--planet-delay);

      .spatialCardBody {
        opacity: 1;
        transform: translateY(0) scale(1);
        transition-delay: var(--planet-delay);
      }
    }
  }

  &:hover {
    .planetPortalSurface {
      inset: calc(var(--planet-surface-inset) + 8px);
    }
  }

  &.reduceMotion {
    transition-duration: .01ms;

    .planetPortalSurface,
    .planetHeroCover,
    .planetDetailMeta,
    .songPlanet {
      transition-duration: .01ms;
      transition-delay: 0ms;
    }
  }
}

.planetPortalSurface {
  position: absolute;
  inset: var(--planet-surface-inset);
  display: flex;
  flex-flow: column nowrap;
  min-height: 0;
  overflow: hidden;
  border-radius: 20px;
  background:
    radial-gradient(circle at 50% 36%, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 30%),
    radial-gradient(ellipse at 50% 78%, rgba(255, 255, 255, .54), transparent 50%),
    var(--planet-inner);
  opacity: .34;
  transform: scale(.94);
  transition:
    inset .18s ease,
    opacity .32s ease,
    transform .42s cubic-bezier(.16, 1, .3, 1);

  &:hover {
    inset: var(--planet-surface-inset) !important;
  }
}

.planetEdgeCue {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: color-mix(in srgb, var(--shell-muted, var(--color-font-label)) 66%, transparent);
  opacity: .72;
  pointer-events: none;

  svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
}

.edgeCueTop,
.edgeCueBottom {
  left: 50%;
}

.edgeCueLeft,
.edgeCueRight {
  top: 50%;
}

.edgeCueTop {
  top: 9px;
  transform: translateX(-50%) rotate(90deg);
}

.edgeCueRight {
  right: 9px;
  transform: translateY(-50%) rotate(180deg);
}

.edgeCueBottom {
  bottom: 9px;
  transform: translateX(-50%) rotate(-90deg);
}

.edgeCueLeft {
  left: 9px;
  transform: translateY(-50%);
}

.planetDetailHeader {
  position: relative;
  z-index: 2;
  flex: none;
  min-height: 118px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 22px 96px 8px;
  box-sizing: border-box;
  pointer-events: none;
}

.planetHeroCover {
  flex: none;
  width: 82px;
  height: 82px;
  overflow: hidden;
  border: 4px solid var(--planet-frame);
  border-radius: 22px;
  background: color-mix(in srgb, var(--color-primary) 20%, var(--planet-inner));
  box-shadow: 0 16px 34px rgba(17, 25, 38, .2);
  opacity: 0;
  transform: translateY(-86px) scale(.72);
  transition: opacity .24s ease, transform .46s cubic-bezier(.18, .86, .24, 1.12);

  img,
  div {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.planetDetailMeta {
  min-width: 0;
  max-width: 520px;
  display: flex;
  flex-flow: column nowrap;
  gap: 3px;
  opacity: 0;
  transform: translateY(-14px);
  transition: opacity .24s .12s ease, transform .34s .1s cubic-bezier(.16, 1, .3, 1);

  > span {
    color: var(--color-primary);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .12em;
  }

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--shell-text, var(--color-font));
    font-size: clamp(20px, 3vw, 34px);
    line-height: 1.16;
  }

  small {
    color: var(--shell-muted, var(--color-font-label));
    font-size: 12px;
  }
}

.songPlanetViewport {
  position: relative;
  flex: auto;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
  outline: none;

  &:focus-visible {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 65%, transparent);
  }
}

.songPlanetHalo {
  border-radius: 10px;
}

.songPlanetCover {
  border-width: 0;
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

.waterfallGrid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px 16px;
  align-content: start;
  align-items: start;
  grid-auto-flow: row;
  grid-auto-rows: min-content;
}

.albumSlide,
.groupCard {
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

.groupCard:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(28, 44, 68, 0.08);
  background: var(--shell-card-strong, rgba(255, 255, 255, 0.62));
}

.groupCard:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--color-primary) 72%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 24%, transparent);
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
.artistCover,
.albumWaterfallCover {
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

.artistCarouselCover {
  border-radius: 32px;
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

.albumWaterfallCard {
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
}

.albumWaterfallCover {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(24, 36, 54, .13);
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

.artistPlanetHalo {
  border-radius: 30px;
}

.albumMeta,
.artistMeta,
.groupMeta {
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

.groupMeta {
  align-self: center;
  width: 100%;
  box-sizing: border-box;
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
  .waterfallGrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .gridShell,
  .artistViewShell {
    padding-inline: 34px;
  }

  .waterfallGridShell {
    padding-inline: 4px;
  }

  .planetGridShell {
    padding-inline: 0;
  }

  .planetAlbum {
    width: 132px;
    height: 172px;
  }

  .songPlanet {
    width: 120px;
    height: 158px;
  }

  .planetDetailHeader {
    justify-content: flex-start;
    padding: 18px 28px 6px;
  }

  .planetHeroCover {
    width: 68px;
    height: 68px;
    border-radius: 18px;
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

  .waterfallGrid {
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

  .gridShell,
  .artistViewShell {
    background:
      linear-gradient(180deg, transparent 0 58%, rgba(255, 255, 255, .035) 72%, transparent 100%),
      radial-gradient(ellipse at center 78%, rgba(255, 255, 255, .11), transparent 58%);
  }

  .waterfallGridShell {
    background: transparent;
  }

  .planetGridShell {
    background:
      radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 35%),
      radial-gradient(circle at 16% 20%, rgba(255, 255, 255, .05), transparent 22%),
      linear-gradient(180deg, rgba(255, 255, 255, .025), transparent 62%);
  }

  .planetPortal {
    --planet-frame: rgba(3, 4, 6, .98);
    --planet-inner: rgba(13, 15, 19, .98);
    box-shadow: 0 28px 78px rgba(0, 0, 0, .52);
  }

  .planetPortalSurface {
    background:
      radial-gradient(circle at 50% 36%, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 31%),
      radial-gradient(ellipse at 50% 80%, rgba(255, 255, 255, .035), transparent 52%),
      var(--planet-inner);
  }

  .spatialCardBody {
    background: rgba(20, 22, 27, .94);
    border-color: rgba(255, 255, 255, .09);
    box-shadow: 0 16px 34px rgba(0, 0, 0, .38);
  }

  .planetAlbumHalo,
  .songPlanetHalo {
    background: color-mix(in srgb, var(--color-primary) 13%, rgba(255, 255, 255, .045));
    box-shadow: 0 9px 24px rgba(0, 0, 0, .42);
  }

  .planetAlbumCover,
  .songPlanetCover {
    border-color: rgba(8, 9, 12, .92);
    background: rgba(18, 20, 24, .96);
    box-shadow: 0 9px 22px rgba(0, 0, 0, .48);
  }

  .groupCard,
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

.reduceMotion {
  .planetAlbum,
  .spatialCardBody {
    animation: none !important;
  }

  .planetAlbum,
  .songPlanet,
  .planetPortal,
  .planetPortalSurface,
  .planetHeroCover,
  .planetDetailMeta {
    transition-duration: .01ms !important;
    transition-delay: 0ms !important;
  }

  .spatialCardBody {
    transition-duration: .01ms !important;
    transition-delay: 0ms !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .planetAlbum,
  .spatialCardBody {
    animation: none !important;
  }

  .planetAlbum,
  .songPlanet,
  .planetPortal,
  .planetPortalSurface,
  .planetHeroCover,
  .planetDetailMeta {
    transition-duration: .01ms !important;
    transition-delay: 0ms !important;
  }

  .spatialCardBody {
    transition-duration: .01ms !important;
    transition-delay: 0ms !important;
  }
}
</style>
