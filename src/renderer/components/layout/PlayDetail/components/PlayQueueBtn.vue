<template>
  <div :class="$style.anchor">
    <button
      ref="triggerRef"
      type="button"
      :class="[$style.btn, { [$style.active]: isVisible }]"
      :aria-label="panelTitle"
      @click.stop="toggle"
    >
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-queue-modern" />
      </svg>
    </button>

    <teleport to="#root">
      <transition name="queue-drawer">
        <div v-if="isVisible" :class="$style.layer">
          <button :class="$style.backdrop" type="button" :aria-label="$t('close')" @click="hide" />
          <section ref="drawerRef" :class="[$style.drawer, $style[`${placement}Drawer`], $style[`${variant}Drawer`]]">
            <header :class="$style.header">
              <div :class="$style.headerText">
                <strong>{{ panelTitle }}</strong>
                <span>{{ queueSummary }}</span>
              </div>
              <div :class="$style.headerActions">
                <button type="button" :class="$style.headerBtn" :disabled="!canClearQueue" @click="handleClearQueue">
                  {{ $t('player__queue_clear') }}
                </button>
                <button type="button" :class="$style.headerBtn" :disabled="!canLocateCurrent" @click="handleLocateCurrent">
                  {{ $t('player__queue_locate_current') }}
                </button>
              </div>
            </header>

            <div :class="$style.listWrap">
              <div ref="listRef" :class="['scroll', $style.list]">
                <div
                  v-for="item in queueList"
                  :key="item.id + '_' + item.index"
                  :data-queue-index="item.index"
                  :class="[$style.itemRow, { [$style.activeItem]: currentQueueIndex == item.index }]"
                  @contextmenu.prevent="handleShowItemMenu($event, item)"
                >
                  <button
                    type="button"
                    :class="$style.itemMain"
                    @click="handlePlay(item.index)"
                  >
                    <span :class="$style.coverWrap">
                      <img v-if="item.pic" :class="$style.cover" :src="item.pic" loading="lazy" alt="">
                      <span v-else :class="$style.coverFallback">{{ item.index + 1 }}</span>
                      <span :class="$style.playBadge">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" space="preserve">
                          <use xlink:href="#icon-play" />
                        </svg>
                      </span>
                    </span>
                    <span :class="$style.meta">
                      <strong :class="$style.itemName">{{ item.name || '-' }}</strong>
                      <span :class="$style.itemSub">{{ item.singer || '未知歌手' }}</span>
                    </span>
                  </button>
                  <button
                    v-if="canEditQueue"
                    type="button"
                    :class="$style.removeBtn"
                    :aria-label="$t('player__queue_remove')"
                    @click.stop="handleRemove(item.id)"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
                      <use xlink:href="#icon-close" />
                    </svg>
                  </button>
                </div>
                <div v-if="!queueList.length" :class="$style.empty">{{ $t('player__queue_empty') }}</div>
              </div>
            </div>
            <base-menu v-model="isShowItemMenu" :menus="itemMenus" :xy="menuLocation" item-name="name" @menu-click="handleItemMenuClick" />
          </section>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { encodePath } from '@common/utils/common'
import { playList } from '@renderer/core/player'
import { dialog } from '@renderer/plugins/Dialog'
import { clearListMusics, overwriteListMusics, removeListMusics } from '@renderer/store/list/action'
import { getList } from '@renderer/store/player/action'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
import { getPicPath } from '@renderer/core/music'
import { toSerializableMusicInfo } from '@renderer/utils/musicInfo'

defineProps({
  placement: {
    type: String,
    default: 'left',
  },
  variant: {
    type: String,
    default: 'detail',
  },
})

const isVisible = ref(false)
const triggerRef = ref(null)
const drawerRef = ref(null)
const listRef = ref(null)
const queueList = ref([])
const isShowItemMenu = ref(false)
const menuLocation = ref({ x: 0, y: 0 })
const menuTarget = ref(null)
const loadingPicIds = new Set()
let picRequestId = 0

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

const loadMissingLocalPics = () => {
  const requestId = ++picRequestId
  const targets = queueList.value.filter(item => {
    if (item.pic || loadingPicIds.has(item.id)) return false
    if (item.musicInfo?.source == 'local') return !!item.musicInfo.meta?.filePath
    return item.musicInfo?.source == 'bili' && !!item.musicInfo.meta?.bvid
  }).slice(0, 80)
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
      interval: musicInfo.interval,
      pic: getMusicPic(musicInfo),
      musicInfo,
    }
  })
  if (isVisible.value) loadMissingLocalPics()
}

