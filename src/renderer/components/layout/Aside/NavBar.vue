<template>
  <div ref="menuRef" :class="[$style.menu, { [$style.collapsed]: isSidebarCollapsed }]" @mouseleave="handleMenuLeave">
    <span v-show="pillVisible" :class="[$style.navPill, { [$style.floating]: pillFloating }]" :style="pillStyle" aria-hidden="true">
      <LiquidGlassLayer
        variant="capsule"
        active
        interactive
        :highlight="false"
        :displacement-scale="pillFloating ? 28 : 22"
        :blur-amount="pillFloating ? 1.15 : .95"
        corner-radius="inherit"
      />
    </span>
    <section v-for="section in menus" :key="section.title" :class="$style.section">
      <p :class="$style.sectionTitle" :aria-hidden="isSidebarCollapsed">{{ section.title }}</p>
      <ul :class="$style.list" role="toolbar">
        <li v-for="item in section.items" :key="item.key" :class="$style.navItem" role="presentation">
          <router-link
            :ref="el => setItemRef(item.key, el)"
            :class="[$style.link, { [$style.active]: isItemActive(item) }]"
            role="tab"
            :aria-selected="isItemActive(item)"
            :aria-label="item.label"
            :to="item.to"
            @mouseenter="handleItemEnter(item.key)"
            @focus="handleItemEnter(item.key)"
            @blur="handleMenuLeave"
          >
            <span :class="$style.iconWrap" :style="item.iconOffsetX ? { '--sidebar-icon-offset-x': item.iconOffsetX } : null">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :viewBox="item.iconSize" width="17" height="17" space="preserve">
                <use :xlink:href="item.icon" />
              </svg>
            </span>
            <span :class="$style.label">{{ item.label }}</span>
          </router-link>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'
import { appSetting } from '@renderer/store/setting'
import { isSidebarCollapsed } from '@renderer/store/ui'
import { useI18n } from '@root/lang'
import LiquidGlassLayer from '@renderer/components/common/liquidGlass/LiquidGlassLayer.vue'

const route = useRoute()
const t = useI18n()

const localEntries = [
  {
    key: 'localTracks',
    to: { path: '/local', query: { view: 'tracks' } },
    icon: '#icon-musicFile',
    iconSize: '0 0 512 512',
    iconOffsetX: '2px',
    name: 'LocalMusic',
    label: '歌曲',
    localView: 'tracks',
  },
  {
    key: 'localAlbums',
    to: { path: '/local', query: { view: 'albums' } },
    icon: '#icon-album',
    iconSize: '0 0 425.2 425.2',
    name: 'LocalMusic',
    label: '专辑',
    localView: 'albums',
  },
  {
    key: 'localArtists',
    to: { path: '/local', query: { view: 'artists' } },
    icon: '#icon-artist-custom',
    iconSize: '0 0 1024 1024',
    name: 'LocalMusic',
    label: '歌手',
    localView: 'artists',
  },
  {
    key: 'list',
    to: '/list',
    icon: '#icon-love',
    iconSize: '0 0 444.87 391.18',
    name: 'List',
    label: t('my_list'),
  },
]

const currentLocalView = computed(() => {
  const view = typeof route.query.view == 'string' ? route.query.view : ''
  return ['tracks', 'albums', 'artists'].includes(view) ? view : 'albums'
})

const menus = computed(() => [
  {
    title: 'DISCOVER',
    items: [
      {
        key: 'search',
        to: '/search',
        icon: '#icon-search-2',
        iconSize: '0 0 425.2 425.2',
        name: 'Search',
        label: '搜索',
      },
      {
        key: 'songList',
        to: '/songList/list',
        icon: '#icon-album',
        iconSize: '0 0 425.2 425.2',
        name: 'SongList',
        label: t('song_list'),
      },
      {
        key: 'download',
        to: '/download',
        icon: '#icon-download-2',
        iconSize: '0 0 425.2 425.2',
        name: 'Download',
        label: t('download'),
      },
    ].filter(item => item.key != 'download' || appSetting['download.enable']),
  },
  {
    title: 'LOCAL',
    items: localEntries,
  },
])

