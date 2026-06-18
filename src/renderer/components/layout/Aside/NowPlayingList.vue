<template>
  <section :class="[$style.queue, { [$style.collapsed]: isSidebarCollapsed }]">
    <p :class="$style.title" :aria-hidden="isSidebarCollapsed">LIST</p>
    <div ref="listRef" :class="['scroll', $style.list]" @wheel.stop @scroll.passive="handleListScroll">
      <button
        v-for="item in queueList"
        :key="item.id + '_' + item.index"
        type="button"
        :data-queue-index="item.index"
        :class="[$style.row, { [$style.active]: item.index == currentQueueIndex }]"
        @click="handlePlay(item.index)"
      >
        <span :class="$style.coverWrap">
          <img v-if="item.pic" :class="$style.cover" :src="item.pic" loading="lazy" alt="">
          <span v-else :class="$style.coverFallback">{{ item.index + 1 }}</span>
        </span>
        <span :class="$style.meta">
          <strong>{{ item.name || '-' }}</strong>
          <span>{{ item.singer || '未知歌手' }}</span>
        </span>
      </button>
      <div v-if="!queueList.length" :class="$style.empty">暂无播放</div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { encodePath } from '@common/utils/common'
import { getPicPath } from '@renderer/core/music'
import { playList } from '@renderer/core/player'
import { getList } from '@renderer/store/player/action'
import { playInfo } from '@renderer/store/player/state'
import { isSidebarCollapsed } from '@renderer/store/ui'

const listRef = ref(null)
const queueList = ref([])
const loadingPicIds = new Set()
const failedPicIds = new Set()
let picRequestId = 0
let loadPicFrame = 0

const LOCAL_PIC_BATCH_SIZE = 12
const LOCAL_PIC_OVERSCAN = 8
const LOCAL_PIC_ROW_HEIGHT = 49

const normalizePicUrl = pic => {
  if (!pic || /^(?:https?:|data:|blob:|file:)/i.test(pic)) return pic || ''
  return `file:///${encodePath(pic)}`
}

const isBiliProxyPic = pic => /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/bili\/image\?/i.test(pic)

const getMusicPic = musicInfo => {
  const pic = musicInfo?.pic || musicInfo?.meta?.picUrl || musicInfo?.img || ''
  if (musicInfo?.source == 'bili' && pic && !isBiliProxyPic(pic)) return ''
  return normalizePicUrl(pic)
}

const getQueueMusicInfo = item => {
  return 'progress' in item ? item.metadata.musicInfo : item
}

const getQueueItemKey = item => `${item.id}_${item.index}`

const isMissingLazyPic = item => {
  const itemKey = getQueueItemKey(item)
  if (item.pic || loadingPicIds.has(itemKey) || failedPicIds.has(itemKey)) return false
  if (item.musicInfo?.source == 'local') return !!item.musicInfo.meta?.filePath
  return item.musicInfo?.source == 'bili' && !!item.musicInfo.meta?.bvid
}

const applyQueuePic = (item, pic, requestId) => {
  if (!pic || requestId != picRequestId) return
  const picUrl = normalizePicUrl(pic)
  for (const queueItem of queueList.value) {
    if (queueItem.id != item.id || queueItem.index != item.index) continue
    queueItem.pic = picUrl
    if (queueItem.musicInfo?.meta) queueItem.musicInfo.meta.picUrl = picUrl
    break
  }
}

const getVisibleLocalPicTargets = () => {
  const listEl = listRef.value
  if (!listEl) return queueList.value.filter(isMissingLazyPic).slice(0, LOCAL_PIC_BATCH_SIZE)

  const firstIndex = Math.max(0, Math.floor(listEl.scrollTop / LOCAL_PIC_ROW_HEIGHT) - LOCAL_PIC_OVERSCAN)
  const visibleCount = Math.ceil(listEl.clientHeight / LOCAL_PIC_ROW_HEIGHT) + LOCAL_PIC_OVERSCAN * 2
  return queueList.value
    .slice(firstIndex, firstIndex + visibleCount)
    .filter(isMissingLazyPic)
    .slice(0, LOCAL_PIC_BATCH_SIZE)
}

