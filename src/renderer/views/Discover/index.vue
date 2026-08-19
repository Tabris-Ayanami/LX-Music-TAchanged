<template lang="pug">
div(:class="$style.page")
  //- ===== 正在播放：上/当前/下一首三标签（默认正方形，hover 展开为浮岛长方形） =====
  section(:class="$style.nowPlaying" @mouseleave="hoverTab = 'cur'")
    div(
      :class="[$style.npTab, $style.npTabPrev, { [$style.expanded]: hoverTab == 'prev' }]"
      :style="prevStyle"
      @mouseenter="hoverTab = 'prev'" @mouseleave="hoverTab = 'cur'"
    )
      img(v-if="discoverActive && prevSong && songPic(prevSong)" :class="$style.npCover" :src="songPic(prevSong)" loading="lazy" @load="imgLoad" @error="imgError")
      div(v-else :class="[$style.npCover, $style.npCoverFallback]")
        svg(viewBox="0 0 24 24" width="24" height="24" aria-hidden="true")
          use(xlink:href="#icon-lx-note")
      div(:class="$style.npMeta")
        span(:class="$style.npLabel") {{ $t('discover__prev') }}
        strong {{ prevSong ? songName(prevSong) : '--' }}
        span(:class="$style.npSinger") {{ prevSong ? songSinger(prevSong) : '' }}
      button(:class="$style.npPlay" :aria-label="$t('player__prev')" :disabled="!prevSong" @click.stop="goPrev")
        svg(viewBox="0 0 1024 1024" width="16" height="16" aria-hidden="true")
          use(xlink:href="#icon-prevMusic")

    div(
      :class="[$style.npTab, $style.npTabCur, { [$style.expanded]: hoverTab == 'cur' }]"
      :style="curStyle"
      @mouseenter="hoverTab = 'cur'" @mouseleave="hoverTab = 'cur'"
    )
      img(v-if="discoverActive && musicInfo.pic" :class="$style.npCover" :src="musicInfo.pic" loading="lazy" @load="imgLoad" @error="imgError")
      div(v-else :class="[$style.npCover, $style.npCoverFallback]")
        svg(viewBox="0 0 24 24" width="24" height="24" aria-hidden="true")
          use(xlink:href="#icon-lx-note")
      div(:class="$style.npMeta")
        span(:class="$style.npLabel") {{ $t('discover__now_playing') }}
        strong {{ musicInfo.name || $t('discover__nothing_playing') }}
        span(:class="$style.npSinger") {{ musicInfo.singer || ' ' }}
      button(:class="$style.npPlay" :aria-label="$t('player__play')" :disabled="!musicInfo.id" @click.stop="togglePlay")
        svg(v-if="isPlay" viewBox="0 0 1024 1024" width="14" height="14" aria-hidden="true")
          use(xlink:href="#icon-pause")
        svg(v-else viewBox="0 0 1024 1024" width="14" height="14" aria-hidden="true")
          use(xlink:href="#icon-play")

    div(
      :class="[$style.npTab, $style.npTabNext, { [$style.expanded]: hoverTab == 'next' }]"
      :style="nextStyle"
      @mouseenter="hoverTab = 'next'" @mouseleave="hoverTab = 'cur'"
    )
      img(v-if="discoverActive && nextSong && songPic(nextSong)" :class="$style.npCover" :src="songPic(nextSong)" loading="lazy" @load="imgLoad" @error="imgError")
      div(v-else :class="[$style.npCover, $style.npCoverFallback]")
        svg(viewBox="0 0 24 24" width="24" height="24" aria-hidden="true")
          use(xlink:href="#icon-lx-note")
      div(:class="$style.npMeta")
        span(:class="$style.npLabel") {{ $t('discover__next') }}
        strong {{ nextSong ? songName(nextSong) : '--' }}
        span(:class="$style.npSinger") {{ nextSong ? songSinger(nextSong) : '' }}
      button(:class="$style.npPlay" :aria-label="$t('player__next')" :disabled="!nextSong" @click.stop="goNext")
        svg(viewBox="0 0 1024 1024" width="16" height="16" aria-hidden="true")
          use(xlink:href="#icon-nextMusic")

  //- ===== 每日推荐 =====
  section(:class="$style.section")
    div(:class="$style.sectionHead")
      h2(:class="$style.sectionTitle") {{ $t('discover__daily_recommend') }}
      div(:class="$style.sectionHeadRight")
        span(v-if="dailyList.length" :class="$style.sectionSub") {{ dailyList.length }} {{ $t('discover__songs_unit') }}
        button(
          :class="$style.playAll" :disabled="!dailyList.length" @click="playAllDaily"
          @pointerenter="onPlayAllEnter" @pointerleave="onPlayAllLeave" @pointermove="onPlayAllMove" @pointerdown="onPlayAllDown" @pointerup="onPlayAllUp"
        )
          span(:class="$style.playAllFill" :style="playAllFillStyle")
          span(:class="$style.playAllLabel")
            svg(viewBox="0 0 24 24" width="14" height="14" aria-hidden="true")
              use(xlink:href="#icon-play")
            span {{ $t('discover__play_all') }}
    template(v-if="hasWYCookie")
      div(v-if="dailyLoading" :class="$style.dailyEmpty" role="status" aria-live="polite")
        div {{ $t('discover__daily_loading') }}
      div(v-else-if="dailyList.length" ref="dailyRailRef" :class="$style.dailyRail" @wheel="handleRailWheel")
        button(v-for="(item, index) in dailyList" :key="item.id" type="button" :class="$style.dailyCard" @click="playDaily(index)")
          div(:class="$style.dailyCoverWrap")
            img(v-if="discoverActive" :class="$style.dailyCover" :src="item.meta.picUrl" loading="lazy" @load="imgLoad" @error="imgError")
            div(:class="$style.dailyOverlay")
              span(:class="$style.dailyIndex") {{ String(index + 1).padStart(2, '0') }}
          div(:class="$style.dailyMeta")
            div(:class="$style.dailyName" :title="item.name") {{ item.name }}
            div(:class="$style.dailySinger") {{ item.singer }}
      div(v-else-if="dailyError" :class="$style.dailyEmpty")
        div(:class="$style.dailyEmptyIcon")
          svg(viewBox="0 0 24 24" width="22" height="22" aria-hidden="true")
            use(xlink:href="#icon-leaderboard")
        div {{ $t('discover__daily_empty') }}
        button(:class="$style.dailyRefresh" @click="loadDaily")
          svg(viewBox="0 0 24 24" width="14" height="14" aria-hidden="true")
            use(xlink:href="#icon-refresh")
          span {{ $t('discover__retry') }}
      div(v-else :class="$style.dailyEmpty")
        div {{ $t('discover__daily_empty') }}
    template(v-else)
      div(:class="$style.dailyLocked")
        div(:class="$style.dailyLockedIcon")
          svg(viewBox="0 0 24 24" width="20" height="20" aria-hidden="true")
            use(xlink:href="#icon-sdCard")
        div(:class="$style.dailyLockedTitle") {{ $t('discover__daily_locked') }}
        div(:class="$style.dailyLockedDesc") {{ $t('discover__daily_locked_desc') }}
        router-link(:class="$style.dailyLockedBtn" :to="{ path: '/setting', query: { name: 'SettingAccount' } }") {{ $t('discover__go_setting') }}

  //- ===== 搜索历史 =====
  section(v-if="historyList.length" :class="$style.section")
    div(:class="$style.sectionHead")
      h2(:class="$style.sectionTitle") {{ $t('history_search') }}
      button(:class="$style.sectionClear" :aria-label="$t('history_clear')" @click="clearHistoryList")
        svg(viewBox="0 0 512 512" width="13" height="13" aria-hidden="true")
          use(xlink:href="#icon-eraser")
    div(:class="$style.chipWrap")
      div(v-for="(item, index) in historyList" :key="index + item" :class="$style.historyChip")
        origin-chip(:class="$style.chip" @click="handleSearch(item)")
          span(:class="$style.chipText") {{ item }}
        button(type="button" :class="$style.chipRemove" :aria-label="$t('history_remove')" @click="removeHistoryWord(index)")
          svg(viewBox="0 0 24 24" width="10" height="10" aria-hidden="true")
            use(xlink:href="#icon-window-close")

  //- ===== 热门搜索 =====
  section(:class="$style.section")
    div(:class="$style.sectionHead")
      h2(:class="$style.sectionTitle") {{ $t('search__hot_search') }}
      span(:class="$style.sectionSource") {{ sourceName }}
    div(:class="$style.chipWrap")
      origin-chip(v-for="(item, index) in hotList" :key="index + item" :class="[$style.chip, { [$style.chipTop]: index < 3 }]" :top="index < 3" @click="handleSearch(item)")
        span(:class="$style.chipRank") {{ String(index + 1).padStart(2, '0') }}
        span(:class="$style.chipText") {{ item }}
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { onActivated, onDeactivated } from 'vue'
import { useRouter } from '@common/utils/vueRouter'
import OriginChip from '@renderer/components/common/OriginChip.vue'
import { appSetting } from '@renderer/store/setting'
import { musicInfo, isPlay, playInfo } from '@renderer/store/player/state'
import { getList } from '@renderer/store/player/action'
import { togglePlay, playList } from '@renderer/core/player'
import { historyList } from '@renderer/store/search/state'
import { getHistoryList, clearHistoryList, removeHistoryWord } from '@renderer/store/search/action'
import { getList as getHotList } from '@renderer/store/hotSearch'
import { getSearchSetting } from '@renderer/utils/data'
import { sourceNames } from '@renderer/store'
import { playMusicInDefaultList, playMusicsInDefaultList } from '@renderer/utils/playDefaultList'
import { toNewMusicInfo } from '@common/utils/tools'
import music from '@renderer/utils/musicSdk'
import resourceLifecycleModule from './resourceLifecycle.cjs'

