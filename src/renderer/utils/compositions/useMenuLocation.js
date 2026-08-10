import { nextTick, onMounted, onBeforeUnmount, watch, reactive, ref } from '@common/utils/vueTools'


export default ({ visible, location, onHide }) => {
  let show = false
  let offsetX = 0
  let offsetY = 0
  const dom_menu = ref(null)
  const menuStyles = reactive({
    left: 0,
    top: 0,
    opacity: 0,
    transitionProperty: 'transform, opacity',
    transitionDuration: '120ms',
    transitionTimingFunction: 'cubic-bezier(.23, 1, .32, 1)',
    transform: 'translate(0, 0) scale(.96)',
    transformOrigin: '0 0',
    pointerEvents: 'none',
  })

  const handleShow = () => {
    show = true
    menuStyles.transitionDuration = '160ms'
    menuStyles.opacity = 1
    updateOffset(location.value.x, location.value.y)
    menuStyles.transform = `translate(${offsetX}px, ${offsetY}px) scale(1)`
    menuStyles.pointerEvents = 'auto'
    nextTick(() => {
      dom_menu.value?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true })
    })
  }
  const handleHide = () => {
    menuStyles.transitionDuration = '120ms'
    menuStyles.opacity = 0
    menuStyles.transform = `translate(${offsetX}px, ${offsetY}px) scale(.96)`
    menuStyles.pointerEvents = 'none'
    show = false
  }
  const updateOffset = (left, top) => {
    const listWidth = dom_menu.value.clientWidth
    const listHeight = dom_menu.value.clientHeight
    const dom_container_parant = dom_menu.value.offsetParent
    const containerWidth = dom_container_parant.clientWidth
    const containerHeight = dom_container_parant.clientHeight
    const offsetWidth = containerWidth - left - listWidth
    const offsetHeight = containerHeight - top - listHeight
    offsetX = 0
    offsetY = 0
    if (containerWidth > listWidth && offsetWidth < 12) {
      offsetX = offsetWidth - 12
    }
    if (containerHeight > listHeight && offsetHeight < 5) {
      offsetY = offsetHeight - 5
    }
    menuStyles.transformOrigin = `${offsetX < 0 ? '100%' : '0'} ${offsetY < 0 ? '100%' : '0'}`
  }
  const handleDocumentClick = (event) => {
    if (!show) return

    if (event.target == dom_menu.value || dom_menu.value.contains(event.target)) return

    onHide()
  }

  watch(visible, visible => {
    visible ? handleShow() : handleHide()
  }, { immediate: true })

  watch(location, location => {
    menuStyles.left = location.x - window.lx.rootOffset + 2 + 'px'
    menuStyles.top = location.y - window.lx.rootOffset + 'px'
    if (show) {
      updateOffset(location.x, location.y)
      menuStyles.transform = `translate(${offsetX}px, ${offsetY}px) scale(1)`
    }
  }, { deep: true })

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
  })

  return {
    dom_menu,
    menuStyles,
  }
}
