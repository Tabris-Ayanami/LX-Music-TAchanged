<template>
  <div :class="[$style.container, { [$style.compact]: isHeaderCompact }]" :style="detailThemeStyle">
    <div :class="$style.compactHeader">
      <button type="button" :class="[$style.iconBtn, $style.playBtn]" :disabled="!!listDetailInfo.noItemLabel" :aria-label="$t('list__play')" @click.stop.prevent="handlePlay">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" space="preserve">
          <use xlink:href="#icon-play" />
        </svg>
      </button>
      <h3 :class="$style.compactTitle" :title="listDetailInfo.info.name">{{ listDetailInfo.info.name }}</h3>
      <button type="button" :class="$style.iconBtn" aria-label="Back" @click.stop.prevent="handleBack">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" space="preserve">
          <use xlink:href="#icon-back" />
        </svg>
      </button>
    </div>
    <div :class="$style.songListHeader">
      <div :class="$style.songListHeaderLeft" :style="{ backgroundImage: coverBackgroundImage }">
        <!-- <span v-if="listDetailInfo.info.play_count" :class="$style.playNum">{{ listDetailInfo.info.play_count }}</span> -->
      </div>
      <div :class="$style.songListHeaderMiddle">
        <h3 :title="listDetailInfo.info.name">{{ listDetailInfo.info.name }}</h3>
        <p :title="listDetailInfo.info.desc">{{ listDetailInfo.info.desc }}</p>
      </div>
      <div :class="$style.songListHeaderRight">
        <button
          type="button"
          :class="[$style.iconBtn, $style.playBtn]"
          :disabled="!!listDetailInfo.noItemLabel"
          :aria-label="$t('list__play')"
          @click.stop.prevent="handlePlay"
        >
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-play" />
          </svg>
        </button>
        <button
          type="button"
          :class="[$style.iconBtn, $style.loveBtn]"
          :disabled="!!listDetailInfo.noItemLabel"
          :aria-label="$t('list__collect')"
          @click.stop.prevent="handleCollect"
        >
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 444 392" space="preserve">
            <use xlink:href="#icon-love" />
          </svg>
        </button>
        <button type="button" :class="[$style.iconBtn, $style.backBtn]" aria-label="Back" @click.stop.prevent="handleBack">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" space="preserve">
            <use xlink:href="#icon-back" />
          </svg>
        </button>
      </div>
    </div>
    <div :class="$style.list">
      <material-online-list
        ref="listRef"
        :page="listDetailInfo.page"
        :limit="listDetailInfo.limit"
        :total="listDetailInfo.total"
        :list="listDetailInfo.list"
        :no-item="listDetailInfo.noItemLabel"
        @play-list="handlePlayList"
        @toggle-page="togglePage"
        @scroll="handleListScroll"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, onBeforeUnmount, ref, watch } from '@common/utils/vueTools'
import { listDetailInfo } from '@renderer/store/songList/state'
import { setVisibleListDetail } from '@renderer/store/songList/action'
import { useRouter } from '@common/utils/vueRouter'
import { addSongListDetail, playSongListDetail } from './action'
import useList from './useList'
import useKeyBack from './useKeyBack'


const source = ref<LX.OnlineSource>('kw')
const id = ref<string>('')
const page = ref<number>(1)
const picUrl = ref<string>('')
const refresh = ref<boolean>(false)

interface SongListThemeColors {
  base: string
  deep: string
  light: string
  edge: string
}

const DEFAULT_SONG_LIST_COLORS: SongListThemeColors = {
  base: '38, 112, 142',
  deep: '10, 28, 36',
  light: '116, 184, 212',
  edge: '224, 233, 246',
}