const loadMissingLocalPics = () => {
  const requestId = picRequestId
  const targets = getVisibleLocalPicTargets()
  if (!targets.length) return

  for (const item of targets) {
    const itemKey = getQueueItemKey(item)
    loadingPicIds.add(itemKey)
    void getPicPath({
      musicInfo: item.musicInfo,
      listId: currentListId.value,
      isRefresh: false,
    }).then(pic => {
      if (requestId != picRequestId) return
      if (!pic) {
        failedPicIds.add(itemKey)
        return
      }
      applyQueuePic(item, pic, requestId)
    }).catch(() => {
      if (requestId == picRequestId) failedPicIds.add(itemKey)
    }).finally(() => {
      loadingPicIds.delete(itemKey)
      if (requestId == picRequestId) scheduleLoadMissingLocalPics()
    })
  }
}

const scheduleLoadMissingLocalPics = () => {
  if (loadPicFrame) return
  loadPicFrame = requestAnimationFrame(() => {
    loadPicFrame = 0
    loadMissingLocalPics()
  })
}

const syncQueueList = () => {
  const listId = playInfo.playerListId
  if (!listId) {
    picRequestId++
    loadingPicIds.clear()
    failedPicIds.clear()
    queueList.value = []
    return
  }
  picRequestId++
  loadingPicIds.clear()
  failedPicIds.clear()
  queueList.value = getList(listId).map((item, index) => {
    const musicInfo = getQueueMusicInfo(item)
    return {
      index,
      id: item.id,
      name: musicInfo.name,
      singer: musicInfo.singer,
      pic: getMusicPic(musicInfo),
      musicInfo,
    }
  })
  void nextTick(scheduleLoadMissingLocalPics)
}

const currentQueueIndex = computed(() => playInfo.playerPlayIndex)
const currentListId = computed(() => playInfo.playerListId)

const scrollToCurrentTop = behavior => {
  void nextTick(() => {
    const listEl = listRef.value
    if (!listEl) return

    const currentIndex = currentQueueIndex.value
    if (currentIndex < 0) {
      listEl.scrollTo?.({
        top: 0,
        behavior,
      })
      return
    }

    const currentRow = listEl.querySelector(`[data-queue-index="${currentIndex}"]`)
    if (!currentRow) return

    const targetTop = currentRow.getBoundingClientRect().top - listEl.getBoundingClientRect().top + listEl.scrollTop
    listEl.scrollTo?.({
      top: targetTop,
      behavior,
    })
  })
}

const scrollToListTop = behavior => {
  void nextTick(() => {
    listRef.value?.scrollTo?.({
      top: 0,
      behavior,
    })
  })
}

const handlePlay = index => {
  if (!currentListId.value) return
  playList(currentListId.value, index)
  scrollToCurrentTop('smooth')
}

const handleListScroll = () => {
  scheduleLoadMissingLocalPics()
}

const handleQueueListUpdate = ids => {
  if (!currentListId.value || !ids.includes(currentListId.value)) return
  syncQueueList()
}

watch(() => playInfo.playerListId, () => {
  syncQueueList()
  scrollToListTop('auto')
}, {
  immediate: true,
})

watch(() => playInfo.playerPlayIndex, () => {
  scrollToCurrentTop('smooth')
})

onMounted(() => {
  window.app_event.on('myListUpdate', handleQueueListUpdate)
})

