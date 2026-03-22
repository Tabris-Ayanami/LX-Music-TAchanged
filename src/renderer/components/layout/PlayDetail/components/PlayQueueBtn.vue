<template>
  <material-popup-btn ref="btn_ref" :class="$style.btnContent">
    <button :class="$style.btn" aria-label="Play queue">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-list-order" />
      </svg>
    </button>
    <template #content>
      <div :class="$style.panel">
        <div :class="$style.header">
          <div>
            <strong>Play queue</strong>
            <span>{{ queueSummary }}</span>
          </div>
        </div>
        <div :class="$style.list">
          <button
            v-for="item in queueList"
            :key="item.id + '_' + item.index"
            :class="[$style.item, { [$style.active]: currentMusicId == item.id }]"
            @dblclick="handlePlay(item.index)"
          >
            <span :class="$style.itemMain">{{ item.name || '-' }}</span>
            <span :class="$style.itemSub">{{ item.singer || 'Unknown artist' }}</span>
          </button>
          <div v-if="!queueList.length" :class="$style.empty">No tracks</div>
        </div>
      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'
import { playList } from '@renderer/core/player'
import { getList } from '@renderer/store/player/action'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'

const btn_ref = ref(null)

const queueList = computed(() => {
  const listId = playInfo.playerListId
  if (!listId) return []
  return getList(listId).map((item, index) => {
    if ('progress' in item) {
      return {
        index,
        id: item.id,
        name: item.metadata.musicInfo.name,
        singer: item.metadata.musicInfo.singer,
      }
    }
    return {
      index,
      id: item.id,
      name: item.name,
      singer: item.singer,
    }
  })
})

const currentMusicId = computed(() => playMusicInfo.musicInfo?.id ?? '')
const queueSummary = computed(() => `${queueList.value.length} tracks`)

const handlePlay = (index) => {
  if (!playInfo.playerListId) return
  playList(playInfo.playerListId, index)
  btn_ref.value?.hide()
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btnContent {
  flex: none;
  height: 100%;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;

  svg {
    opacity: .65;
    transition: opacity @transition-fast;
  }

  &:hover svg {
    opacity: .95;
  }
}

.panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header {
  padding: 2px 2px 0;

  strong,
  span {
    display: block;
  }

  strong {
    font-size: 14px;
    color: var(--color-font);
  }

  span {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-500);
  }
}

.list {
  max-height: 320px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 14px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color @transition-fast;

  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
}

.active {
  background-color: color-mix(in srgb, var(--color-primary-alpha-600) 28%, transparent);
}

.itemMain,
.itemSub {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.itemMain {
  font-size: 14px;
  color: var(--color-font);
}

.itemSub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-500);
}

.empty {
  padding: 18px 12px;
  color: var(--color-500);
  font-size: 13px;
  text-align: center;
}
</style>
