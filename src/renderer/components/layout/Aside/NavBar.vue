<template>
  <div :class="[$style.menu, { [$style.collapsed]: isSidebarCollapsed }]">
    <section v-for="section in menus" :key="section.title" :class="$style.section">
      <p :class="$style.sectionTitle" :aria-hidden="isSidebarCollapsed">{{ section.title }}</p>
      <ul :class="$style.list" role="toolbar">
        <li v-for="item in section.items" :key="item.key" :class="$style.navItem" role="presentation">
          <router-link
            :class="[$style.link, { [$style.active]: isItemActive(item) }]"
            role="tab"
            :aria-selected="isItemActive(item)"
            :aria-label="item.label"
            :to="item.to"
          >
            <span :class="$style.iconWrap">
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
import { computed } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'
import { appSetting } from '@renderer/store/setting'
import { isSidebarCollapsed } from '@renderer/store/ui'
import { useI18n } from '@root/lang'

const route = useRoute()
const t = useI18n()

const localEntries = [
  {
    key: 'localTracks',
    to: { path: '/local', query: { view: 'tracks' } },
    icon: '#icon-musicFile',
    iconSize: '0 0 512 512',
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
        label: t('search'),
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
    items: [
      {
        key: 'local',
        to: { path: '/local', query: { view: 'albums' } },
        icon: '#icon-musicFolder',
        iconSize: '0 0 247.498 247.498',
        name: 'LocalMusic',
        label: '本地音乐',
      },
      ...localEntries,
      {
        key: 'list',
        to: '/list',
        icon: '#icon-love',
        iconSize: '0 0 444.87 391.18',
        name: 'List',
        label: t('my_list'),
      },
    ],
  },
])

const isItemActive = item => {
  if (item.name != 'LocalMusic') return route.meta.name == item.name
  if (!item.localView) return route.meta.name == 'LocalMusic'
  return route.meta.name == 'LocalMusic' && currentLocalView.value == item.localView
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.menu {
  flex: auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 2px 2px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.sectionTitle {
  padding: 0 10px;
  height: 14px;
  line-height: 14px;
  font-size: 10px;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: rgba(86, 100, 120, 0.56);
  overflow: hidden;
}

.list {
  -webkit-app-region: no-drag;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.navItem {
  position: relative;
  min-width: 0;
}

.link {
  width: 100%;
  max-width: 100%;
  height: 48px;
  min-height: 48px;
  padding: 10px 12px;
  box-sizing: border-box;
  border-radius: 15px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--shell-text, var(--color-nav-font));
  transition: transform @transition-fast, background-color @transition-fast, color @transition-fast;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.46);
  }
}

.active {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 82%, white), color-mix(in srgb, var(--color-primary) 58%, white 42%));
  color: #fff;
  box-shadow: 0 16px 30px color-mix(in srgb, var(--color-primary) 22%, transparent);

  .iconWrap {
    background: rgba(255, 255, 255, 0.22);
  }
}

.iconWrap {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  background: rgba(255, 255, 255, 0.62);

  svg {
    fill: currentColor;
  }
}

.label {
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  .mixin-ellipsis-1();
}

.collapsed {
  .sectionTitle {
    visibility: hidden;
    opacity: 0;
  }

  .link {
    width: 100%;
    max-width: 100%;
    height: 48px;
    min-height: 48px;
    padding: 0;
    grid-template-columns: 28px;
    gap: 0;
    justify-content: center;
  }

  .label {
    display: none;
  }
}
</style>
