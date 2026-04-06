import { ref, watch } from '@common/utils/vueTools'

const SIDEBAR_KEY = 'lx_sidebar_collapsed'
const FLOATING_ISLAND_KEY = 'lx_floating_island_compact'

const getStoredBoolean = (key: string) => {
  try {
    return window.localStorage.getItem(key) == '1'
  } catch {
    return false
  }
}

const persistBoolean = (key: string, value: boolean) => {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {}
}

export const isSidebarCollapsed = ref(getStoredBoolean(SIDEBAR_KEY))
export const isFloatingIslandCompact = ref(getStoredBoolean(FLOATING_ISLAND_KEY))

watch(isSidebarCollapsed, value => {
  persistBoolean(SIDEBAR_KEY, value)
})

watch(isFloatingIslandCompact, value => {
  persistBoolean(FLOATING_ISLAND_KEY, value)
})

export const toggleSidebarCollapsed = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

export const toggleFloatingIslandCompact = () => {
  isFloatingIslandCompact.value = !isFloatingIslandCompact.value
}