const { createDiscoverResourceLifecycle } = resourceLifecycleModule

const router = useRouter()
const dailyRailRef = ref(null)
const discoverActive = ref(false)
const resourceLifecycle = createDiscoverResourceLifecycle()

const handleRailWheel = event => {
  const el = dailyRailRef.value
  if (!el) return
  event.preventDefault()
  el.scrollLeft += event.deltaY || event.deltaX
}

const hasWYCookie = computed(() => !!appSetting['account.wy.cookie']?.trim())
const dailyList = ref([])
const dailyLoading = ref(false)
const dailyError = ref(false)
const hotList = ref([])
const sourceName = ref('')
const hoverTab = ref('cur')

const imgError = event => {
  event.target.style.visibility = 'hidden'
}
const imgLoad = event => {
  event.target.style.visibility = ''
}

// ===== 上一首 / 下一首（边界自动循环） =====
const playerList = computed(() => {
  const list = getList(playInfo.playerListId)
  return Array.isArray(list) ? list : []
})
const currentIndex = computed(() => Math.max(0, playInfo.playerPlayIndex))
const listLength = computed(() => playerList.value.length)
const prevSong = computed(() => {
  if (!listLength.value) return null
  const prevIndex = currentIndex.value <= 0 ? listLength.value - 1 : currentIndex.value - 1
  return playerList.value[prevIndex]
})
const nextSong = computed(() => {
  if (!listLength.value) return null
  const nextIndex = currentIndex.value >= listLength.value - 1 ? 0 : currentIndex.value + 1
  return playerList.value[nextIndex]
})

