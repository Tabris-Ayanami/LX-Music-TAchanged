<template>
  <div :class="$style.page" :style="detailThemeStyle">
    <section :class="$style.headerCard">
      <div :class="$style.coverGlow" />
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
        <button type="button" :class="[$style.iconBtn, $style.playBtn]" :disabled="!detailTracks.length" aria-label="Play" @click.stop.prevent="playFirstTrack">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-play" />
          </svg>
        </button>
        <button type="button" :class="[$style.iconBtn, $style.backBtn]" aria-label="Back" @click.stop.prevent="goBack">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" space="preserve">
            <use xlink:href="#icon-back" />
          </svg>
        </button>
        <button type="button" :class="[$style.actionBtn, $style.primary]" :disabled="!detailTracks.length" @click="playFirstTrack">
          播放第一首
        </button>
        <button type="button" :class="$style.actionBtn" @click="goBack">
          返回
        </button>
      </div>
    </section>

    <section :class="$style.listCard">
      <MusicList
        v-if="detailTracks.length && localListId"
        :key="`${detailType}:${detailKey}`"
        :list-id="localListId"
        :music-list="detailTracks"
        play-mode="single-temp"
        play-on-click
        :temp-list-id-prefix="`${LOCAL_MUSIC_LIST_ID}__${detailType}__${detailKey}`"
      />
      <div v-else :class="$style.emptyState">这个分类下暂时还没有歌曲。</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { getPicPath } from '@renderer/core/music'
import { getListMusics } from '@renderer/store/list/action'
import MusicList from '@renderer/views/List/MusicList/index.vue'
import {
  LOCAL_MUSIC_LIST_ID,
  buildLocalAlbumGroups,
  buildLocalArtistGroups,
  ensureLocalMusicList,
  getCachedLocalGroupCover,
  getCachedLocalTracks,
  playLocalTempTracks,
  setCachedLocalGroupCover,
  setCachedLocalTracks,
} from '@renderer/utils/localMusic'

const route = useRoute()
const router = useRouter()
const localListId = ref('')
const tracks = ref<LX.Music.MusicInfoLocal[]>([])
const detailCover = ref('')
const toCssUrl = (value: string) => `url("${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`

const detailType = computed(() => route.query.type == 'artists' ? 'artists' : 'albums')
const detailKey = computed(() => typeof route.query.key == 'string' ? route.query.key : '')
const detailTypeLabel = computed(() => detailType.value == 'artists' ? '音乐家详情' : '专辑详情')

const groups = computed(() => detailType.value == 'artists'
  ? buildLocalArtistGroups(tracks.value)
  : buildLocalAlbumGroups(tracks.value))

const detailGroup = computed(() => groups.value.find(item => item.key == detailKey.value) ?? null)
const detailItems = computed(() => detailGroup.value?.items ?? [])
const detailTracks = computed(() => detailItems.value.map(item => item.track))
const detailThemeStyle = computed(() => ({
  '--local-detail-cover': detailCover.value ? toCssUrl(detailCover.value) : 'none',
}))

const detailDescription = computed(() => {
  if (!detailGroup.value) return '从左侧返回本地音乐重新选择。'
  if (detailType.value == 'artists') return `${detailGroup.value.subtitle} · 共 ${detailGroup.value.count} 首歌曲`
  return `${detailGroup.value.singer} · 共 ${detailGroup.value.count} 首歌曲`
})

const refreshTracks = async() => {
  const list = await ensureLocalMusicList()
  localListId.value = list.id
  const cachedTracks = getCachedLocalTracks()
  if (cachedTracks.length) tracks.value = cachedTracks
  tracks.value = await getListMusics(list.id) as LX.Music.MusicInfoLocal[]
  setCachedLocalTracks(tracks.value)
}

const handleListUpdate = (ids: string[]) => {
  if (!localListId.value || !ids.includes(localListId.value)) return
  void refreshTracks()
}

onMounted(() => {
  window.app_event.on('myListUpdate', handleListUpdate)
  void refreshTracks()
})

onBeforeUnmount(() => {
  window.app_event.off('myListUpdate', handleListUpdate)
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

const playFirstTrack = () => {
  if (!detailTracks.value.length) return
  void playLocalTempTracks(`${LOCAL_MUSIC_LIST_ID}__${detailType.value}__${detailKey.value}`, detailTracks.value, 0, {
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
  gap: 0;
  padding: 0;
  color: var(--shell-text, var(--color-font));
  background: var(--color-content-background);
}

.headerCard {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  gap: 28px;
  min-height: 230px;
  padding: 28px 30px 26px;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, .34);
}

.coverGlow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
  &::before {
    content: '';
    position: absolute;
    inset: -46px -32px auto -32px;
    height: 320px;
    background-image: var(--local-detail-cover);
    background-position: center;
    background-size: cover;
    filter: blur(38px) saturate(150%);
    opacity: .62;
    transform: scale(1.08);
  }
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 22% 10%, rgba(255, 255, 255, .3), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, .36) 0%, color-mix(in srgb, var(--color-primary) 16%, rgba(255, 255, 255, .28)) 100%);
  }
}

.coverFrame {
  position: relative;
  z-index: 1;
  flex: none;
  width: 176px;
  height: 176px;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 46px rgba(0, 0, 0, .22);

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
  position: relative;
  z-index: 1;
  flex: auto;
  min-width: 0;
  align-self: center;
  padding: 2px 150px 28px 0;
}

.eyebrow {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .72);
}

.title {
  margin: 0;
  font-size: 48px;
  line-height: 1.14;
  color: rgba(255, 255, 255, .96);
  font-weight: 800;
  .mixin-ellipsis-1();
}

.desc {
  margin: 8px 0 0;
  max-width: 760px;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(255, 255, 255, .78);
  .mixin-ellipsis(3);
}

.headerActions {
  position: relative;
  z-index: 1;
  flex: none;
  display: flex;
  align-items: center;
  align-self: flex-end;
  gap: 12px;
  margin-left: -140px;
  padding-bottom: 2px;

  .actionBtn {
    display: none;
  }
}

.iconBtn {
  flex: none;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  color: var(--color-font);
  background: rgba(255, 255, 255, .34);
  box-shadow: 0 12px 28px rgba(0, 0, 0, .16), inset 0 0 0 1px rgba(255, 255, 255, .38);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  cursor: pointer;
  transition: transform .16s ease, background-color .16s ease, box-shadow .16s ease;
  svg {
    width: 24px;
    height: 24px;
    display: block;
    margin: auto;
    pointer-events: none;
  }
  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, .46);
  }
  &:active {
    transform: translateY(0) scale(.96);
  }
  &:disabled {
    opacity: .45;
    cursor: default;
    transform: none;
  }
}

.playBtn {
  width: 64px;
  height: 64px;
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 16px 34px color-mix(in srgb, var(--color-primary) 32%, transparent);
  svg {
    width: 30px;
    height: 30px;
    transform: translateX(2px);
  }
  &:hover {
    background: color-mix(in srgb, var(--color-primary) 86%, white 14%);
  }
}

.backBtn {
  svg {
    width: 26px;
    height: 26px;
  }
}

.listCard {
  flex: auto;
  min-height: 0;
  padding: 14px 20px 18px;
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
  background: var(--color-content-background);
}

.emptyState {
  flex: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--shell-muted, var(--color-font-label));
}
</style>
