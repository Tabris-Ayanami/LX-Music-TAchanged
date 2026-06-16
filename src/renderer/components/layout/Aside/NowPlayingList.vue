<template>
  <section :class="[$style.queue, { [$style.collapsed]: isSidebarCollapsed }]">
    <p :class="$style.title" :aria-hidden="isSidebarCollapsed">LIST</p>
    <div ref="listRef" :class="['scroll', $style.list]" @wheel.stop>
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
import { getPicPath } from '@renderer/core/music'
import { playList } from '@renderer/core/player'
import { getList } from '@renderer/store/player/action'
import { playInfo } from '@renderer/store/player/state'
import { isSidebarCollapsed } from '@renderer/store/ui'

const listRef = ref(null)
const queueList = ref([])
const loadingPicIds = new Set()
let picRequestId = 0

const getMusicPic = musicInfo => {
  return musicInfo?.pic || musicInfo?.meta?.picUrl || musicInfo?.img || ''
}

const getQueueMusicInfo = item => {
  return 'progress' in item ? item.metadata.musicInfo : item
}

const applyQueuePic = (item, pic, requestId) => {
  if (!pic || requestId != picRequestId) return
  for (const queueItem of queueList.value) {
    if (queueItem.id != item.id || queueItem.index != item.index) continue
    queueItem.pic = pic
    break
  }
}

const loadMissingLocalPics = () => {
  const requestId = ++picRequestId
  const targets = queueList.value.filter(item => {
    return !item.pic && item.musicInfo?.source == 'local' && item.musicInfo.meta?.filePath && !loadingPicIds.has(item.id)
  }).slice(0, 24)
  if (!targets.length) return

  for (const item of targets) {
    loadingPicIds.add(item.id)
    void getPicPath({
      musicInfo: item.musicInfo,
      listId: currentListId.value,
      isRefresh: false,
    }).then(pic => {
      applyQueuePic(item, pic, requestId)
    }).catch(() => {}).finally(() => {
      loadingPicIds.delete(item.id)
    })
  }
}

const syncQueueList = () => {
  const listId = playInfo.playerListId
  if (!listId) {
    queueList.value = []
    return
  }
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
  loadMissingLocalPics()
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
    transform @transition-fast;

  &:hover {
    background: rgba(255, 255, 255, 0.42);
  }

  &:active {
    transform: scale(.985);
  }
}

.active {
  background: rgba(126, 136, 152, 0.22);
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
  }
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