const songName = song => song?.name || ''
const songSinger = song => song?.singer || ''
const songPic = song => song?.pic || song?.meta?.picUrl || song?.img || ''

const goPrev = () => {
  if (!listLength.value || !playInfo.playerListId) return
  const prevIndex = currentIndex.value <= 0 ? listLength.value - 1 : currentIndex.value - 1
  playList(playInfo.playerListId, prevIndex)
}
const goNext = () => {
  if (!listLength.value || !playInfo.playerListId) return
  const nextIndex = currentIndex.value >= listLength.value - 1 ? 0 : currentIndex.value + 1
  playList(playInfo.playerListId, nextIndex)
}

// ===== 取封面主导色（纯色）+ 本地噪点纹理 =====
const colorCache = new Map()

// 取色失败时的回退：主题色（不是灰黑），保证卡片始终有颜色
const FALLBACK_BG = 'color-mix(in srgb, var(--color-primary) 58%, #141a24)'

// 从像素数据提取"主导色"：跳过低饱和 / 过暗 / 过亮的像素，避免被白色文字和黑色边缘拉灰
const extractDominantColor = (data) => {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  let fallbackR = 0
  let fallbackG = 0
  let fallbackB = 0
  let fallbackCount = 0
  for (let i = 0; i < data.length; i += 4) {
    const rr = data[i]
    const gg = data[i + 1]
    const bb = data[i + 2]
    const max = Math.max(rr, gg, bb)
    const min = Math.min(rr, gg, bb)
    const sat = max === 0 ? 0 : (max - min) / max
    const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb
    fallbackR += rr
    fallbackG += gg
    fallbackB += bb
    fallbackCount++
    if (sat < 0.12 || lum < 18 || lum > 238) continue
    r += rr
    g += gg
    b += bb
    count++
  }
  if (!count) {
    r = fallbackR
    g = fallbackG
    b = fallbackB
    count = fallbackCount
  }
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
}

