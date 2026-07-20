/* eslint-disable @typescript-eslint/no-var-requires */
// import Vue from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'


const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/search',
      name: 'Search',
      component: async() => import(/* webpackChunkName: "view-search" */ './views/Search/index.vue'),
      meta: {
        name: 'Search',
      },
    },
    {
      path: '/songList/list',
      name: 'SongList',
      component: async() => import(/* webpackChunkName: "view-song-list" */ './views/songList/List/index.vue'),
      meta: {
        name: 'SongList',
      },
    },
    {
      path: '/songList/detail',
      name: 'SongListDetail',
      component: async() => import(/* webpackChunkName: "view-song-list-detail" */ './views/songList/Detail/index.vue'),
      meta: {
        name: 'SongList',
      },
    },
    {
      path: '/leaderboard',
      name: 'Leaderboard',
      component: async() => import(/* webpackChunkName: "view-leaderboard" */ './views/Leaderboard/index.vue'),
      meta: {
        name: 'Leaderboard',
      },
    },
    {
      path: '/list',
      name: 'List',
      component: async() => import(/* webpackChunkName: "view-list" */ './views/List/index.vue'),
      meta: {
        name: 'List',
      },
    },
    {
      path: '/local',
      name: 'LocalMusic',
      component: async() => import(/* webpackChunkName: "view-local-music" */ './views/LocalMusic/index.vue'),
      meta: {
        name: 'LocalMusic',
      },
    },
    {
      path: '/local/detail',
      name: 'LocalMusicDetail',
      component: async() => import(/* webpackChunkName: "view-local-music-detail" */ './views/LocalMusic/Detail.vue'),
      meta: {
        name: 'LocalMusic',
      },
    },
    {
      path: '/download',
      name: 'Download',
      component: async() => import(/* webpackChunkName: "view-download" */ './views/Download/index.vue'),
      meta: {
        name: 'Download',
      },
    },
    {
      path: '/setting',
      name: 'Setting',
      component: async() => import(/* webpackChunkName: "view-setting" */ './views/Setting/index.vue'),
      meta: {
        name: 'Setting',
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/search' },
  ],
  linkActiveClass: 'active-link',
  linkExactActiveClass: 'exact-active-link',
})


export default router
