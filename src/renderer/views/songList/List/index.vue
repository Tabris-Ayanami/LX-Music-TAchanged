<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.left">
        <tag-list :source="source" :tag-id="tagId" :sort-id="sortId" />
        <sort-tab :source="source" :tag-id="tagId" :sort-id="sortId" />
      </div>
      <base-btn :class="$style.btn" outline min @click="visibleOpenSongListModal = true">{{ $t('songlist__import_input_show_btn') }}</base-btn>
      <base-selection :model-value="source" :class="$style.select" :list="sourceList" item-key="id" item-name="name" @update:model-value="handleToggleSource" />
    </div>
    <list-view :source="source" :tag-id="tagId" :sort-id="sortId" :page="page" />
    <open-list-modal v-model="visibleOpenSongListModal" :source-list="sourceList" />
  </div>
</template>

<script lang="ts">
import { computed, ref } from '@common/utils/vueTools'
import { getSongListSetting, setSongListSetting } from '@renderer/utils/data'
import TagList from './components/TagList.vue'
import SortTab from './components/SortTab.vue'
import OpenListModal from './components/OpenListModal.vue'
import ListView from './ListView.vue'
import { sources, listInfo, isVisibleListDetail } from '@renderer/store/songList/state'
import { sourceNames } from '@renderer/store'
import { useRoute, useRouter } from '@common/utils/vueRouter'

const source = ref<LX.OnlineSource>('kw')
const tagId = ref<string>('')
const sortId = ref<string>('')
const page = ref<number>(1)


interface Query {
  source?: string
  tagId?: string
  sortId?: string
  page?: string
}

const verifyQueryParams = async function(this: any, to: { query: Query, path: string }, from: any, next: (route?: { path: string, query: Query }) => void) {
  let _source = to.query.source
  let _tagId = to.query.tagId
  let _sortId = to.query.sortId
  let _page: string | undefined = to.query.page

  if (isVisibleListDetail.value) {
    next({ path: '/songList/detail', query: {} })
    return
  } else if (_source == null) {
    if (listInfo.key) {
      _source = listInfo.source
      _tagId = listInfo.tagId
      _sortId = listInfo.sortId
      _page = listInfo.page.toString()
    } else {
      const setting = await getSongListSetting()
      _source = setting.source
      _tagId = setting.tagId
      _sortId = setting.sortId
      _page = '1'
    }

    next({
      path: to.path,
      query: { ...to.query, source: _source, tagId: _tagId, sortId: _sortId, page: _page },
    })
    return
  }
  next()
  source.value = _source as LX.OnlineSource
  tagId.value = _tagId ?? ''
  sortId.value = _sortId ?? ''
  page.value = _page ? parseInt(_page) : 1
  void setSongListSetting({ source: _source, tagId: _tagId, sortId: _sortId })
}


export default {
  components: {
    TagList,
    SortTab,
    ListView,
    OpenListModal,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const visibleOpenSongListModal = ref(false)

    const sourceList = computed(() => {
      return sources.map(s => ({ id: s, name: sourceNames.value[s] }))
    })
    const router = useRouter()
    const route = useRoute()
    const handleToggleSource = (id: LX.OnlineSource) => {
      if (id == source.value) return
      void router.replace({
        path: route.path,
        query: {
          source: id,
          tagId: '',
        },
      })
    }

    return {
      source,
      tagId,
      sortId,
      page,
      sourceList,
      handleToggleSource,
      visibleOpenSongListModal,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
  padding: 18px 22px 25px;
  box-sizing: border-box;
  gap: 14px;
  isolation: isolate;
}
.header {
  flex: none;
  width: 100%;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1px solid var(--shell-control-border);
  background: var(--color-content-background);
  box-shadow: var(--shell-panel-shadow);
  position: relative;
  z-index: 200;
}
.left {
  flex: auto;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.btn {
  flex: none;
  color: var(--shell-button-text, var(--color-font)) !important;
  border: 1px solid var(--shell-control-border) !important;
  border-radius: 8px !important;
  background: var(--shell-button-bg) !important;
  box-shadow: none !important;
  transition: transform @transition-fast, background-color @transition-fast, border-color @transition-fast;
  &:hover {
    color: var(--shell-button-text, var(--color-font)) !important;
    background: var(--shell-button-bg-hover) !important;
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-primary) 48%, var(--shell-control-border)) !important;
  }
}


.select {
  font-size: 12px;
  width: auto;
  flex: none;
  padding: 0 5px;
  z-index: 210;

  &:hover {
    :global(.icon) {
      opacity: 1;
    }
  }


  :global {
    .label-content {
      background: var(--shell-control) !important;
      border: 1px solid var(--shell-control-border);
      transition: color @transition-fast;
      color: var(--shell-text, var(--color-font));
      border-radius: 8px;
      &:hover {
        color: var(--color-primary-font-hover);
        border-color: color-mix(in srgb, var(--color-primary) 48%, var(--shell-control-border));
        .icon {
          opacity: 1;
        }
      }
    }
    // .label {
    //   color: var(--color-font) !important;
    // }
    .icon {
      svg {
        width: .8em;
      }
      // opacity: .6;
      // transition: color @transition-fast;
      // color: var(--color-font-label);
    }

    .selection-list {
      max-height: 500px;
      background: color-mix(in srgb, var(--color-content-background) 88%, transparent) !important;
      border: 1px solid var(--shell-control-border);
      box-shadow: 0 16px 34px rgba(20, 29, 46, 0.18);
      backdrop-filter: blur(34px) saturate(170%);
      -webkit-backdrop-filter: blur(34px) saturate(170%);
      z-index: 240;
      opacity: 1;
      pointer-events: auto;
      li {
        color: var(--shell-text, var(--color-font));
        background: color-mix(in srgb, var(--color-content-background) 86%, transparent) !important;
        text-align: center;
        line-height: 38px;
        font-size: 13px;
        &:hover {
          background-color: var(--shell-button-bg-hover, var(--color-button-background-hover)) !important;
        }
        &:active {
          background-color: var(--shell-button-bg-hover, var(--color-button-background-active)) !important;
        }
      }
    }
  }
}

</style>
