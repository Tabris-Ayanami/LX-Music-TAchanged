import { ref, watch } from '@common/utils/vueTools'

const KEY = 'lx_sidebar_collapsed'

const getInitialCollapsed = () => {
  try {
    return window.localStorage.getItem(KEY) == '1'
  } catch {
    return false
  }
}

export const isSidebarCollapsed = ref(getInitialCollapsed())

watch(isSidebarCollapsed, value => {
  try {
    window.localStorage.setItem(KEY, value ? '1' : '0')
  } catch {}
})

export const toggleSidebarCollapsed = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
