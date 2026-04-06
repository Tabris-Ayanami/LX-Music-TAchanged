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
                >
                  <button
                    type="button"
                    :class="$style.itemMain"
                    @click="handlePlay(item.index)"
                  >
                    <span :class="$style.index">{{ item.index + 1 }}</span>
                    <span :class="$style.meta">
                      <strong :class="$style.itemName">{{ item.name || '-' }}</strong>
                      <span :class="$style.itemSub">{{ item.singer || '未知歌手' }}</span>
                    </span>
                    <span :class="$style.duration">{{ item.interval || '--:--' }}</span>
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
          </section>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { playList } from '@renderer/core/player'
import { dialog } from '@renderer/plugins/Dialog'
import { clearListMusics, overwriteListMusics, removeListMusics } from '@renderer/store/list/action'
import { getList } from '@renderer/store/player/action'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
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

const syncQueueList = () => {
  const listId = playInfo.playerListId
  if (!listId) {
    queueList.value = []
    return
  }
  queueList.value = getList(listId).map((item, index) => {
    if ('progress' in item) {
      return {
        index,
        id: item.id,
        name: item.metadata.musicInfo.name,
        singer: item.metadata.musicInfo.singer,
        interval: item.metadata.musicInfo.interval,
      }
    }
    return {
      index,
      id: item.id,
      name: item.name,
      singer: item.singer,
      interval: item.interval,
    }
  })
}

const panelTitle = computed(() => window.i18n.t('play_list'))
const queueSummary = computed(() => window.i18n.t('player__queue_count', { count: queueList.value.length }))
const currentQueueIndex = computed(() => playInfo.playerPlayIndex)
const currentListId = computed(() => playInfo.playerListId)
const canLocateCurrent = computed(() => currentQueueIndex.value > -1 && !!playMusicInfo.musicInfo && !!queueList.value.length)
const canEditQueue = computed(() => currentListId.value == LIST_IDS.TEMP || currentListId.value == LIST_IDS.DEFAULT)
const canClearQueue = computed(() => canEditQueue.value && !!queueList.value.length)

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
  width: min(468px, calc(100vw - 28px));
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(247, 249, 253, 0.86);
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
  bottom: 18px;
  height: min(78vh, 760px);
}

.floatingDrawer {
  bottom: 106px;
  height: min(72vh, 700px);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px 16px;
  border-bottom: 1px solid rgba(96, 111, 135, 0.14);
}

.headerText {
  min-width: 0;

  strong,
  span {
    display: block;
  }

  strong {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -.02em;
  }

  span {
    margin-top: 4px;
    font-size: 12px;
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
  min-width: 74px;
  height: 34px;
  padding: 0 12px;
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
  padding: 8px 18px 18px;
}

.itemRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 84px;
  border-bottom: 1px solid rgba(120, 137, 164, 0.16);

  &:last-child {
    border-bottom: none;
  }
}

.itemMain {
  width: 100%;
  min-height: 84px;
  padding: 0 14px 0 0;
  border: none;
  border-radius: 24px;
  background: transparent;
  text-align: left;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: background-color @transition-fast, transform @transition-fast;

  &:hover {
    background: rgba(255, 255, 255, 0.54);
  }
}

.activeItem .itemMain {
  background: linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.95)) 0%, rgba(199, 234, 252, 0.9) 100%);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.index {
  width: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: rgba(112, 118, 130, 0.84);
}

.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.itemName,
.itemSub,
.duration {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itemName {
  font-size: 15px;
  color: rgba(32, 37, 44, 0.96);
}

.itemSub,
.duration {
  font-size: 12px;
  color: rgba(112, 118, 130, 0.9);
}

.duration {
  min-width: 42px;
  text-align: right;
}

.removeBtn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgba(104, 114, 130, 0.74);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform @transition-fast, color @transition-fast, background-color @transition-fast;

  &:hover {
    transform: translateY(-1px);
    color: rgba(228, 83, 83, 0.96);
    background: rgba(255, 255, 255, 0.68);
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
</style>