// 平均 RGB → 背景色；太亮/太暗都会拉回舒适范围，保证白字可读
const adjustColor = (r, g, b) => {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  let scale = 1
  if (lum < 55) {
    scale = 55 / Math.max(1, lum)
  } else if (lum > 200) {
    scale = 200 / lum
  }
  return `rgb(${Math.round(r * scale)}, ${Math.round(g * scale)}, ${Math.round(b * scale)})`
}

const getSolidColor = url => {
  if (!discoverActive.value || !url) return FALLBACK_BG
  if (colorCache.has(url)) return colorCache.get(url)
  colorCache.set(url, FALLBACK_BG)

  const commitColor = (r, g, b) => {
    colorCache.set(url, adjustColor(r, g, b))
    colorVersion.value += 1
  }

  const tryExtractFromImage = img => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 24
      canvas.height = 24
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, 24, 24)
      const data = ctx.getImageData(0, 0, 24, 24).data
      commitColor(...extractDominantColor(data))
    } catch {
      // canvas 被跨域污染，保持主题色回退
    }
  }

  // 方案1：直接 <img crossOrigin> 加载（图床带 CORS 头即可成功）
  resourceLifecycle.loadImage({
    url,
    crossOrigin: 'anonymous',
    onLoad: img => {
      tryExtractFromImage(img)
    },
    onError: () => {
    // 方案2：<img> 不带 crossOrigin 加载（能显示，但 canvas 会污染，仅尝试）
      resourceLifecycle.loadImage({
        url,
        onLoad: img => {
          tryExtractFromImage(img)
        },
      })
    },
  })

  return FALLBACK_BG
}

const coverOf = song => song?.pic || song?.meta?.picUrl || ''

// 本地噪点纹理库（4 组随机 SVG feTurbulence，选中一块固定使用）
const NOISE_TEXTURES = [
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.06\'/%3E%3C/svg%3E")',
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.7\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'turbulence\' baseFrequency=\'0.5\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.07\'/%3E%3C/svg%3E")',
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'140\' height=\'140\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.1\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
]
const noiseTexture = NOISE_TEXTURES[Math.floor(Math.random() * NOISE_TEXTURES.length)]

const tabBgStyle = color => ({
  backgroundColor: color,
  backgroundImage: `${noiseTexture}, linear-gradient(180deg, rgba(255,255,255,.14), rgba(0,0,0,.08))`,
  backgroundBlendMode: 'overlay, normal',
})

// 强制刷新标记：取色异步完成后 +1，供 computed 读取建立依赖
const colorVersion = ref(0)

const versionedTabStyle = (cover, _version) => tabBgStyle(getSolidColor(cover))
const curStyle = computed(() => versionedTabStyle(coverOf({ pic: musicInfo.pic }), colorVersion.value))
const prevStyle = computed(() => versionedTabStyle(coverOf(prevSong.value), colorVersion.value))
const nextStyle = computed(() => versionedTabStyle(coverOf(nextSong.value), colorVersion.value))

// ===== 每日推荐 =====
const loadDaily = async() => {
  if (!discoverActive.value || !hasWYCookie.value) return
  dailyLoading.value = true
  dailyError.value = false
  await resourceLifecycle.runWhileActive({
    task: () => music.wy.account.getDailyRecommend(),
    onSuccess: list => {
      dailyList.value = list.map(item => toNewMusicInfo(item))
    },
    onError: err => {
      console.log(err)
      dailyList.value = []
      dailyError.value = true
    },
    onSettled: () => {
      dailyLoading.value = false
    },
  })
}