onBeforeUnmount(() => {
  picRequestId++
  if (loadPicFrame) cancelAnimationFrame(loadPicFrame)
  loadingPicIds.clear()
  failedPicIds.clear()
  window.app_event.off('myListUpdate', handleQueueListUpdate)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.queue {
  -webkit-app-region: no-drag;
  --sidebar-queue-rail: var(--sidebar-icon-lane, 44px);
  --sidebar-queue-cover: 36px;
  --sidebar-queue-radius: 10px;
  --sidebar-motion-duration: .46s;
  --sidebar-motion-curve: cubic-bezier(.2, 0, 0, 1);
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  margin-top: 18px;
  padding-top: 0;
  overflow: hidden;
  display: flex;
  flex-flow: column nowrap;
  transition: opacity .28s ease, margin-top var(--sidebar-motion-duration) var(--sidebar-motion-curve), padding-top var(--sidebar-motion-duration) var(--sidebar-motion-curve);
}

.title {
  padding: 0 5px;
  height: 14px;
  min-height: 14px;
  line-height: 14px;
  font-size: 9px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(86, 100, 120, 0.56);
  overflow: hidden;
  transition: height var(--sidebar-motion-duration) var(--sidebar-motion-curve), margin var(--sidebar-motion-duration) var(--sidebar-motion-curve), opacity .28s ease;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 6px;
  padding-right: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.row {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-width: 0;
  height: 44px;
  padding: 4px 6px;
  box-sizing: border-box;
  border: none;
  border-radius: 10px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  background: transparent;
  color: var(--shell-text, var(--color-font));
  cursor: pointer;
  text-align: left;
  transition:
    width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    max-width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    height var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    padding var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    gap var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    background-color @transition-fast,
    color @transition-fast,
    text-shadow @transition-fast,
    transform @transition-fast;

  &::before {
    content: '';
    position: absolute;
    inset: 1px 2px;
    z-index: -1;
    border-radius: inherit;
    corner-shape: squircle;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 78%, #fff 22%), color-mix(in srgb, var(--color-primary) 58%, #2c5fc7 42%));
    box-shadow:
      0 12px 24px color-mix(in srgb, var(--color-primary) 20%, rgba(16, 26, 44, .16)),
      inset 0 1px 0 rgba(255, 255, 255, .18),
      inset 0 -1px 0 rgba(0, 0, 0, .12);
    opacity: 0;
    transform: scale(.96);
    transition:
      opacity 220ms ease,
      transform 260ms cubic-bezier(.2, .9, .22, 1.12),
      box-shadow 220ms ease;
    pointer-events: none;
  }

  &:hover {
    color: #fff;
    text-shadow: 0 1px 1px rgba(0, 0, 0, .28);

    &::before {
      opacity: .92;
      transform: scale(1);
    }
  }

  &:active {
    transform: scale(.985);
  }
}

.active {
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, .28);

  &::before {
    opacity: 1;
    transform: scale(1);
  }
}

.coverWrap {
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.72));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 18px rgba(35, 52, 78, 0.12);
  transition:
    width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    height var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    border-radius var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    box-shadow @transition-fast;
}

.cover {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.coverFallback {
  font-size: 11px;
  font-weight: 800;
  color: color-mix(in srgb, var(--color-primary) 78%, white);
}

.meta {
  min-width: 0;
  opacity: 1;
  transform: translateX(0);
  transition: max-width var(--sidebar-motion-duration) var(--sidebar-motion-curve), opacity .28s ease, transform var(--sidebar-motion-duration) var(--sidebar-motion-curve);

  strong,
  span {
    display: block;
    min-width: 0;
    .mixin-ellipsis-1();
  }

  strong {
    font-size: 12px;
    font-weight: 800;
    line-height: 1.25;
  }

  span {
    margin-top: 3px;
    font-size: 10px;
    line-height: 1.2;
    color: var(--shell-muted, rgba(65, 78, 96, 0.68));
    transition: color @transition-fast;
  }
}

.row:hover .meta span,
.active .meta span {
  color: rgba(255, 255, 255, .74);
}

.empty {
  padding: 14px 8px 16px;
  font-size: 11px;
  color: var(--shell-muted, rgba(65, 78, 96, 0.68));
}

.collapsed {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--shell-text, #182236) 10%, transparent);
  opacity: 1;

  .title {
    height: 0;
    margin: 0;
    opacity: 0;
  }

  .list {
    margin-top: -5px;
    padding-right: 0;
    gap: 7px;
  }

  .row {
    width: var(--sidebar-queue-rail);
    max-width: var(--sidebar-queue-rail);
    height: var(--sidebar-queue-rail);
    min-height: var(--sidebar-queue-rail);
    padding: 0;
    grid-template-columns: var(--sidebar-queue-rail) minmax(0, 0);
    gap: 0;
    border-radius: var(--sidebar-queue-radius);
    overflow: visible;
    justify-items: center;
    background: transparent;

    &::before {
      inset: 2px;
    }
  }

  .coverWrap {
    width: var(--sidebar-queue-cover);
    height: var(--sidebar-queue-cover);
    min-width: var(--sidebar-queue-cover);
    min-height: var(--sidebar-queue-cover);
    border-radius: var(--sidebar-queue-radius);
    box-shadow: none;
  }

  .meta {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    transform: translateX(-6px);
  }

  .empty {
    display: none;
  }
}
</style>
