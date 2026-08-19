<template>
  <material-search-input
    v-model="searchText"
    :list="tipList"
    :visible-list="visibleList"
    :is-loading="isLoading"
    :placeholder="placeholder"
    small
    @event="handleEvent"
  />
</template>

<script>
import music from '@renderer/utils/musicSdk'
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
import { useI18n } from '@renderer/plugins/i18n'

export default {
  setup() {
    const t = useI18n()
    const placeholder = t('search')
    const searchText = ref('')
    const visibleList = ref(false)
    const tipList = ref([])
    const isLoading = ref(false)
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
        isLoading.value = false
        music[prevTempSearchSource].tipSearch.cancelTipSearch()
        return
      }
      const { temp_source } = await getSearchSetting()
      if (currentRequestId != tipRequestId) return
      prevTempSearchSource ||= temp_source
      const keyword = searchText.value
      isLoading.value = true
      music[prevTempSearchSource].tipSearch.search(keyword).then(list => {
        if (currentRequestId != tipRequestId) return
        if (keyword != searchText.value) return
        if (!isFocused) return
        tipList.value = list
        isLoading.value = false
      }).catch(() => {
        if (currentRequestId == tipRequestId) isLoading.value = false
      })
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
      const keyword = searchText.value
      setTimeout(() => {
        // 在本地音乐页时，搜索走本地过滤（/local?keyword=xxx）
        if (route.name == 'LocalMusic') {
          const view = typeof route.query.view == 'string' ? route.query.view : 'albums'
          void router.push({
            path: '/local',
            query: {
              view,
              keyword,
            },
          }).catch(_ => _)
          return
        }
        void router.push({
          path: '/search',
          query: {
            text: keyword,
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
          isLoading.value = false
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
      isLoading,
      placeholder,
      handleEvent,
    }
  },
}

</script>