const playDaily = async(index) => {
  const item = dailyList.value[index]
  if (!item) return
  // 点击单曲只播放这一首，不把整张每日推荐加进列表
  await playMusicInDefaultList(item)
}

const playAllDaily = async() => {
  if (!dailyList.value.length) return
  await playMusicsInDefaultList(dailyList.value, 0)
}

// ===== 播放全部按钮：落点扩散填充动效（OriginButton 风格） =====
const playAllOrigin = ref({ x: 0, y: 0 })
const playAllSize = ref(0)
const playAllShow = ref(false)

const getCoverDiameter = (w, h, x, y) => Math.ceil(2 * Math.max(
  Math.hypot(x, y),
  Math.hypot(w - x, y),
  Math.hypot(x, h - y),
  Math.hypot(w - x, h - y),
))

const onPlayAllMove = event => {
  const rect = event.currentTarget.getBoundingClientRect()
  playAllOrigin.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
  playAllSize.value = getCoverDiameter(rect.width, rect.height, playAllOrigin.value.x, playAllOrigin.value.y)
}
const onPlayAllEnter = event => {
  if (event.currentTarget.disabled) return
  const rect = event.currentTarget.getBoundingClientRect()
  playAllOrigin.value = {
    x: rect.width / 2,
    y: rect.height / 2,
  }
  playAllSize.value = getCoverDiameter(rect.width, rect.height, playAllOrigin.value.x, playAllOrigin.value.y)
  playAllShow.value = true
}
const onPlayAllLeave = () => {
  playAllShow.value = false
}
const onPlayAllDown = event => {
  const rect = event.currentTarget.getBoundingClientRect()
  playAllOrigin.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
  playAllSize.value = getCoverDiameter(rect.width, rect.height, playAllOrigin.value.x, playAllOrigin.value.y)
}
const onPlayAllUp = () => {}

const playAllFillStyle = computed(() => ({
  left: `${playAllOrigin.value.x}px`,
  top: `${playAllOrigin.value.y}px`,
  width: `${playAllSize.value}px`,
  height: `${playAllSize.value}px`,
  transform: `translate(-50%, -50%) scale(${playAllShow.value && playAllSize.value > 0 ? 1 : 0})`,
}))

// ===== 热搜 =====
const loadHot = async() => {
  try {
    const searchSetting = await getSearchSetting()
    const source = searchSetting.temp_source || searchSetting.source || 'kw'
    sourceName.value = sourceNames.value[source] || ''
    hotList.value = await getHotList(source)
  } catch (err) {
    console.log(err)
    hotList.value = []
  }
}

const handleSearch = text => {
  void router.push({
    path: '/search',
    query: { text },
  })
}

watch(hasWYCookie, value => {
  if (value && discoverActive.value) {
    void loadDaily()
  } else {
    dailyList.value = []
    dailyError.value = false
  }
})

onMounted(() => {
  void getHistoryList()
})

const activateDiscoverResources = () => {
  if (discoverActive.value) return
  resourceLifecycle.activate()
  discoverActive.value = true
  if (!hotList.value.length) void loadHot()
  if (hasWYCookie.value) void loadDaily()
}

const deactivateDiscoverResources = () => {
  if (!discoverActive.value) return
  discoverActive.value = false
  resourceLifecycle.deactivate()
  dailyList.value = []
  dailyLoading.value = false
  dailyError.value = false
  colorCache.clear()
  hoverTab.value = 'cur'
}

onActivated(activateDiscoverResources)
onDeactivated(deactivateDiscoverResources)
onBeforeUnmount(deactivateDiscoverResources)
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.page {
  height: 100%;
  overflow-y: auto;
  padding: 18px 26px 40px;
  box-sizing: border-box;
}

// ===== 正在播放：三标签（默认正方形铺满封面，hover 展开为浮岛长方形） =====
.nowPlaying {
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 22px;
  height: 92px;
}

