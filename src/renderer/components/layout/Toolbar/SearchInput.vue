<template>
  <material-search-input v-model="searchText" :list="tipList" :visible-list="visibleList" small @event="handleEvent" />
</template>

<script>
import { debounce } from '@common/utils'
import {
  ref,
  watch,
  nextTick,
  onBeforeUnmount,
} from '@common/utils/vueTools'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { appSetting } from '@renderer/store/setting'
import { searchText as _searchText } from '@renderer/store/search/state'
import { setSearchText } from '@renderer/store/search/action'
import { getSearchSetting } from '@renderer/utils/data'

const tipSearchLoaders = {
  kw: async() => import('@renderer/utils/musicSdk/kw/tipSearch').then(({ default: tipSearch }) => tipSearch),
}
const tipSearchApis = {}
const getTipSearchApi = (source) => {
  const loader = tipSearchLoaders[source]
  if (!loader) return Promise.resolve(null)
  tipSearchApis[source] ||= loader()
  return tipSearchApis[source]
}

export default {
  setup() {
    const searchText = ref('')
    const visibleList = ref(false)
    const tipList = ref([])
    let isFocused = false
    let prevTempSearchSource = ''
    let routeWatchTimer = null
    let blurTimer = null
    let tipRequestId = 0

    const route = useRoute()
    const router = useRouter()

    watch(() => route.name, (newValue, oldValue) => {
      if (oldValue == 'Search' && newValue != 'SongListDetail') {
        if (routeWatchTimer) clearTimeout(routeWatchTimer)
        routeWatchTimer = setTimeout(() => {
          routeWatchTimer = null
          if (appSetting['odc.isAutoClearSearchInput'] && searchText.value) searchText.value = ''
          if (appSetting['odc.isAutoClearSearchList']) setSearchText('')
        })
      }
    })

    watch(_searchText, (newValue, oldValue) => {
      searchText.value = newValue
      if (newValue !== searchText.value) searchText.value = newValue
    })
    watch(searchText, () => {
      handleTipSearch()
    })


    const syncVisibleByQuery = () => {
      visibleList.value = isFocused && !!searchText.value.trim()
    }

    const tipSearch = debounce(async() => {
      const currentRequestId = ++tipRequestId
      if (searchText.value === '' && prevTempSearchSource) {
        tipList.value = []
        const tipSearch = await getTipSearchApi(prevTempSearchSource)
        if (currentRequestId != tipRequestId) return
        tipSearch?.cancelTipSearch()
        return
      }
      const { temp_source } = await getSearchSetting()
      if (currentRequestId != tipRequestId) return
      prevTempSearchSource ||= temp_source
      const keyword = searchText.value
      const tipSearch = await getTipSearchApi(prevTempSearchSource)
      if (currentRequestId != tipRequestId) return
      if (!tipSearch) {
        tipList.value = []
        return
      }
      tipSearch.search(keyword).then(list => {
        if (currentRequestId != tipRequestId) return
        if (keyword != searchText.value) return
        if (!isFocused) return
        tipList.value = list
      }).catch(() => {})
    }, 50)

    const handleTipSearch = () => {
      syncVisibleByQuery()
      tipSearch()
    }

    const handleSearch = () => {
      visibleList.value &&= false
      if (!searchText.value && route.path != '/search') {
        setSearchText('')
        return
      }
      setTimeout(() => {
        router.push({
          path: '/search',
          query: {
            text: searchText.value,
          },
        }).catch(_ => _)
      }, searchText.value ? 200 : 0)
    }

    const handleEvent = ({ action, data }) => {
      switch (action) {
        case 'focus':
          if (blurTimer) {
            clearTimeout(blurTimer)
            blurTimer = null
          }
          isFocused = true
          syncVisibleByQuery()
          if (searchText.value) handleTipSearch()
          break
        case 'blur':
          isFocused = false
          if (blurTimer) clearTimeout(blurTimer)
          blurTimer = setTimeout(() => {
            blurTimer = null
            visibleList.value &&= false
          }, 50)
          break
        case 'submit':
          handleSearch()
          break
        case 'listClick':
          searchText.value = tipList.value[data]
          void nextTick(handleSearch)
      }
    }

    onBeforeUnmount(() => {
      if (routeWatchTimer) clearTimeout(routeWatchTimer)
      if (blurTimer) clearTimeout(blurTimer)
      routeWatchTimer = null
      blurTimer = null
      tipRequestId += 1
    })

    return {
      searchText,
      visibleList,
      tipList,
      handleEvent,
    }
  },
}

</script>
