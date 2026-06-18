<template>
  <div :class="[$style.tagList, {[$style.active]: popupVisible}]">
    <div ref="dom_btn" :class="$style.label" @click.stop="handleShow">
      <span>{{ tagName }}</span>
      <div :class="$style.icon">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.847 451.847" space="preserve">
          <use xlink:href="#icon-down" />
        </svg>
      </div>
    </div>
    <div :class="$style.popup" :style="popupStyle" :aria-hidden="!popupVisible" @click.stop>
      <div :class="$style.list" class="scroll">
        <div :class="$style.tag" @click="handleToggleTag('')">{{ $t('default') }}</div>
        <dl v-for="tagInfo in list" :key="tagInfo.name">
          <dt :class="$style.type">{{ tagInfo.name }}</dt>
          <dd v-for="tag in tagInfo.list" :key="tag.id" :class="$style.tag" @click="handleToggleTag(tag.id)">{{ tag.name }}</dd>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, shallowReactive, ref, onMounted, onBeforeUnmount, computed, reactive } from '@common/utils/vueTools'
import { setTags, getTags } from '@renderer/store/songList/action'
import { tags } from '@renderer/store/songList/state'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
  tagId: {
    type: String,
    required: true,
  },
  sortId: {
    type: [String, undefined],
    default: undefined,
  },
})

const router = useRouter()
const route = useRoute()
const t = useI18n()

const list = shallowReactive([])
const handleToggleTag = (id) => {
  void router.replace({
    path: route.path,
    query: {
      source: props.source,
      tagId: id,
      sortId: props.sortId,
    },
  })
  handleHide()
}
watch(() => props.source, async(source) => {
  if (!source) return
  try {
    // const source = (await getLeaderboardSetting()).source as LX.OnlineSource
    let tagInfo = tags[source]
    // console.log(await getTags(source))
    if (tagInfo == null) {
      tagInfo = await getTags(source)
      if (source != props.source) return
      if (!tagInfo) {
        list.splice(0, list.length)
        return
      }
      setTags(tagInfo, source)
    }

    list.splice(0, list.length, ...[{ name: window.i18n.t('songlist__tag_info_hot_tag'), list: [...tagInfo.hotTag] }, ...tagInfo.tags])
  } catch (err) {
    console.log(err)
    if (source != props.source) return
    list.splice(0, list.length)
  }
}, {
  immediate: true,
})
const tagName = computed(() => {
  if (!props.tagId) return t('default')
  for (const tags of list) {
    const tag = tags.list.find(t => t.id == props.tagId)
    if (tag) return tag.name
  }
  return props.tagId
})

const popupStyle = reactive({
  width: '645px',
  maxHeight: '250px',
})

let setTagPopupWidthTimer = null
const setTagPopupWidth = () => {
  if (setTagPopupWidthTimer != null) window.clearTimeout(setTagPopupWidthTimer)
  setTagPopupWidthTimer = window.setTimeout(() => {
    setTagPopupWidthTimer = null
    const dom_view = document.getElementById('view')
    if (!dom_view) return
    popupStyle.width = dom_view.clientWidth * 0.96 + 'px'
    popupStyle.maxHeight = dom_view.clientHeight * 0.65 + 'px'
  }, 50)
}

const dom_btn = ref<HTMLElement | null>(null)
const popupVisible = ref(false)
const handleShow = () => popupVisible.value = !popupVisible.value
const handleHide = (evt) => {
  // if (e && e.target.parentNode != this.$refs.dom_popup && this.show) return this.show = false
  // console.log(this.$refs)
  if (evt && (evt.target == dom_btn.value || dom_btn.value?.contains(evt.target))) return
  popupVisible.value = false
}


onMounted(() => {
  setTagPopupWidth()
  document.addEventListener('click', handleHide)
  window.addEventListener('resize', setTagPopupWidth)
})

onBeforeUnmount(() => {
  if (setTagPopupWidthTimer != null) {
    window.clearTimeout(setTagPopupWidthTimer)
    setTagPopupWidthTimer = null
  }
  document.removeEventListener('click', handleHide)
  window.removeEventListener('resize', setTagPopupWidth)
})

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.tagList {
  font-size: 12px;
  position: relative;
  z-index: 220;

  &.active {
    z-index: 260;

    .label {
      .icon {
        svg{
          transform: rotate(180deg);
        }
      }
    }
    .popup {
      opacity: 1;
      transform: scale(1);
      pointer-events: initial;
    }
  }
}

.label {
  min-height: 32px;
  padding: 7px 12px;
  border: 1px solid var(--shell-control-border);
  border-radius: 8px;
  background: var(--shell-control);
  transition: color @transition-normal, border-color @transition-normal, background-color @transition-normal, transform @transition-normal;
  box-sizing: border-box;
  text-align: center;
  color: var(--shell-text, var(--color-font));
  cursor: pointer;
  display: flex;
  align-items: center;

  span {
    flex: auto;
  }
  .icon {
    flex: none;
    margin-left: 7px;
    line-height: 0;
    svg {
      width: .8em;
      transition: transform .2s ease;
      transform: rotate(0);
    }
  }

  &:hover {
    color: var(--color-primary-font-hover);
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-primary) 48%, var(--shell-control-border));
  }
  &:active {
    color: var(--color-primary-font-active);
  }
}

.popup {
  position: absolute;
  top: 100%;
  width: 645px;
  left: 8px;
  margin-top: 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-content-background) 88%, transparent);
  border: 1px solid var(--shell-control-border, rgba(0, 0, 0, .08));
  opacity: 0;
  transform: scale(.95, .8);
  transform-origin: 0 0 0;
  transition: .25s ease;
  transition-property: transform, opacity;
  max-height: 250px;
  z-index: 280;
  pointer-events: none;
  box-shadow: 0 18px 44px rgba(20, 29, 46, .18);
  backdrop-filter: blur(34px) saturate(170%);
  -webkit-backdrop-filter: blur(34px) saturate(170%);
  display: flex;
  isolation: isolate;

  &:before {
    content: " ";
    position: absolute;
    top: -6px;
    left: 20px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid color-mix(in srgb, var(--color-content-background) 88%, transparent);
  }
}
.list {
  padding: 12px;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--color-content-background) 86%, transparent);
  border-radius: 8px;
}

.type {
  padding-top: 10px;
  padding-bottom: 3px;
  color: var(--shell-muted, var(--color-font-label));
}

.tag {
  display: inline-block;
  margin: 5px;
  background: var(--shell-control, var(--color-button-background));
  border: 1px solid var(--shell-control-border, transparent);
  padding: 8px 10px;
  border-radius: 8px;
  transition: background-color @transition-normal, border-color @transition-normal, transform @transition-normal;
  cursor: pointer;
  color: var(--shell-text, var(--color-font));
  &:hover {
    background-color: var(--shell-button-bg-hover, var(--color-button-background-hover));
    border-color: color-mix(in srgb, var(--color-primary) 42%, var(--shell-control-border));
    transform: translateY(-1px);
  }
  &:active {
    background-color: var(--shell-button-bg-hover, var(--color-button-background-active));
  }
}

</style>