.npTab {
  position: relative;
  flex: 0 0 92px;
  width: 92px;
  min-width: 92px;
  height: 92px;
  overflow: hidden;
  border-radius: 16px;
  color: #fff;
  cursor: default;
  box-shadow:
    0 12px 30px rgba(20, 28, 44, .18),
    inset 0 1px 0 rgba(255, 255, 255, .14);
  transition: flex-basis .45s var(--motion-ease-out), width .45s var(--motion-ease-out), min-width .45s var(--motion-ease-out);
  text-shadow: 0 1px 3px rgba(0, 0, 0, .3);
}

/* 展开态：长方形浮岛，占满剩余空间 */
.npTab.expanded {
  flex: 1 1 auto;
  width: auto;
  min-width: 260px;
}

/* 封面：默认铺满正方形，展开时缩小到左侧 */
.npCover {
  position: absolute;
  left: 0;
  top: 0;
  width: 92px;
  height: 92px;
  object-fit: cover;
  display: block;
  border-radius: 16px;
  z-index: 1;
  transition:
    width .45s var(--motion-ease-out),
    height .45s var(--motion-ease-out),
    left .45s var(--motion-ease-out),
    top .45s var(--motion-ease-out),
    border-radius .45s var(--motion-ease-out),
    box-shadow .45s var(--motion-ease-out);
}

.npCoverFallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, .16);
  color: rgba(255, 255, 255, .92);

  svg {
    fill: currentColor;
  }
}

.npTab.expanded .npCover {
  left: 14px;
  top: 50%;
  width: 64px;
  height: 64px;
  transform: translateY(-50%);
  border-radius: 12px;
  box-shadow:
    0 10px 24px rgba(0, 0, 0, .35),
    0 0 0 1px rgba(255, 255, 255, .3);
}

/* 信息区：默认隐藏，展开时从封面右侧浮现 */
.npMeta {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 0 14px 0 0;
  opacity: 0;
  transform: translateX(12px);
  transition: opacity .3s ease .08s, transform .35s var(--motion-ease-out) .08s;
  pointer-events: none;
  z-index: 0;

  strong {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* 展开态：信息占据封面右侧 */
.npTab.expanded .npMeta {
  left: 90px;
  right: 54px;
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.npLabel {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
  opacity: .88;
}

.npSinger {
  font-size: 12px;
  opacity: .82;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 播放键：默认隐藏，展开时出现在最右侧 */
.npPlay {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%) scale(.7);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, .96);
  color: var(--color-primary);
  border: none;
  cursor: pointer;
  z-index: 2;
  opacity: 0;
  pointer-events: none;
  box-shadow:
    0 10px 24px rgba(0, 0, 0, .3),
    inset 0 1px 0 rgba(255, 255, 255, .6);
  transition: opacity .3s ease .1s, transform .35s var(--motion-ease-out) .1s;

  svg {
    fill: currentColor;
  }
}

.npTab.expanded .npPlay {
  opacity: 1;
  transform: translateY(-50%) scale(1);
  pointer-events: auto;
}

.npTab.expanded .npPlay:hover {
  transform: translateY(-50%) scale(1.06);
}

.npTab.expanded .npPlay:disabled {
  opacity: .45;
  cursor: default;
}

// ===== 区块通用 =====
.section {
  margin-bottom: 20px;
}

.sectionHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.sectionTitle {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-font);
  letter-spacing: -0.01em;
}

.sectionHeadRight {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sectionSub {
  font-size: 12px;
  color: var(--color-font-label);
}

.sectionSource {
  font-size: 12px;
  color: var(--color-font-label);
}

.sectionClear {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  padding: 4px;
  color: var(--color-font-label);
  cursor: pointer;
  opacity: .7;
  transition: opacity @transition-fast, color @transition-fast;

  &:hover {
    opacity: 1;
    color: var(--color-primary-font-hover);
  }

  svg {
    fill: currentColor;
  }
}

.playAll {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  height: 30px;
  padding: 0 18px;
  border-radius: 999px;
  border: none;
  overflow: hidden;
  background: var(--color-primary);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px var(--color-primary-alpha-600), inset 0 1px 0 rgba(255, 255, 255, .35);
  transition: transform @transition-fast;

  &:hover {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: .45;
    cursor: default;
    transform: none;
  }
}

/* 从指针落点扩散的填充圆（深色对比，便于看出动画） */
.playAllFill {
  position: absolute;
  border-radius: 50%;
  background: rgba(6, 44, 30, 0.9);
  pointer-events: none;
  transition: transform .5s cubic-bezier(.16, 1, .3, 1);
}

.playAllLabel {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
  white-space: nowrap;

  svg {
    fill: currentColor;
    flex: none;
  }
}

// ===== 每日推荐：横向滚动 =====
.dailyRail {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 2px 2px 10px;
}

.dailyCard {
  flex: none;
  width: 132px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 14px;
  transition: transform @transition-normal;

  &:hover {
    transform: translateY(-4px);

    .dailyCoverWrap {
      box-shadow: 0 18px 40px rgba(20, 28, 44, .22), 0 0 0 1px rgba(255, 255, 255, .4);
    }

    .dailyOverlay {
      opacity: 1;
    }
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary-alpha-300);
    outline-offset: 3px;
  }
}

.dailyCoverWrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  background: var(--shell-card, rgba(255, 255, 255, .55));
  box-shadow: 0 10px 24px rgba(20, 28, 44, .13), 0 0 0 1px rgba(255, 255, 255, .28);
  transition: box-shadow @transition-normal;
}

