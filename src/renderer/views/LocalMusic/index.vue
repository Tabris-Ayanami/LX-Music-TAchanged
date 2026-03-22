<template>
  <div ref="pageRef" :class="$style.page">
    <section :class="$style.headerRow">
      <h1 :class="$style.pageTitle">本地音乐</h1>
      <div :class="$style.headerActions">
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
      <div :class="$style.contentHead">
        <div :class="$style.headText">
          <span :class="$style.sectionLabel">{{ currentViewLabel }}</span>
          <strong :class="$style.sectionTitle">{{ summaryText }}</strong>
        </div>
        <span :class="$style.sectionHint">{{ sectionHint }}</span>
      </div>

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
        <span v-if="hasKeyword" :class="$style.searchResult">
          {{ searchResultText }}
        </span>
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
          <div v-if="filteredTrackItems.length" :class="$style.tableBody">
            <button
              v-for="(item, rowIndex) in filteredTrackItems"
              :key="item.track.id"
              type="button"
              :class="$style.row"
              @click="playTrack(item.index)"
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
          <MusicList v-if="localListId" ref="musicList" :list-id="localListId" />
          <div v-else :class="$style.emptyState">正在准备本地曲库...</div>
        </template>
      </div>

      <div v-else-if="normalizedView == 'albums'" :class="$style.gridShell">
        <button
          v-for="album in albums"
          :key="album.key"
          type="button"
          :class="$style.albumCard"
          :title="album.name"
          @click="openDetail('albums', album.key)"
        >
          <div :class="$style.coverFrame">
            <img v-if="albumCovers[album.key]" :src="albumCovers[album.key]" :alt="album.name" decoding="async">
            <div v-else :class="$style.coverFallback">{{ album.initial }}</div>
          </div>
          <strong :class="$style.cardTitle">{{ album.name }}</strong>
          <span :class="$style.cardMeta">{{ album.singer }} · {{ album.count }} 首</span>
        </button>
        <div v-if="!albums.length" :class="$style.emptyState">
          {{ hasKeyword ? '没有匹配到本地专辑。' : '导入歌曲后会在这里生成专辑墙。' }}
        </div>
      </div>

      <div v-else :class="$style.artistShell">
        <button
          v-for="artist in artists"
          :key="artist.key"
          type="button"
          :class="$style.artistCard"
          :title="artist.name"
          @click="openDetail('artists', artist.key)"
        >
          <div :class="$style.artistCover">
            <img v-if="artistCovers[artist.key]" :src="artistCovers[artist.key]" :alt="artist.name" decoding="async">
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
import { computed, onMounted, ref, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { getPicPath } from '@renderer/core/music'
import { playList } from '@renderer/core/player'
import { getListMusics } from '@renderer/store/list/action'
import { fetchingListStatus } from '@renderer/store/list/state'
import {
  buildLocalAlbumGroups,
  buildLocalArtistGroups,
  ensureLocalMusicList,
  getCachedLocalGroupCover,
  getCachedLocalTracks,
  setCachedLocalGroupCover,
  setCachedLocalTracks,
} from '@renderer/utils/localMusic'
import { addLocalFile, addLocalFolder } from '@renderer/views/List/MyList/actions'
import MusicList from '@renderer/views/List/MusicList/index.vue'

interface LocalTrackItem {
  index: number
  track: LX.Music.MusicInfoLocal
}

const route = useRoute()
const router = useRouter()
const pageRef = ref<HTMLElement | null>(null)
const musicList = ref<any>(null)
const localListInfo = ref<any>(null)
const localListId = ref('')
const tracks = ref<LX.Music.MusicInfoLocal[]>([])
const albumCovers = ref<Record<string, string>>({})
const artistCovers = ref<Record<string, string>>({})
const keyword = ref('')

const views = {
  tracks: '曲库',
  albums: '专辑',
  artists: '音乐家',
} as const

const normalizedView = computed(() => {
  const view = typeof route.query.view == 'string' ? route.query.view : ''
  return view in views ? view as keyof typeof views : 'albums'
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
const albums = computed(() => buildLocalAlbumGroups(filteredTracks.value))
const artists = computed(() => buildLocalArtistGroups(filteredTracks.value))
const currentViewLabel = computed(() => views[normalizedView.value])
const summaryText = computed(() => {
  switch (normalizedView.value) {
    case 'tracks':
      return hasKeyword.value ? `${filteredTrackItems.value.length} 条搜索结果` : `${tracks.value.length} 首歌曲`
    case 'artists':
      return hasKeyword.value ? `${artists.value.length} 位匹配音乐家` : `${artists.value.length} 位音乐家`
    default:
      return hasKeyword.value ? `${albums.value.length} 张匹配专辑` : `${albums.value.length} 张专辑`
  }
})
const sectionHint = computed(() => {
  if (isBusy.value) return '正在处理导入内容...'
  if (hasKeyword.value) return '只搜索本地音乐，不会请求联网结果'
  switch (normalizedView.value) {
    case 'tracks':
      return '完整曲库列表'
    case 'artists':
      return '点击音乐家查看详情与歌曲列表'
    default:
      return '点击专辑进入详情页查看完整曲目'
  }
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
const searchResultText = computed(() => {
  switch (normalizedView.value) {
    case 'tracks':
      return `找到 ${filteredTrackItems.value.length} 首本地歌曲`
    case 'artists':
      return `找到 ${artists.value.length} 位音乐家`
    default:
      return `找到 ${albums.value.length} 张专辑`
  }
})

const refreshTracks = async() => {
  if (!localListId.value) return
  tracks.value = await getListMusics(localListId.value) as LX.Music.MusicInfoLocal[]
  setCachedLocalTracks(tracks.value)
}

const resolveGroupCovers = async(
  type: 'albums' | 'artists',
  groups: ReturnType<typeof buildLocalAlbumGroups>,
  target: typeof albumCovers,
) => {
  if (!localListId.value) return

  target.value = Object.fromEntries(groups.map(group => {
    const cachedCover = group.cover || getCachedLocalGroupCover(type, group.key)
    return [group.key, cachedCover]
  }).filter(([, cover]) => cover))

  const entries = await Promise.all(groups.map(async(group) => {
    const cachedCover = getCachedLocalGroupCover(type, group.key)
    if (group.cover || cachedCover) return [group.key, group.cover || cachedCover] as const
    try {
      const cover = await getPicPath({
        musicInfo: group.sourceTrack,
        listId: localListId.value,
        isRefresh: false,
      })
      if (cover) setCachedLocalGroupCover(type, group.key, cover)
      return [group.key, cover || ''] as const
    } catch {
      return [group.key, ''] as const
    }
  }))

  target.value = Object.fromEntries(entries.filter(([, cover]) => cover))
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

watch(albums, groups => {
  void resolveGroupCovers('albums', groups, albumCovers)
}, { immediate: true })

watch(artists, groups => {
  void resolveGroupCovers('artists', groups, artistCovers)
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

const playTrack = (index: number) => {
  if (!localListId.value || index < 0) return
  playList(localListId.value, index)
}

const isBusy = computed(() => localListId.value ? !!fetchingListStatus[localListId.value] : false)
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
  flex: auto;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  padding: 14px;
  gap: 12px;
}

.contentHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.headText {
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
}

.sectionLabel {
  font-size: 11px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--shell-muted, var(--color-font-label));
}

.sectionTitle {
  font-size: 20px;
  line-height: 1.15;
}

.sectionHint {
  font-size: 12px;
  color: var(--shell-muted, var(--color-font-label));
}

.searchRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.searchBox {
  flex: 1 1 320px;
  min-width: 240px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 12px;
  border-radius: 10px;
  border: 1px solid var(--shell-search-border, rgba(255, 255, 255, 0.22));
  background: var(--shell-search-surface, rgba(255, 255, 255, 0.5));
  backdrop-filter: blur(16px);
  -webkit-app-region: no-drag;

  input {
    flex: 1 1 auto;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--shell-text, var(--color-font));
    font-size: 13px;

    &::placeholder {
      color: var(--shell-muted, var(--color-font-label));
    }
  }
}

.searchIcon {
  flex: none;
  color: var(--shell-muted, var(--color-font-label));

  svg {
    fill: currentColor;
  }
}

.clearBtn {
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-muted, var(--color-font-label));
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
}

.searchResult {
  font-size: 12px;
  color: var(--shell-muted, var(--color-font-label));
}

.listShell,
.gridShell,
.artistShell {
  flex: auto;
  min-height: 0;
  overflow: auto;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
}

.gridShell {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 14px;
  padding: 2px;
}

.artistShell {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  padding: 2px;
}

.tableHead,
.row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1.8fr) minmax(0, 1.2fr) minmax(0, 1.2fr) 86px;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
}

.tableHead {
  height: 40px;
  border-bottom: 1px solid rgba(140, 170, 210, 0.14);
  color: var(--shell-muted, var(--color-font-label));
  font-size: 12px;
}

.tableBody {
  min-height: 0;
}

.row {
  width: 100%;
  height: 50px;
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

.albumCard,
.artistCard {
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.2));
  border-radius: 12px;
  background: var(--shell-surface-soft, rgba(255, 255, 255, 0.7));
  color: inherit;
  cursor: pointer;
  transition: @transition-fast;
  transition-property: transform, opacity, background-color;

  &:hover {
    opacity: .9;
    transform: translateY(-1px);
  }
}

.albumCard {
  padding: 10px;
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
  text-align: left;
}

.artistCard {
  min-height: 88px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.coverFrame,
.artistCover {
  overflow: hidden;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);

  img,
  span,
  div {
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
  flex: none;
  width: 56px;
  height: 56px;
}

.coverFallback,
.artistInitial {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 72%, white 28%));
}

.coverFallback {
  font-size: 32px;
}

.artistInitial {
  font-size: 18px;
}

.artistMeta {
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
}

.cardTitle {
  font-size: 14px;
  line-height: 1.25;
  .mixin-ellipsis-1();
}

.cardMeta {
  font-size: 12px;
  color: var(--shell-muted, var(--color-font-label));
  .mixin-ellipsis-1();
}

.emptyState {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--shell-muted, var(--color-font-label));
  text-align: center;
}
</style>
