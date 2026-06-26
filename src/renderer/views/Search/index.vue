<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <liquid-glass-segmented-nav v-model="source" :items="sourceItems" @change="handleSourceChange" />
      <liquid-glass-segmented-nav v-model="searchType" :items="searchTypeItems" @change="handleTypeChange" />
    </div>
    <div :class="$style.main">
      <template v-if="searchText">
        <song-list-list v-if="searchType == 'songlist'" :page="page" :source-id="source" />
        <music-list v-else :page="page" :source-id="source" />
      </template>
      <blank-view v-else :visible="true" :source="source" />
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import { sources as _sources } from '@renderer/store/search/music/state'

import BlankView from './components/BlankView.vue'
import LiquidGlassSegmentedNav from '@renderer/components/common/liquidGlass/LiquidGlassSegmentedNav.vue'
import { computed, ref } from '@common/utils/vueTools'
import { defineAsyncComponent } from 'vue'
import { sourceNames } from '@renderer/store'

const MusicList = defineAsyncComponent(async() => import('./MusicList/index.vue'))
const SongListList = defineAsyncComponent(async() => import('./SongListList/index.vue'))

const source = ref('kw')
const searchType = ref(null)
const page = ref(1)

const verifyQueryParams = async(to, from, next) => {
  let _source = to.query.source
  let _type = to.query.type
  let _page = to.query.page

  if (_source == null || _type == null) {
    const setting = await getSearchSetting()
    _source ??= setting.source
    _type ??= setting.type

    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: _page },
    })
    return
  }
  source.value = _source
  searchType.value = _type

  if (_page) page.value = parseInt(_page)

  if (to.query.text != null) {
    searchText.value = to.query.text
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  components: {
    MusicList,
    SongListList,
    BlankView,
    LiquidGlassSegmentedNav,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()

    const sourceItems = computed(() => _sources.map(id => {
      return {
        label: sourceNames.value[id],
        value: id,
      }
    }))
    const handleSourceChange = (id) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          source: id,
          page: 1,
        },
      })
    }

    const searchTypeItems = computed(() => {
      return [
        { label: window.i18n.t('search__type_music'), value: 'music' },
        { label: window.i18n.t('search__type_songlist'), value: 'songlist' },
      ]
    })
    const handleTypeChange = (type) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          page: 1,
        },
      })
    }

    return {
      sourceItems,
      source,
      handleSourceChange,
      searchTypeItems,
      searchType,
      handleTypeChange,
      page,
      searchText,
    }
  },
}


</script>

<style lang="less" module>
.container {
  display: flex;
  flex-flow: column nowrap;
}

.header {
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 18px 10px;
  flex: none;
}

.main {
  position: relative;
  flex: auto;
  min-height: 0;
}
</style>
