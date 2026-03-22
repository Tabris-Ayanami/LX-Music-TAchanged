<template>
  <div :class="$style.page">
    <section :class="$style.headerCard">
      <div :class="$style.coverFrame">
        <img v-if="detailCover" :src="detailCover" :alt="detailGroup?.name || 'cover'" decoding="async">
        <div v-else :class="$style.coverFallback">{{ detailGroup?.initial || '?' }}</div>
      </div>
      <div :class="$style.headerMeta">
        <span :class="$style.eyebrow">{{ detailTypeLabel }}</span>
        <h1 :class="$style.title">{{ detailGroup?.name || '本地音乐' }}</h1>
        <p :class="$style.desc">{{ detailDescription }}</p>
      </div>
      <div :class="$style.headerActions">
        <button type="button" :class="[$style.actionBtn, $style.primary]" :disabled="!detailGroup" @click="playFirstTrack">
          播放第一首
        </button>
        <button type="button" :class="$style.actionBtn" @click="goBack">
          返回
        </button>
      </div>
    </section>

    <section :class="$style.listCard">
      <div :class="$style.tableHead">
        <span :class="[$style.cell, $style.numCell]">#</span>
        <span :class="[$style.cell, $style.nameCell]">歌曲名</span>
        <span :class="[$style.cell, $style.singerCell]">艺术家</span>
        <span :class="[$style.cell, $style.albumCell]">专辑名</span>
        <span :class="[$style.cell, $style.timeCell]">时长</span>
      </div>

      <div v-if="detailItems.length" :class="$style.tableBody">
        <button
          v-for="(item, rowIndex) in detailItems"
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

      <div v-else :class="$style.emptyState">
        这个分类下暂时还没有歌曲。
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { playList } from '@renderer/core/player'
import { getPicPath } from '@renderer/core/music'
import { getListMusics } from '@renderer/store/list/action'
import {
  buildLocalAlbumGroups,
  buildLocalArtistGroups,
  ensureLocalMusicList,
  getCachedLocalGroupCover,
  getCachedLocalTracks,
  setCachedLocalTracks,
  setCachedLocalGroupCover,
} from '@renderer/utils/localMusic'

const route = useRoute()
const router = useRouter()
const localListId = ref('')
const tracks = ref<LX.Music.MusicInfoLocal[]>([])
const detailCover = ref('')

const detailType = computed(() => route.query.type == 'artists' ? 'artists' : 'albums')
const detailKey = computed(() => typeof route.query.key == 'string' ? route.query.key : '')
const detailTypeLabel = computed(() => detailType.value == 'artists' ? '艺术家详情' : '专辑详情')

const groups = computed(() => detailType.value == 'artists'
  ? buildLocalArtistGroups(tracks.value)
  : buildLocalAlbumGroups(tracks.value))

const detailGroup = computed(() => groups.value.find(item => item.key == detailKey.value) ?? null)
const detailItems = computed(() => detailGroup.value?.items ?? [])

const detailDescription = computed(() => {
  if (!detailGroup.value) return '从左侧返回本地音乐重新选择。'
  if (detailType.value == 'artists') {
    return `${detailGroup.value.subtitle} · 共 ${detailGroup.value.count} 首歌曲`
  }
  return `${detailGroup.value.singer} · 共 ${detailGroup.value.count} 首歌曲`
})

const init = async() => {
  const list = await ensureLocalMusicList()
  localListId.value = list.id
  const cachedTracks = getCachedLocalTracks()
  if (cachedTracks.length) tracks.value = cachedTracks
  tracks.value = await getListMusics(list.id) as LX.Music.MusicInfoLocal[]
  setCachedLocalTracks(tracks.value)
}

onMounted(() => {
  void init()
})

watch([detailGroup, localListId], ([group, listId]) => {
  if (!group || !listId) {
    detailCover.value = ''
    return
  }

  void (async() => {
    const cachedCover = getCachedLocalGroupCover(detailType.value, group.key)
    if (group.cover || cachedCover) {
      detailCover.value = group.cover || cachedCover
      return
    }
    try {
      const cover = await getPicPath({
        musicInfo: group.sourceTrack,
        listId,
        isRefresh: false,
      })
      detailCover.value = cover
      if (cover) setCachedLocalGroupCover(detailType.value, group.key, cover)
    } catch {
      detailCover.value = ''
    }
  })()
}, { immediate: true })

const goBack = () => {
  void router.push({
    path: '/local',
    query: {
      view: detailType.value,
    },
  })
}

const playTrack = (index: number) => {
  if (!localListId.value || index < 0) return
  playList(localListId.value, index)
}

const playFirstTrack = () => {
  if (!detailGroup.value) return
  playTrack(detailGroup.value.firstIndex)
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
}

.headerCard,
.listCard {
  border-radius: 14px;
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.18));
  background: var(--shell-surface, rgba(255, 255, 255, 0.62));
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 28px rgba(32, 50, 80, 0.06);
}

.headerCard {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.coverFrame {
  flex: none;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);

  img,
  div {
    width: 100%;
    height: 100%;
  }

  img {
    display: block;
    object-fit: cover;
  }
}

.coverFallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 34px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 72%, white 28%));
}

.headerMeta {
  flex: auto;
  min-width: 0;
}

.eyebrow {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--shell-muted, var(--color-font-label));
}

.title {
  margin: 0;
  font-size: 28px;
  line-height: 1.1;
  .mixin-ellipsis-1();
}

.desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--shell-muted, var(--color-font-label));
  .mixin-ellipsis-2();
}

.headerActions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.actionBtn {
  border: 1px solid var(--shell-stroke, rgba(255, 255, 255, 0.2));
  background: rgba(255, 255, 255, 0.08);
  color: var(--shell-text, var(--color-font));
  border-radius: 10px;
  padding: 0 14px;
  min-width: 98px;
  height: 36px;
  cursor: pointer;
}

.primary {
  background: linear-gradient(135deg, var(--shell-accent, var(--color-primary)), color-mix(in srgb, var(--shell-accent, var(--color-primary)) 70%, white 30%));
  border-color: transparent;
  color: #fff;
}

.listCard {
  flex: auto;
  min-height: 0;
  padding: 10px 0 0;
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
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
    background: rgba(255, 255, 255, 0.16);
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
  flex: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-muted, var(--color-font-label));
}
</style>
