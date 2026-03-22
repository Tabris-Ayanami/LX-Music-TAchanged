<template>
  <div :class="[$style.menu, { [$style.collapsed]: isSidebarCollapsed }]">
    <section v-for="section in menus" :key="section.title" :class="$style.section">
      <p v-if="!isSidebarCollapsed" :class="$style.sectionTitle">{{ section.title }}</p>
      <ul :class="$style.list" role="toolbar">
        <li v-for="item in section.items" :key="item.key" :class="$style.navItem" role="presentation">
          <router-link
            :class="[$style.link, { [$style.active]: isItemActive(item) }]"
            role="tab"
            :aria-selected="isItemActive(item)"
            :aria-label="item.label"
            :title="isSidebarCollapsed ? item.label : ''"
            :to="item.to"
          >
            <span :class="$style.iconWrap">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :viewBox="item.iconSize" width="17" height="17" space="preserve">
                <use :xlink:href="item.icon" />
              </svg>
            </span>
            <span v-if="!isSidebarCollapsed" :class="$style.label">{{ item.label }}</span>
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
    key: 'local',
    to: { path: '/local', query: { view: 'albums' } },
    icon: '#icon-musicFolder',
    iconSize: '0 0 247.498 247.498',
    name: 'LocalMusic',
    label: '本地音乐',
  },
  {
    key: 'localTracks',
    to: { path: '/local', query: { view: 'tracks' } },
    icon: '#icon-musicFile',
    iconSize: '0 0 512 512',
    name: 'LocalMusic',
    label: '曲库',
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
    label: '音乐家',
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
        key: 'leaderboard',
        to: '/leaderboard',
        icon: '#icon-leaderboard',
        iconSize: '0 0 425.22 425.2',
        name: 'Leaderboard',
        label: t('leaderboard'),
      },
    ],
  },
  {
    title: 'LIBRARY',
    items: [
      ...localEntries,
      {
        key: 'list',
        to: '/list',
        icon: '#icon-love',
        iconSize: '0 0 444.87 391.18',
        name: 'List',
        label: t('my_list'),
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
])

const isItemActive = (item) => {
  if (item.name != 'LocalMusic') return route.meta.name == item.name
  if (!item.localView) return route.meta.name == 'LocalMusic'
  return route.meta.name == 'LocalMusic' && currentLocalView.value == item.localView
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.menu {
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.list {
  -webkit-app-region: no-drag;
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  min-width: 0;
}

.section {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  min-width: 0;
}

.sectionTitle {
  padding: 0 4px;
  font-size: 10px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--shell-muted, var(--color-font-label));
}

.navItem {
  position: relative;
}

.link {
  position: relative;
  width: 100%;
  min-height: 42px;
  padding: 8px 10px;
  border-radius: 12px;
  transition: @transition-fast;
  transition-property: background-color, opacity, transform, border-color;
  color: var(--shell-text, var(--color-nav-font));
  cursor: pointer;
  outline: none;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  overflow: hidden;
  text-decoration: none;

  &.active {
    background: var(--shell-surface-strong, rgba(255, 255, 255, 0.8));
    border-color: var(--shell-stroke, rgba(255, 255, 255, 0.18));
    box-shadow: inset 2px 0 0 var(--shell-accent, var(--color-primary));

    &:hover {
      background: var(--shell-surface-strong, rgba(255, 255, 255, 0.86));
    }
  }

  &:hover {
    color: var(--shell-text, var(--color-nav-font));
    transform: translateY(-1px);

    &:not(.active) {
      background: var(--shell-surface-soft, rgba(255, 255, 255, 0.56));
    }
  }

  &:active:not(.active) {
    opacity: .6;
    transform: translateY(0);
  }
}

.iconWrap {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
}

.label {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  .mixin-ellipsis-1();
}

.collapsed {
  .list {
    align-items: center;
  }

  .link {
    width: 40px;
    min-height: 40px;
    padding: 0;
    justify-content: center;
  }
}

</style>