const panelTitle = computed(() => window.i18n.t('play_list'))
const queueSummary = computed(() => window.i18n.t('player__queue_count', { count: queueList.value.length }))
const currentQueueIndex = computed(() => playInfo.playerPlayIndex)
const currentListId = computed(() => playInfo.playerListId)
const canLocateCurrent = computed(() => currentQueueIndex.value > -1 && !!playMusicInfo.musicInfo && !!queueList.value.length)
const canEditQueue = computed(() => !!currentListId.value)
const canClearQueue = computed(() => canEditQueue.value && !!queueList.value.length)
const itemMenus = computed(() => [
  {
    name: window.i18n.t('list__play'),
    action: 'play',
  },
  {
    name: window.i18n.t('player__queue_remove'),
    action: 'remove',
    disabled: !canEditQueue.value,
  },
])

const scrollCurrentIntoView = behavior => {
  if (!canLocateCurrent.value) return
  void nextTick(() => {
    const item = listRef.value?.querySelector?.(`[data-queue-index="${currentQueueIndex.value}"]`)
    item?.scrollIntoView?.({
      block: 'center',
      behavior,
    })
  })
}

const hide = () => {
  isVisible.value = false
}

const toggle = () => {
  isVisible.value = !isVisible.value
}

const handlePlay = index => {
  if (!playInfo.playerListId) return
  playList(playInfo.playerListId, index)
  hide()
}

const handleLocateCurrent = () => {
  scrollCurrentIntoView('smooth')
}

const handleClearQueue = async() => {
  if (!canClearQueue.value || !currentListId.value) return
  const confirm = await dialog.confirm({
    message: window.i18n.t('player__queue_clear_confirm'),
    cancelButtonText: window.i18n.t('cancel_button_text'),
    confirmButtonText: window.i18n.t('confirm_button_text'),
  })
  if (!confirm) return
  const currentMusic = currentQueueIndex.value > -1 ? getList(currentListId.value)[currentQueueIndex.value] : null
  if (currentMusic && !('progress' in currentMusic)) {
    await overwriteListMusics({
      listId: currentListId.value,
      musicInfos: [toSerializableMusicInfo(currentMusic)],
    })
    return
  }
  await clearListMusics([currentListId.value])
}

const handleRemove = async(id) => {
  if (!canEditQueue.value || !currentListId.value) return
  await removeListMusics({
    listId: currentListId.value,
    ids: [id],
  })
}

const handleShowItemMenu = (event, item) => {
  menuTarget.value = item
  menuLocation.value = {
    x: event.pageX,
    y: event.pageY,
  }
  isShowItemMenu.value = true
}

const handleItemMenuClick = item => {
  const target = menuTarget.value
  isShowItemMenu.value = false
  if (!item || !target) return
  switch (item.action) {
    case 'play':
      handlePlay(target.index)
      break
    case 'remove':
      void handleRemove(target.id)
      break
  }
}

const handlePointerDown = event => {
  const target = event.target
  if (drawerRef.value?.contains(target) || triggerRef.value?.contains(target)) return
  hide()
}

const handleKeydown = event => {
  if (event.key == 'Escape') hide()
}

const handleQueueListUpdate = ids => {
  if (!currentListId.value || !ids.includes(currentListId.value)) return
  syncQueueList()
}

watch(() => playInfo.playerListId, () => {
  syncQueueList()
}, {
  immediate: true,
})

watch(isVisible, visible => {
  const action = visible ? 'addEventListener' : 'removeEventListener'
  document[action]('mousedown', handlePointerDown, true)
  document[action]('keydown', handleKeydown, true)
  if (visible) {
    syncQueueList()
    scrollCurrentIntoView('auto')
  }
})

onMounted(() => {
  window.app_event.on('myListUpdate', handleQueueListUpdate)
})

