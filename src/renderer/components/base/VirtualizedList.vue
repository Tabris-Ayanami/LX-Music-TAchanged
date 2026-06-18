<template>
  <component
    :is="containerEl"
    ref="dom_scrollContainer"
    :class="containerClass"
    tabindex="0"
    style="outline: none; height: 100%; overflow-y: auto; position: relative; display: block; contain: strict;"
  >
    <component :is="contentEl" :class="contentClass" :style="contentStyle">
      <div v-for="item in views" :key="item.key" :style="item.style">
        <slot name="default" v-bind="{ item: item.item, index: item.index }" />
      </div>
    </component>
    <slot name="footer" />
  </component>
</template>

<script>
import {
  computed,
  ref,
  nextTick,
  watch,
  onMounted,
  onBeforeUnmount,
} from 'vue'
import scrollHelper from './virtualizedListScrollHelper.cjs'

const { animateElementScroll } = scrollHelper

/**
 * 生成防抖函数
 * @param {*} fn
 * @param {*} delay
 */
export const debounce = (fn, delay = 100) => {
  let timer = null
  let _args = null
  return function(...args) {
    _args = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(this, _args)
    }, delay)
  }
}

export default {
  name: 'VirtualizedList',
  props: {
    containerEl: {
      type: String,
      default: 'div',
    },
    containerClass: {
      type: String,
      default: 'virtualized-list',
    },
    contentEl: {
      type: String,
      default: 'div',
    },
    contentClass: {
      type: String,
      default: 'virtualized-list-content',
    },
    itemHeight: {
      type: Number,
      required: true,
    },
    keyName: {
      type: String,
      required: true,
    },
    list: {
      type: Array,
      required: true,
    },
  },
  emits: ['scroll'],
  setup(props, { emit }) {
    const views = ref([])
    const dom_scrollContainer = ref(null)
    let isListScrolling = false
    const isListScrollingRef = ref(false)
    let startIndex = -1
    let endIndex = -1
    let scrollTop = -1
    let cachedList = new Map()
    let cancelScroll = null
    let isAutoScrolling = false
    let scrollToValue = 0
    let resizeObserver = null
    let resizeTimer = null
    let updateFrame = null
    let isUnmounted = false

    const clearScheduledUpdate = () => {
      if (resizeTimer != null) {
        window.clearTimeout(resizeTimer)
        resizeTimer = null
      }
      if (updateFrame != null) {
        window.cancelAnimationFrame(updateFrame)
        updateFrame = null
      }
    }

    const scheduleUpdateView = () => {
      clearScheduledUpdate()
      updateFrame = window.requestAnimationFrame(() => {
        updateFrame = null
        if (isUnmounted || !dom_scrollContainer.value) return
        updateView()
      })
    }

    const scheduleUpdateViewAfterNextTick = () => {
      void nextTick(() => {
        if (isUnmounted || !dom_scrollContainer.value) return
        scheduleUpdateView()
      })
    }

    const createList = (startIndex, endIndex) => {
      const list = []
      for (let index = startIndex; index < endIndex; index++) {
        const item = props.list[index]
        if (!item) continue
        const cached = cachedList.get(index)
        if (cached?.item === item) {
          list.push(cached)
          continue
        }
        const top = index * props.itemHeight
        const viewItem = {
          item,
          top,
          style: { position: 'absolute', left: 0, right: 0, top: top + 'px', height: props.itemHeight + 'px' },
          index,
          key: item[props.keyName],
        }
        cachedList.set(index, viewItem)
        list.push(viewItem)
      }
      pruneCache(startIndex, endIndex)
      return list
    }

    const pruneCache = (startIndex, endIndex) => {
      const buffer = Math.max(Math.ceil((endIndex - startIndex) * 3), 30)
      const min = Math.max(startIndex - buffer, 0)
      const max = endIndex + buffer
      for (const index of cachedList.keys()) {
        if (index < min || index > max) cachedList.delete(index)
      }
    }

    const updateView = currentScrollTop => {
      const container = dom_scrollContainer.value
      if (!container) return
      const resolvedScrollTop = currentScrollTop ?? container.scrollTop
      // const currentScrollTop = this.$refs.dom_scrollContainer.scrollTop
      const itemHeight = props.itemHeight
      const currentStartIndex = Math.floor(resolvedScrollTop / itemHeight)
      const scrollContainerHeight = container.clientHeight
      const currentEndIndex = currentStartIndex + Math.ceil(scrollContainerHeight / itemHeight)
      const continuous = currentStartIndex <= endIndex && currentEndIndex >= startIndex
      const currentStartRenderIndex = Math.max(currentStartIndex, 0)
      const currentEndRenderIndex = currentEndIndex + 1
      // console.log(continuous)
      // debugger
      if (continuous) {
        // if (Math.abs(currentScrollTop - this.scrollTop) < this.itemHeight * 0.6) return
        // console.log('update')
        // if (currentScrollTop > scrollTop) { // scroll down
        //   // console.log('scroll down')
        //   views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        //   // views.value.push(...list.slice(list.indexOf(views.value[views.value.length - 1]) + 1))
        //   // // if (this.views.length > 100) {
        //   // nextTick(() => {
        //   //   views.value.splice(0, views.value.indexOf(list[0]))
        //   // })
        //   // }
        // } else if (currentScrollTop < scrollTop) { // scroll up
        //   // console.log('scroll up')
        //   views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        // } else return
        if (resolvedScrollTop == scrollTop && endIndex >= currentEndIndex) return
        requestAnimationFrame(() => {
          if (isUnmounted || !dom_scrollContainer.value) return
          views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        })
      } else {
        requestAnimationFrame(() => {
          if (isUnmounted || !dom_scrollContainer.value) return
          views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        })
      }
      startIndex = currentStartIndex
      endIndex = currentEndIndex
      scrollTop = resolvedScrollTop
    }

    const setStopScrollStatus = debounce(() => {
      isListScrolling = false
      isListScrollingRef.value = false
    }, 200)
    const onScroll = event => {
      if (!isListScrolling) isListScrolling = isListScrollingRef.value = true
      setStopScrollStatus()

      const container = dom_scrollContainer.value
      if (!container) return
      const currentScrollTop = container.scrollTop
      if (Math.abs(currentScrollTop - scrollTop) > props.itemHeight * 0.6) {
        updateView(currentScrollTop)
      }
      emit('scroll', event)
    }

    const scrollTo = (scrollTop, animate = false, onScrollEnd) => {
      const getContainer = () => dom_scrollContainer.value
      if (onScrollEnd) {
        void new Promise(resolve => {
          if (cancelScroll) {
            cancelScroll(resolve)
          } else {
            resolve()
          }
        }).then(() => {
          const container = getContainer()
          if (!container) {
            onScrollEnd('missing')
            return
          }
          if (animate) {
            isAutoScrolling = true
            scrollToValue = scrollTop
            cancelScroll = animateElementScroll({
              element: container,
              to: scrollTop,
              duration: 300,
              onComplete: () => {
                cancelScroll = null
                isAutoScrolling = false
                onScrollEnd(true)
              },
              onCancel: () => {
                cancelScroll = null
                isAutoScrolling = false
                onScrollEnd('canceled')
              },
            })
          } else {
            container.scrollTop = scrollTop
            onScrollEnd(true)
          }
        })
      } else {
        const container = getContainer()
        if (!container) return
        container.scrollTo({
          top: scrollTop,
          behavior: animate ? 'smooth' : 'instant',
        })
      }
    }

    const scrollToIndex = (index, offset = 0, animate = false, onScrollEnd) => {
      scrollTo(Math.max(index * props.itemHeight + offset, 0), animate, onScrollEnd)
    }

    const getScrollTop = () => {
      return isAutoScrolling ? scrollToValue : dom_scrollContainer.value?.scrollTop ?? 0
    }

    const handleResize = () => {
      clearScheduledUpdate()
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null
        if (isUnmounted || !dom_scrollContainer.value) return
        updateView()
      })
    }

    const contentStyle = computed(() => {
      const style = {
        display: 'block',
        height: props.list.length * props.itemHeight + 'px',
      }
      if (isListScrollingRef.value) style['pointer-events'] = 'none'
      return style
    })

    const handleReset = list => {
      cachedList.clear()
      startIndex = -1
      endIndex = -1
      if (list.length) {
        scheduleUpdateViewAfterNextTick()
      } else {
        views.value = []
      }
    }
    watch(() => props.itemHeight, () => {
      handleReset(props.list)
    })
    watch(() => props.list, (list) => {
      handleReset(list)
    })

    onMounted(() => {
      const container = dom_scrollContainer.value
      if (!container) return
      container.addEventListener('scroll', onScroll, {
        capture: false,
        passive: true,
      })
      if (window.ResizeObserver) {
        resizeObserver = new window.ResizeObserver(() => {
          updateFrame = window.requestAnimationFrame(() => {
            updateFrame = null
            if (!dom_scrollContainer.value?.clientHeight) return
            updateView()
          })
        })
        resizeObserver.observe(container)
      }
      cachedList.clear()
      startIndex = -1
      endIndex = -1

      if (props.list.length) {
        scheduleUpdateViewAfterNextTick()
      }
      window.addEventListener('resize', handleResize)
    })
    onBeforeUnmount(() => {
      isUnmounted = true
      clearScheduledUpdate()
      dom_scrollContainer.value?.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect?.()
      resizeObserver = null
      if (cancelScroll) {
        cancelScroll()
        cancelScroll = null
      }
      cachedList.clear()
      isAutoScrolling = false
    })

    return {
      views,
      dom_scrollContainer,
      contentStyle,
      scrollTo,
      scrollToIndex,
      getScrollTop,
    }
  },
}
</script>