.dailyCover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dailyOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 10px;
  background: linear-gradient(180deg, rgba(0, 0, 0, .3), transparent 46%);
  opacity: .8;
  transition: opacity @transition-normal;
  color: #fff;
  pointer-events: none;
}

.dailyIndex {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: .04em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .5);
}

.dailyMeta {
  padding: 9px 3px 0;
}

.dailyName {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-font);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dailySinger {
  font-size: 11.5px;
  color: var(--color-font-label);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dailyEmpty,
.dailyLocked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 34px 20px;
  border-radius: 18px;
  border: 1px dashed var(--shell-divider, rgba(73, 92, 122, .24));
  background: var(--shell-card, rgba(255, 255, 255, .4));
  color: var(--color-font-label);
  font-size: 13px;
  text-align: center;
}

.dailyEmptyIcon,
.dailyLockedIcon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-background);
  color: var(--color-primary);
  margin-bottom: 4px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent);

  svg {
    fill: currentColor;
  }
}

.dailyRefresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid var(--shell-control-border, color-mix(in srgb, var(--color-primary) 20%, rgba(255, 255, 255, .72)));
  background: var(--shell-control, color-mix(in srgb, var(--color-primary) 10%, rgba(255, 255, 255, .82)));
  color: var(--color-font);
  font-size: 13px;
  cursor: pointer;
  transition: background-color @transition-fast;

  &:hover {
    background: var(--shell-list-hover, color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, .72)));
  }

  svg {
    fill: currentColor;
  }
}

.dailyLockedTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-font);
}

.dailyLockedDesc {
  font-size: 12px;
  max-width: 380px;
  line-height: 1.6;
}

.dailyLockedBtn {
  margin-top: 8px;
  padding: 9px 24px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 10px 22px var(--color-primary-alpha-600), inset 0 1px 0 rgba(255, 255, 255, .35);
  transition: background-color @transition-fast, transform @transition-fast;

  &:hover {
    background: var(--color-primary-dark-100);
    transform: translateY(-1px);
  }
}

// ===== 搜索历史 / 热门 =====
.chipWrap {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.historyChip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.chipTop .chipRank {
  color: var(--color-primary);
  font-weight: 700;
}

.chipRank {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-font-label);
  font-variant-numeric: tabular-nums;
}

.chipText {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chipRemove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-font-label);
  opacity: .5;
  cursor: pointer;
  transition: opacity @transition-fast;

  &:hover {
    opacity: 1;
    color: var(--color-primary-font-hover);
  }

  svg {
    fill: currentColor;
  }
}

@media (prefers-reduced-motion: reduce) {
  .npTab,
  .npCover,
  .npMeta,
  .npPlay,
  .playAll,
  .playAllFill,
  .dailyCard,
  .dailyCoverWrap,
  .dailyOverlay,
  .dailyLockedBtn,
  .chipRemove {
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
}
</style>
