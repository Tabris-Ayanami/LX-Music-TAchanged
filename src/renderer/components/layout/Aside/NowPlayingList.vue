<template>
  <section :class="[$style.queue, { [$style.collapsed]: isSidebarCollapsed }]">
    <p :class="$style.title" :aria-hidden="isSidebarCollapsed">LIST</p>
    <div ref="listRef" :class="['scroll', $style.list]" @wheel.stop @scroll.passive="handleListScroll">
      <span
        v-show="queuePillVisible"
        :class="[$style.queuePill, { [$style.floating]: queuePillFloating, [$style.tracking]: queuePillTracking }]"
        :style="queuePillStyle"
        aria-hidden="true"
      >
        <LiquidGlassLayer
          variant="capsule"
          active
          interactive
          :highlight="false"
          :displacement-scale="queuePillFloating ? 28 : 22"
          :blur-amount="queuePillFloating ? 1.15 : .95"
          corner-radius="inherit"
        />
      </span>
      <button
        v-for="item in queueList"
        :key="item.id + '_' + item.index"
        type="button"
        :data-queue-index="item.index"
        :class="[$style.row, { [$style.active]: item.index == currentQueueIndex }]"
        @click="handlePlay(item.index)"
        @mouseenter="handleQueueItemEnter(item.index)"
        @focus="handleQueueItemEnter(item.index)"
        @mouseleave="handleQueueLeave"
        @blur="handleQueueLeave"
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
import { isBiliRuntimePicUrl } from '@common/utils/tools'
import { getPicPath } from '@renderer/core/music'
import { playList } from '@renderer/core/player'
import { getList } from '@renderer/store/player/action'
import { playInfo } from '@renderer/store/player/state'
import { isSidebarCollapsed } from '@renderer/store/ui'
import LiquidGlassLayer from '@renderer/components/common/liquidGlass/LiquidGlassLayer.vue'

const listRef = ref(null)
const queueList = ref([])
const loadingPicIds = new Set()
const failedPicIds = new Set()
let picRequestId = 0
let loadPicFrame = 0

const LOCAL_PIC_BATCH_SIZE = 12
const LOCAL_PIC_OVERSCAN = 8
const LOCAL_PIC_ROW_HEIGHT = 55

const normalizePicUrl = pic => {
  if (!pic || /^(?:https?:|data:|blob:|file:)/i.test(pic)) return pic || ''
  return `file:///${encodePath(pic)}`
}