const toCssUrl = (value: string) => `url("${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const mixColor = (source: number[], target: number[], ratio: number) => source.map((value, index) => clampChannel(value * (1 - ratio) + target[index] * ratio))
const toRgbText = (rgb: number[]) => rgb.map(clampChannel).join(', ')
const getColorScore = (red: number, green: number, blue: number) => {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const saturation = max ? (max - min) / max : 0
  const lightness = (max + min) / 510
  return 0.45 + saturation * 2 + (1 - Math.min(1, Math.abs(lightness - 0.52) * 1.8)) * 0.75
}
const createColorBucket = () => ({
  red: 0,
  green: 0,
  blue: 0,
  totalWeight: 0,
})
const addColorToBucket = (bucket: ReturnType<typeof createColorBucket>, red: number, green: number, blue: number, alpha: number, weightMultiplier = 1) => {
  if (alpha < 42) return
  const weight = getColorScore(red, green, blue) * (alpha / 255) * weightMultiplier
  bucket.red += red * weight
  bucket.green += green * weight
  bucket.blue += blue * weight
  bucket.totalWeight += weight
}
const getBucketColor = (bucket: ReturnType<typeof createColorBucket>) => {
  if (!bucket.totalWeight) return null
  return [bucket.red / bucket.totalWeight, bucket.green / bucket.totalWeight, bucket.blue / bucket.totalWeight].map(clampChannel)
}
const extractSongListColors = async(pic: string): Promise<SongListThemeColors> => {
  if (!pic) return DEFAULT_SONG_LIST_COLORS
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 36
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve(DEFAULT_SONG_LIST_COLORS)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        const coverBucket = createColorBucket()
        const edgeBucket = createColorBucket()
        for (let pixelIndex = 0; pixelIndex < size * size; pixelIndex += 4) {
          const dataIndex = pixelIndex * 4
          const row = Math.floor(pixelIndex / size)
          addColorToBucket(coverBucket, data[dataIndex], data[dataIndex + 1], data[dataIndex + 2], data[dataIndex + 3])
          if (row >= size - 6) {
            addColorToBucket(edgeBucket, data[dataIndex], data[dataIndex + 1], data[dataIndex + 2], data[dataIndex + 3], 1 + (row - (size - 6)) * 0.16)
          }
        }
        const base = getBucketColor(coverBucket)
        if (!base) {
          resolve(DEFAULT_SONG_LIST_COLORS)
          return
        }
        const edge = getBucketColor(edgeBucket) ?? base
        resolve({
          base: toRgbText(mixColor(base, [44, 128, 156], 0.16)),
          deep: toRgbText(mixColor(base, [7, 12, 18], 0.62)),
          light: toRgbText(mixColor(base, [234, 248, 255], 0.36)),
          edge: toRgbText(mixColor(edge, [238, 244, 252], 0.24)),
        })
      } catch (error) {
        resolve(DEFAULT_SONG_LIST_COLORS)
      }
    }
    img.onerror = () => {
      resolve(DEFAULT_SONG_LIST_COLORS)
    }
    img.src = pic
  })
}


interface Query {
  source?: string
  id?: string
  page?: string
  picUrl?: string
  refresh?: 'true'
  fromName?: string
}

const verifyQueryParams = async function(this: any, to: { query: Query, path: string }, from: any, next: (route?: { path: string, query: Query }) => void) {
  let _source = to.query.source
  let _id = to.query.id
  let _page: string | undefined = to.query.page
  let _picUrl: string | undefined = to.query.picUrl
  let _refresh: 'true' | undefined = to.query.refresh

  if (_source == null || _id == null) {
    if (listDetailInfo.key) {
      _source = listDetailInfo.source
      _id = listDetailInfo.id
      _page = listDetailInfo.page.toString()
      _picUrl = listDetailInfo.info.img
    } else {
      setVisibleListDetail(false)
      next({ path: '/songList/list', query: {} })
      return
    }

    next({
      path: to.path,
      query: { ...to.query, source: _source, id: _id, page: _page, picUrl: _picUrl, refresh: _refresh },
    })
    return
  }
  next()
  setVisibleListDetail(true)
  source.value = _source as LX.OnlineSource
  id.value = _id
  page.value = _page ? parseInt(_page) : 1
  picUrl.value = _picUrl ?? ''
  refresh.value = _refresh ? _refresh == 'true' : false
  if (to.query.fromName) window.lx.songListInfo.fromName = to.query.fromName
}


export default {
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const router = useRouter()
    const isHeaderCompact = ref(false)
    const songListThemeColors = ref<SongListThemeColors>(DEFAULT_SONG_LIST_COLORS)
    let themeRequestId = 0
    let isUnmounted = false

    const {
      listRef,
      listDetailInfo,
      getListData,
      handlePlayList,
    } = useList()


    const togglePage = (page: number) => {
      void getListData(source.value, id.value, page, refresh.value)
    }

    const listCoverUrl = computed(() => picUrl.value ? picUrl.value : (listDetailInfo.info.img ?? ''))
    const coverBackgroundImage = computed(() => listCoverUrl.value ? toCssUrl(listCoverUrl.value) : 'none')
    const detailThemeStyle = computed(() => ({
      '--song-list-cover': coverBackgroundImage.value,
      '--song-list-color-base': songListThemeColors.value.base,
      '--song-list-color-deep': songListThemeColors.value.deep,
      '--song-list-color-light': songListThemeColors.value.light,
      '--song-list-color-edge': songListThemeColors.value.edge,
    }))

    const handlePlay = () => {
      if (listDetailInfo.noItemLabel) return
      void playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list)
    }
    const handleCollect = () => {
      if (listDetailInfo.noItemLabel) return
      void addSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.info.name)
    }
    const handleBack = () => {
      setVisibleListDetail(false)
      if (window.lx.songListInfo.fromName) void router.replace({ name: window.lx.songListInfo.fromName })
      else router.back()
    }
    const handleListScroll = (event: Event) => {
      const target = event.target as HTMLElement | null
      isHeaderCompact.value = !!target && target.scrollTop > 48
    }

    useKeyBack(handleBack)

    watch(listCoverUrl, async cover => {
      const requestId = ++themeRequestId
      const colors = await extractSongListColors(cover)
      if (isUnmounted || requestId != themeRequestId) return
      songListThemeColors.value = colors
    }, {
      immediate: true,
    })

    watch([source, id, page, refresh], async([_source, _id, _page, _refresh]) => {
      if (!_source || !_id) return router.replace({ path: '/songList/list' })
      // console.log(_source, _id, _page, _refresh, picUrl.value)
      // source.value = _source
      // id.value = _id
      // refresh.value = _refresh
      // page.value = _page ?? 1
      void getListData(_source, _id, _page, _refresh)
    }, {
      immediate: true,
    })

    onBeforeUnmount(() => {
      isUnmounted = true
      themeRequestId++
    })

    return {
      source,
      id,
      page,
      picUrl,
      detailThemeStyle,
      coverBackgroundImage,
      isHeaderCompact,
      listDetailInfo,
      listRef,
      togglePage,
      handlePlay,
      handleCollect,
      handlePlayList,
      handleListScroll,
      handleBack,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  --song-list-color-base: 38, 112, 142;
  --song-list-color-deep: 10, 28, 36;
  --song-list-color-light: 116, 184, 212;
  --song-list-color-edge: 224, 233, 246;
  position: relative;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  color: var(--color-font);
  background: var(--color-content-background);
}

.compactHeader {
  position: relative;
  z-index: 1;
  flex: none;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 18px;
  height: 0;
  padding: 0 28px;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--color-content-background);
  border-bottom: 1px solid rgba(255, 255, 255, .34);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  transition: height .24s ease, opacity .2s ease;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  &::before {
    background-image: var(--song-list-cover);
    background-position: center 34%;
    background-size: cover;
    filter: blur(28px) saturate(150%);
    opacity: .62;
    transform: scale(1.08);
  }

  &::after {
    background:
      linear-gradient(90deg, rgba(255, 255, 255, .42), rgba(255, 255, 255, .16) 48%, rgba(255, 255, 255, .26)),
      linear-gradient(180deg, color-mix(in srgb, var(--color-content-background) 48%, rgba(var(--song-list-color-edge), .26)), color-mix(in srgb, var(--color-content-background) 72%, rgba(var(--song-list-color-light), .2)));
  }
}

.compactTitle {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: auto;
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  color: var(--color-font);
  .mixin-ellipsis-1();
}

.compact {
  .compactHeader {
    height: 72px;
    opacity: 1;
    pointer-events: auto;
  }
  .songListHeader {
    height: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
    pointer-events: none;
  }
  .list {
    padding-top: 0;
    background: var(--color-content-background);
  }
}

.songListHeader {
  position: relative;
  z-index: 2;
  flex: none;
  box-sizing: border-box;
  display: flex;
  flex-flow: row nowrap;
  align-items: flex-start;
  gap: 28px;
  height: 268px;
  padding: 28px 30px 0;
  overflow: hidden;
  background: var(--color-content-background);
  transition: height .24s ease, padding .24s ease, opacity .18s ease;
  isolation: isolate;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    pointer-events: none;
  }

  &::before {
    z-index: 0;
    background-image: var(--song-list-cover);
    background-position: center top;
    background-size: cover;
    filter: blur(40px) saturate(152%);
    opacity: .72;
    transform: scale(1.09);
    -webkit-mask-image: linear-gradient(
      180deg,
      #000 0%,
      #000 34%,
      rgba(0, 0, 0, .86) 48%,
      rgba(0, 0, 0, .55) 64%,
      rgba(0, 0, 0, .2) 80%,
      transparent 100%
    );
    mask-image: linear-gradient(
      180deg,
      #000 0%,
      #000 34%,
      rgba(0, 0, 0, .86) 48%,
      rgba(0, 0, 0, .55) 64%,
      rgba(0, 0, 0, .2) 80%,
      transparent 100%
    );
  }

  &::after {
    z-index: 0;
    background:
      radial-gradient(circle at 20% 12%, rgba(255, 255, 255, .28), transparent 34%),
      radial-gradient(circle at 82% 16%, rgba(var(--song-list-color-light), .2), transparent 32%),
      linear-gradient(
        180deg,
        rgba(255, 255, 255, .28) 0%,
        rgba(255, 255, 255, .18) 32%,
        rgba(255, 255, 255, .08) 54%,
        transparent 76%,
        transparent 100%
      );
    -webkit-mask-image: linear-gradient(
      180deg,
      #000 0%,
      rgba(0, 0, 0, .86) 46%,
      rgba(0, 0, 0, .36) 70%,
      transparent 100%
    );
    mask-image: linear-gradient(
      180deg,
      #000 0%,
      rgba(0, 0, 0, .86) 46%,
      rgba(0, 0, 0, .36) 70%,
      transparent 100%
    );
  }
}
.songListHeaderLeft {
  z-index: 1;
  flex: none;
  height: 176px;
  aspect-ratio: 1 / 1;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background-position: center;
  background-size: cover;
  box-shadow: 0 24px 46px rgba(0, 0, 0, .34);
}
.playNum {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px;
  background-color: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 12px;
  text-align: right;
  .mixin-ellipsis-1();
}

.songListHeaderMiddle {
  position: relative;
  z-index: 1;
  flex: auto;
  margin-top: 78px;
  padding: 0 150px 0 0;
  min-width: 0;
  h3 {
    .mixin-ellipsis-1();
    line-height: 1.14;
    padding-bottom: 8px;
    font-size: 48px;
    font-weight: 800;
    color: rgba(255, 255, 255, .96);
  }
  p {
    .mixin-ellipsis(3);
    max-width: 760px;
    font-size: 14px;
    line-height: 1.55;
    color: rgba(255, 255, 255, .78);
  }
}
.songListHeaderRight {
  position: relative;
  z-index: 1;
  flex: none;
  display: flex;
  gap: 12px;
  align-items: center;
  align-self: flex-start;
  margin-left: -140px;
  margin-top: 162px;
}

.iconBtn {
  flex: none;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  color: var(--color-font);
  background: rgba(255, 255, 255, .34);
  box-shadow: 0 12px 28px rgba(0, 0, 0, .16), inset 0 0 0 1px rgba(255, 255, 255, .38);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  cursor: pointer;
  transition: transform .16s ease, background-color .16s ease, box-shadow .16s ease;
  svg {
    width: 24px;
    height: 24px;
    display: block;
    margin: auto;
    pointer-events: none;
  }
  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, .46);
  }
  &:active {
    transform: translateY(0) scale(.96);
  }
  &:disabled {
    opacity: .45;
    cursor: default;
    transform: none;
  }
}
.playBtn {
  width: 64px;
  height: 64px;
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 16px 34px color-mix(in srgb, var(--color-primary) 32%, transparent);
  svg {
    width: 30px;
    height: 30px;
    transform: translateX(2px);
  }
  &:hover {
    background: color-mix(in srgb, var(--color-primary) 86%, white 14%);
  }
}
.loveBtn {
  svg {
    width: 27px;
    height: 27px;
  }
}
.backBtn {
  svg {
    width: 26px;
    height: 26px;
  }
}
.compactHeader {
  .playBtn {
    position: relative;
    z-index: 1;
    width: 52px;
    height: 52px;
    svg {
      width: 25px;
      height: 25px;
      transform: translateX(1.5px);
    }
  }

  .iconBtn {
    position: relative;
    z-index: 1;
  }
}

.list {
  z-index: 1;
  position: relative;
  width: 100%;
  min-height: 0;
  flex: auto;
  height: 100%;
  padding: 0 20px 18px;
  background: var(--color-content-background);
  :global(.thead) {
    color: var(--color-font-label);
    background: var(--color-content-background);
    border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 12%, rgba(120, 140, 170, .16));
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  :global(.list-item) {
    color: var(--color-font);
    border-radius: 6px;
  }
  :global(.list-item-cell) {
    color: var(--color-font-label);
  }
  :global(.name) {
    color: var(--color-font);
  }
}
</style>