onBeforeUnmount(() => {
  picRequestId++
  document.removeEventListener('mousedown', handlePointerDown, true)
  document.removeEventListener('keydown', handleKeydown, true)
  window.app_event.off('myListUpdate', handleQueueListUpdate)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.anchor {
  display: flex;
  align-items: center;
}

.btn {
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform @transition-fast, color @transition-fast, opacity @transition-fast, background-color @transition-fast;

  svg {
    width: 19px;
    height: 19px;
    fill: currentColor;
    opacity: .88;
  }

  &:hover,
  &.active {
    color: rgba(255, 255, 255, 0.98);
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }
}

.layer {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: transparent;
  pointer-events: auto;
}

.drawer {
  position: absolute;
  width: min(388px, calc(100vw - 28px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(247, 249, 253, 0.92);
  color: rgba(36, 40, 48, 0.94);
  box-shadow: 0 26px 62px rgba(17, 22, 30, 0.18);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
  overflow: hidden;
  pointer-events: auto;
}

.leftDrawer {
  left: 22px;
}

.rightDrawer {
  right: 22px;
}

.detailDrawer {
  bottom: 86px;
  height: min(calc(100vh - 128px), 700px);
}

.floatingDrawer {
  bottom: 106px;
  height: min(72vh, 700px);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(96, 111, 135, 0.14);
}

.headerText {
  min-width: 0;

  strong,
  span {
    display: block;
  }

  strong {
    font-size: 15px;
    font-weight: 800;
  }

  span {
    margin-top: 2px;
    font-size: 11px;
    color: rgba(80, 88, 102, 0.72);
  }
}

.headerActions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.headerBtn {
  min-width: 68px;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.76);
  color: rgba(38, 46, 57, 0.92);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: transform @transition-fast, opacity @transition-fast, background-color @transition-fast;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.92);
  }

  &:disabled {
    opacity: .38;
    cursor: default;
  }
}

.listWrap {
  min-height: 0;
  overflow: hidden;
}

.list {
  height: 100%;
  overflow-y: auto;
  padding: 8px 10px 14px;
}

.itemRow {
  position: relative;
  display: block;
  align-items: center;
  min-height: 62px;
  border-radius: 8px;
  transition: background-color @transition-fast;

  &:hover {
    background: rgba(206, 213, 224, 0.28);
  }
}

.itemMain {
  width: 100%;
  min-height: 62px;
  padding: 0 42px 0 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: none;

  &:hover {
    background: transparent;
  }
}

.activeItem .itemMain {
  background: transparent;
}

.activeItem {
  background: rgba(174, 181, 194, 0.26);
}

.coverWrap {
  position: relative;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(208, 216, 228, .72);
}

.cover,
.coverFallback {
  width: 100%;
  height: 100%;
}

.cover {
  object-fit: cover;
}

.coverFallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: rgba(108, 116, 130, .86);
}

.playBadge {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, .32);
  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    transform: translateX(1px);
  }
}

.activeItem .playBadge {
  display: inline-flex;
}

.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.itemName,
.itemSub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itemName {
  font-size: 14px;
  line-height: 1.2;
  color: rgba(32, 37, 44, 0.96);
}

.itemSub {
  font-size: 12px;
  line-height: 1.2;
  color: rgba(112, 118, 130, 0.9);
}

.removeBtn {
  position: absolute;
  top: 0;
  right: 0;
  width: 30px;
  height: 62px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(104, 114, 130, 0.74);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity @transition-fast, color @transition-fast, background-color @transition-fast;

  .itemRow:hover &,
  .itemRow:focus-within & {
    opacity: 1;
    pointer-events: auto;
  }

  &:hover {
    color: rgba(228, 83, 83, 0.96);
    background: rgba(206, 213, 224, 0.32);
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

.empty {
  padding: 28px 16px;
  text-align: center;
  color: rgba(112, 118, 130, 0.8);
}

:global(.queue-drawer-enter-active),
:global(.queue-drawer-leave-active) {
  transition: opacity @transition-fast;
}

:global(.queue-drawer-enter-active) .leftDrawer,
:global(.queue-drawer-leave-active) .leftDrawer,
:global(.queue-drawer-enter-active) .rightDrawer,
:global(.queue-drawer-leave-active) .rightDrawer {
  transition: transform @transition-normal, opacity @transition-normal;
}

:global(.queue-drawer-enter-from),
:global(.queue-drawer-leave-to) {
  opacity: 0;
}

:global(.queue-drawer-enter-from) .leftDrawer,
:global(.queue-drawer-leave-to) .leftDrawer {
  opacity: 0;
  transform: translate3d(-22px, 0, 0);
}

:global(.queue-drawer-enter-from) .rightDrawer,
:global(.queue-drawer-leave-to) .rightDrawer {
  opacity: 0;
  transform: translate3d(22px, 0, 0);
}

:global(.themeShellDark) {
  .drawer {
    border-color: rgba(255, 255, 255, .12);
    background: rgba(22, 24, 29, .94);
    color: rgba(244, 246, 248, .94);
    box-shadow: 0 30px 70px rgba(0, 0, 0, .42);
  }

  .header {
    border-bottom-color: rgba(255, 255, 255, .08);
  }

  .headerText {
    span {
      color: rgba(219, 225, 234, .62);
    }
  }

  .headerBtn {
    border-color: rgba(255, 255, 255, .12);
    background: rgba(255, 255, 255, .08);
    color: rgba(245, 247, 250, .9);

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, .14);
    }
  }

  .itemRow {
    &:hover {
      background: rgba(255, 255, 255, .075);
    }
  }

  .activeItem {
    background: rgba(255, 255, 255, .1);
  }

  .coverWrap {
    background: rgba(255, 255, 255, .08);
  }

  .coverFallback {
    color: rgba(222, 228, 236, .76);
  }

  .itemName {
    color: rgba(247, 249, 252, .96);
  }

  .itemSub,
  .empty {
    color: rgba(210, 216, 226, .68);
  }

  .removeBtn {
    color: rgba(210, 216, 226, .62);

    &:hover {
      color: rgba(255, 112, 112, .96);
      background: rgba(255, 255, 255, .08);
    }
  }
}
</style>