const getMusicPic = musicInfo => {
  const pic = musicInfo?.pic || musicInfo?.meta?.picUrl || musicInfo?.img || ''
  if (musicInfo?.source == 'bili') return ''
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
    if (queueItem.musicInfo?.meta && queueItem.musicInfo.source != 'bili' && !isBiliRuntimePicUrl(picUrl)) {
      queueItem.musicInfo.meta.picUrl = picUrl
    }
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
const queueHoverIndex = ref(-1)
const queuePillVisible = ref(false)
const queuePillTracking = ref(false)
const queuePillRect = ref({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
})
let queuePillMeasureFrame = 0
let queuePillTrackTimer = 0
let queuePillMeasurePending = false
let queuePillMeasureNeedsTracking = false
let isUnmounted = false

const sidebarMotionMs = 460
const queuePillInset = 2

const getCssPxNumber = (el, property, fallback) => {
  const value = Number.parseFloat(getComputedStyle(el).getPropertyValue(property))
  return Number.isFinite(value) ? value : fallback
}

const getSidebarContentTargetWidth = el => Math.max(
  0,
  getCssPxNumber(el, '--sidebar-width', isSidebarCollapsed.value ? 80 : 196) - getCssPxNumber(el, '--sidebar-panel-x', 16) * 2,
)

const currentQueuePillIndex = computed(() => queueHoverIndex.value > -1 ? queueHoverIndex.value : currentQueueIndex.value)
const queuePillFloating = computed(() => queueHoverIndex.value > -1 && queueHoverIndex.value != currentQueueIndex.value)
const queuePillStyle = computed(() => ({
  width: `${queuePillRect.value.width}px`,
  height: `${queuePillRect.value.height}px`,
  transform: `translate3d(${queuePillRect.value.x}px, ${queuePillRect.value.y}px, 0)`,
}))

const measureQueuePillToIndex = index => {
  const listEl = listRef.value
  if (!listEl || index < 0) {
    queuePillVisible.value = false
    return
  }

  const rowEl = listEl.querySelector(`[data-queue-index="${index}"]`)
  if (!rowEl) {
    queuePillVisible.value = false
    return
  }

  const inlineInset = queuePillInset
  const blockInset = queuePillInset
  const measuredHeight = Math.max(0, rowEl.offsetHeight - blockInset * 2)
  const targetWidth = Math.max(0, getSidebarContentTargetWidth(listEl) - inlineInset * 2)
  const width = isSidebarCollapsed.value ? Math.min(targetWidth, measuredHeight) : targetWidth
  const height = measuredHeight
  queuePillRect.value = {
    x: rowEl.offsetLeft + inlineInset,
    y: rowEl.offsetTop + blockInset,
    width,
    height,
  }
  queuePillVisible.value = true
}

const measureCurrentQueuePill = () => {
  measureQueuePillToIndex(currentQueuePillIndex.value)
}

const trackQueuePillDuringLayoutMotion = () => {
  queuePillTracking.value = true
  if (queuePillTrackTimer) clearTimeout(queuePillTrackTimer)
  queuePillTrackTimer = setTimeout(() => {
    queuePillTrackTimer = 0
    queuePillTracking.value = false
    measureCurrentQueuePill()
  }, sidebarMotionMs + 80)
}

const scheduleQueuePillUpdate = (trackLayoutMotion = false) => {
  if (isUnmounted) return
  queuePillMeasureNeedsTracking = queuePillMeasureNeedsTracking || trackLayoutMotion
  if (queuePillMeasurePending) return
  if (queuePillMeasureFrame) cancelAnimationFrame(queuePillMeasureFrame)
  queuePillMeasurePending = true
  void nextTick(() => {
    queuePillMeasurePending = false
    if (isUnmounted) return
    const shouldTrackLayoutMotion = queuePillMeasureNeedsTracking
    queuePillMeasureNeedsTracking = false
    queuePillMeasureFrame = requestAnimationFrame(() => {
      queuePillMeasureFrame = 0
      if (isUnmounted) return
      measureCurrentQueuePill()
      if (shouldTrackLayoutMotion) trackQueuePillDuringLayoutMotion()
    })
  })
}

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

const handleQueueItemEnter = index => {
  queueHoverIndex.value = index
  scheduleQueuePillUpdate()
}

const handleQueueLeave = () => {
  queueHoverIndex.value = -1
  scheduleQueuePillUpdate()
}

const handleQueueListUpdate = ids => {
  if (!currentListId.value || !ids.includes(currentListId.value)) return
  syncQueueList()
}

watch(() => playInfo.playerListId, () => {
  queueHoverIndex.value = -1
  syncQueueList()
  scrollToListTop('auto')
  scheduleQueuePillUpdate(true)
}, {
  immediate: true,
})

watch(() => playInfo.playerPlayIndex, () => {
  scrollToCurrentTop('smooth')
  scheduleQueuePillUpdate()
})

watch(queueList, () => {
  scheduleQueuePillUpdate(true)
})

watch(isSidebarCollapsed, () => {
  queueHoverIndex.value = -1
  scheduleQueuePillUpdate(true)
})

onMounted(() => {
  scheduleQueuePillUpdate(true)
  window.app_event.on('myListUpdate', handleQueueListUpdate)
})

onBeforeUnmount(() => {
  isUnmounted = true
  picRequestId++
  if (loadPicFrame) cancelAnimationFrame(loadPicFrame)
  if (queuePillMeasureFrame) cancelAnimationFrame(queuePillMeasureFrame)
  if (queuePillTrackTimer) clearTimeout(queuePillTrackTimer)
  loadingPicIds.clear()
  failedPicIds.clear()
  window.app_event.off('myListUpdate', handleQueueListUpdate)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.queue {
  -webkit-app-region: no-drag;
  --sidebar-queue-rail: 48px;
  --sidebar-queue-row-height: 48px;
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
  margin: 0;
  padding: 0 5px;
  height: 14px;
  min-height: 14px;
  line-height: 14px;
  font-size: 9px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(86, 100, 120, 0.56);
  overflow: hidden;
  transition: opacity .28s ease;
}

.list {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1 1 auto;
  min-height: 0;
  margin: 6px -4px 0;
  padding: 0 4px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.queuePill {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  border-radius: var(--sidebar-queue-radius);
  corner-shape: squircle;
  pointer-events: none;
  will-change: transform, width;
  overflow: hidden;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 82%, #fff 18%), color-mix(in srgb, var(--color-primary) 60%, #2c5fc7 40%));
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 56%, rgba(255, 255, 255, .34)),
    inset 0 1px 0 rgba(255, 255, 255, .24),
    inset 0 -1px 0 rgba(0, 0, 0, .12);
  transition:
    transform var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    box-shadow 220ms ease;
}

.queuePill.floating {
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 62%, rgba(255, 255, 255, .38)),
    inset 0 1px 0 rgba(255, 255, 255, .26),
    inset 0 -1px 0 rgba(0, 0, 0, .12);
}

.queuePill.tracking {
  transition:
    transform var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    box-shadow 220ms ease;
}

.row {
  position: relative;
  isolation: isolate;
  z-index: 1;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: var(--sidebar-queue-row-height);
  min-height: var(--sidebar-queue-row-height);
  flex: 0 0 var(--sidebar-queue-row-height);
  padding: 0 6px 0 0;
  box-sizing: border-box;
  border: none;
  border-radius: 10px;
  display: grid;
  grid-template-columns: var(--sidebar-queue-rail) minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  background: transparent;
  color: var(--shell-text, var(--color-font));
  cursor: pointer;
  text-align: left;
  transition:
    width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    max-width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    padding var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    background-color @transition-fast,
    color @transition-fast,
    text-shadow @transition-fast,
    transform @transition-fast;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: rgba(255, 255, 255, .12);
    opacity: 0;
    transform: scale(.96);
    transition: opacity @transition-fast, transform @transition-fast;
    pointer-events: none;
  }

  &:hover {
    color: #fff;
    text-shadow: 0 1px 1px rgba(0, 0, 0, .28);
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
  justify-self: center;
  width: var(--sidebar-queue-cover);
  height: var(--sidebar-queue-cover);
  min-width: var(--sidebar-queue-cover);
  min-height: var(--sidebar-queue-cover);
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
  opacity: 1;

  .title {
    opacity: 0;
  }

  .row {
    width: var(--sidebar-queue-rail);
    max-width: var(--sidebar-queue-rail);
    height: var(--sidebar-queue-row-height);
    min-height: var(--sidebar-queue-row-height);
    flex-basis: var(--sidebar-queue-row-height);
    padding: 0;
    grid-template-columns: var(--sidebar-queue-rail) minmax(0, 0);
    gap: 0;
    border-radius: var(--sidebar-queue-radius);
    overflow: visible;
    justify-items: center;
    background: transparent;
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