const isItemActive = item => {
  if (item.name != 'LocalMusic') return route.meta.name == item.name
  return route.meta.name == 'LocalMusic' && currentLocalView.value == item.localView
}

const menuRef = ref(null)
const itemRefs = new Map()
const hoverKey = ref('')
const pillVisible = ref(false)
const pillRect = ref({ x: 0, y: 0, width: 0, height: 0 })

const activeItemKey = computed(() => {
  for (const section of menus.value) {
    const item = section.items.find(isItemActive)
    if (item) return item.key
  }
  return ''
})

const pillFloating = computed(() => !!hoverKey.value && hoverKey.value != activeItemKey.value)
const pillInset = 2
const pillStyle = computed(() => ({
  width: `${Math.max(0, pillRect.value.width - pillInset * 2)}px`,
  height: `${pillRect.value.height}px`,
  transform: `translate3d(${pillRect.value.x + pillInset}px, ${pillRect.value.y}px, 0) ${pillFloating.value ? 'translateY(-1px)' : 'translateY(0)'}`,
}))

const setItemRef = (key, el) => {
  const target = el?.$el || el
  if (target) itemRefs.set(key, target)
  else itemRefs.delete(key)
}

const updatePillToKey = key => {
  const menuEl = menuRef.value
  const itemEl = itemRefs.get(key)
  if (!menuEl || !itemEl) {
    pillVisible.value = false
    return
  }

  const menuRect = menuEl.getBoundingClientRect()
  const itemRect = itemEl.getBoundingClientRect()
  pillRect.value = {
    x: itemRect.left - menuRect.left,
    y: itemRect.top - menuRect.top,
    width: itemRect.width,
    height: itemRect.height,
  }
  pillVisible.value = true
}

const updatePillToActive = () => {
  if (!activeItemKey.value) {
    pillVisible.value = false
    return
  }
  updatePillToKey(activeItemKey.value)
}

const handleItemEnter = key => {
  hoverKey.value = key
  void nextTick(() => {
    updatePillToKey(key)
  })
}

const handleMenuLeave = () => {
  hoverKey.value = ''
  void nextTick(updatePillToActive)
}

watch([activeItemKey, menus], () => {
  hoverKey.value = ''
  void nextTick(updatePillToActive)
}, {
  immediate: true,
})

watch(isSidebarCollapsed, () => {
  hoverKey.value = ''
  void nextTick(updatePillToActive)
})

onMounted(() => {
  void nextTick(updatePillToActive)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.menu {
  --sidebar-nav-rail: var(--sidebar-icon-lane, 44px);
  --sidebar-nav-height: var(--sidebar-item-height, 40px);
  --sidebar-nav-radius: var(--sidebar-item-radius, 12px);
  --sidebar-nav-glyph: var(--sidebar-icon-glyph-size, 16px);
  --sidebar-active-left-bleed: 0px;
  --sidebar-active-right-trim: 6px;
  --sidebar-motion-duration: .46s;
  --sidebar-motion-curve: cubic-bezier(.2, 0, 0, 1);
  flex: 0 0 auto;
  min-height: 0;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 13px;
  margin-left: 0;
  padding: 0;
  scrollbar-width: none;
  position: relative;
  isolation: isolate;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.navPill {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  border-radius: var(--sidebar-nav-radius);
  corner-shape: squircle;
  pointer-events: none;
  will-change: transform, width, height;
  overflow: hidden;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 84%, #fff 16%), color-mix(in srgb, var(--color-primary) 66%, #2c5fc7 34%));
  box-shadow:
    0 12px 28px color-mix(in srgb, var(--color-primary) 24%, rgba(16, 26, 44, .18)),
    inset 0 1px 0 rgba(255, 255, 255, .24),
    inset 0 -1px 0 rgba(0, 0, 0, .14);
  transition:
    transform 260ms cubic-bezier(.2, .9, .22, 1.12),
    width 230ms cubic-bezier(.2, .85, .24, 1),
    height 230ms cubic-bezier(.2, .85, .24, 1),
    box-shadow 220ms ease;
}

.navPill.floating {
  box-shadow:
    0 18px 36px color-mix(in srgb, var(--color-primary) 28%, rgba(13, 23, 42, .24)),
    inset 0 1px 0 rgba(255, 255, 255, .26),
    inset 0 -1px 0 rgba(0, 0, 0, .14);
}

.section {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.sectionTitle {
  padding: 0 5px;
  height: 11px;
  line-height: 11px;
  font-size: 9px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(86, 100, 120, 0.56);
  overflow: hidden;
  transition: height var(--sidebar-motion-duration) var(--sidebar-motion-curve), margin var(--sidebar-motion-duration) var(--sidebar-motion-curve), opacity .28s var(--sidebar-motion-curve), color @transition-fast;
}

.list {
  -webkit-app-region: no-drag;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.navItem {
  position: relative;
  min-width: 0;
}

.link {
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: 100%;
  height: var(--sidebar-nav-height);
  min-height: var(--sidebar-nav-height);
  padding: 0 9px 0 0;
  box-sizing: border-box;
  border-radius: var(--sidebar-nav-radius);
  corner-shape: squircle;
  display: grid;
  grid-template-columns: var(--sidebar-nav-rail) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--shell-text, var(--color-nav-font));
  overflow: visible;
  transition:
    width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    max-width var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    padding var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    gap var(--sidebar-motion-duration) var(--sidebar-motion-curve),
    transform .2s var(--sidebar-motion-curve),
    color @transition-fast;

  &::before {
    content: '';
    position: absolute;
    inset: 2px var(--sidebar-active-right-trim) 2px calc(var(--sidebar-active-left-bleed) * -1);
    z-index: -1;
    border-radius: inherit;
    corner-shape: squircle;
    background: transparent;
    transform: translateZ(0);
    backface-visibility: hidden;
    pointer-events: none;
    transition: inset var(--sidebar-motion-duration) var(--sidebar-motion-curve), background-color @transition-fast;
  }

  &:hover {
    color: #fff;
    text-shadow: 0 1px 1px rgba(0, 0, 0, .28);
    transform: translateY(-1px);
  }

  &:focus-visible {
    color: #fff;
    text-shadow: 0 1px 1px rgba(0, 0, 0, .28);
    outline: none;
  }
}

.active {
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, .28);
}

.iconWrap {
  flex: none;
  position: relative;
  width: var(--sidebar-nav-rail);
  height: var(--sidebar-nav-rail);
  border-radius: var(--sidebar-nav-radius);
  corner-shape: squircle;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  background: transparent;
  border: none;
  overflow: visible;
  transition: background-color @transition-fast, border-color @transition-fast;

  svg {
    display: block;
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(calc(-50% + var(--sidebar-icon-offset-x, 0px)), -50%);
    transform-origin: center;
    fill: currentColor;
    width: var(--sidebar-nav-glyph);
    height: var(--sidebar-nav-glyph);
  }
}

.label {
  min-width: 0;
  max-width: 100%;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  opacity: 1;
  transform: translateX(0);
  transform-origin: left center;
  transition: max-width var(--sidebar-motion-duration) var(--sidebar-motion-curve), opacity .28s ease, transform var(--sidebar-motion-duration) var(--sidebar-motion-curve);
  .mixin-ellipsis-1();
}

.collapsed {
  .sectionTitle {
    height: 0;
    margin: 0;
    opacity: 0;
  }

  .link {
    width: var(--sidebar-nav-rail);
    max-width: var(--sidebar-nav-rail);
    height: var(--sidebar-nav-height);
    min-height: var(--sidebar-nav-height);
    padding: 0;
    gap: 0;
    margin: 0;
    justify-items: start;

    &::before {
      inset: 2px calc(var(--sidebar-active-left-bleed) * -1) 2px calc(var(--sidebar-active-left-bleed) * -1);
    }
  }

  .iconWrap {
    grid-column: 1;
    justify-self: center;
  }

  .label {
    max-width: 0;
    opacity: 0;
    transform: translateX(-6px);
  }
}
</style>
