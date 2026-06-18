<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ info.name }}<br>{{ info.singer }}</h2>
      <template v-if="info.source === 'bili'">
        <div :class="$style.group">
          <div :class="$style.groupTitle">音质</div>
          <label v-for="quality in biliQualitys" :key="quality.type" :class="[$style.checkItem, isQualityDisabled(quality.type) ? $style.disabled : null]">
            <input type="checkbox" :checked="selectedBiliQuality == quality.type" :disabled="isQualityDisabled(quality.type)" @change="handleSelectBiliQuality(quality.type)">
            <span>{{ quality.name }}</span>
          </label>
        </div>
        <div :class="$style.group">
          <div :class="$style.groupTitle">格式</div>
          <label v-for="format in biliFormats" :key="format.type" :class="$style.checkItem">
            <input type="checkbox" :checked="selectedBiliFormat == format.type" @change="handleSelectBiliFormat(format.type)">
            <span>{{ format.name }}</span>
          </label>
        </div>
        <base-btn :class="$style.btn" :disabled="!selectedBiliQuality || biliQualityLoading" @click="handleBiliDownload">
          {{ biliQualityLoading ? '检测音质中...' : '下载' }}
        </base-btn>
      </template>
      <template v-else>
        <base-btn v-for="quality in qualitys" :key="quality.type" :class="$style.btn" :disabled="isQualityDisabled(quality.type)" @click="handleClick(quality.type)">
          {{ getTypeName(quality.type) }}{{ quality.size && ` - ${quality.size.toUpperCase()}` }}
        </base-btn>
      </template>
    </main>
  </material-modal>
</template>

<script>
import { qualityList } from '@renderer/store'
import { createDownloadTasks } from '@renderer/store/download/action'
import { getBiliMusicQualitys } from '@renderer/utils/ipc'

const BILI_DOWNLOAD_QUALITYS = ['flac24bit', '320k', '192k', '128k']
const BILI_DEFAULT_QUALITYS = {
  flac24bit: false,
  '320k': false,
  '192k': false,
  '128k': true,
}

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: [Object, null],
      required: true,
    },
    listId: {
      type: String,
      default: '',
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show'],
  setup() {
    return {
      qualityList,
    }
  },
  data() {
    return {
      selectedBiliQuality: '128k',
      selectedBiliFormat: 'mp3',
      biliAvailableQualitys: { ...BILI_DEFAULT_QUALITYS },
      biliQualityLoading: false,
    }
  },
  computed: {
    info() {
      return this.musicInfo || {}
    },
    sourceQualityList() {
      if (this.musicInfo?.source === 'bili') return BILI_DOWNLOAD_QUALITYS
      return this.qualityList[this.musicInfo.source] || []
    },
    qualitys() {
      const list = this.info.meta?.qualitys || []
      return this.info.source === 'bili' ? list : list.filter(quality => this.checkSource(quality.type))
    },
    biliQualitys() {
      return [
        { type: 'flac24bit', name: 'Hi-Res FLAC' },
        { type: '320k', name: '320K' },
        { type: '192k', name: '192K' },
        { type: '128k', name: '128K' },
      ]
    },
    biliFormats() {
      return [
        { type: 'mp3', name: 'MP3' },
        { type: 'flac', name: 'FLAC' },
        { type: 'wav', name: 'WAV' },
      ]
    },
  },
  watch: {
    show(visible) {
      if (visible && this.info.source === 'bili') void this.loadBiliQualitys()
    },
    musicInfo() {
      if (this.show && this.info.source === 'bili') void this.loadBiliQualitys()
    },
  },
  methods: {
    handleClick(quality) {
      if (this.isQualityDisabled(quality)) return
      void createDownloadTasks([this.musicInfo], quality, this.listId)
      this.handleClose()
    },
    handleClose() {
      this.$emit('update:show', false)
    },
    getBiliParams() {
      return {
        bvid: this.info.meta?.bvid || this.info.bvid || this.info.meta?.songId || this.info.songmid,
        cid: this.info.meta?.cid || this.info.cid,
        page: this.info.meta?.page || this.info.page,
        title: this.info.name,
        artist: this.info.singer,
      }
    },
    async loadBiliQualitys() {
      this.biliQualityLoading = true
      this.biliAvailableQualitys = { ...BILI_DEFAULT_QUALITYS }
      try {
        const result = await getBiliMusicQualitys(this.getBiliParams())
        this.biliAvailableQualitys = {
          ...BILI_DEFAULT_QUALITYS,
          ...result.qualitys,
        }
      } catch (err) {
        console.log(err)
      } finally {
        this.biliQualityLoading = false
        if (this.isQualityDisabled(this.selectedBiliQuality)) {
          const quality = BILI_DOWNLOAD_QUALITYS.find(type => this.biliAvailableQualitys[type])
          this.selectedBiliQuality = quality ?? ''
        }
      }
    },
    handleSelectBiliQuality(quality) {
      if (this.isQualityDisabled(quality)) return
      this.selectedBiliQuality = quality
    },
    handleSelectBiliFormat(format) {
      this.selectedBiliFormat = format
    },
    handleBiliDownload() {
      if (!this.selectedBiliQuality) return
      void createDownloadTasks([this.musicInfo], this.selectedBiliQuality, this.listId, this.selectedBiliFormat)
      this.handleClose()
    },
    getTypeName(quality) {
      if (this.info.source === 'bili') {
        switch (quality) {
          case 'flac24bit':
            return 'Hi-Res FLAC'
          case 'flac':
          case 'wav':
            return `转换 ${quality.toUpperCase()}`
          case '320k':
            return 'MP3 320K'
          case '192k':
            return 'MP3 192K'
          case '128k':
            return 'MP3 128K'
        }
      }
      switch (quality) {
        case 'flac24bit':
          return this.$t('download__lossless') + ' FLAC Hires'
        case 'flac':
        case 'ape':
        case 'wav':
          return this.$t('download__lossless') + ' ' + quality.toUpperCase()
        case '320k':
          return this.$t('download__high_quality') + ' ' + quality.toUpperCase()
        case '192k':
        case '128k':
          return this.$t('download__normal') + ' ' + quality.toUpperCase()
      }
    },
    checkSource(quality) {
      return this.sourceQualityList.includes(quality)
    },
    isQualityDisabled(quality) {
      if (this.info.source === 'bili') return !this.biliAvailableQualitys[quality]
      return !this.checkSource(quality)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  max-width: 400px;
  min-width: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  h2 {
    font-size: 13px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
    margin-bottom: 15px;
  }
}

.btn {
  display: block;
  border: none;
  background-color: color-mix(in srgb, var(--color-primary) 36%, rgba(255, 255, 255, 0.95));
  box-shadow: 0 8px 18px rgba(20, 29, 46, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.38);
  margin-bottom: 15px;

  &:hover {
    background-color: color-mix(in srgb, var(--color-primary) 46%, rgba(255, 255, 255, 0.94));
  }

  &:active {
    background-color: color-mix(in srgb, var(--color-primary) 54%, rgba(255, 255, 255, 0.92));
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.group {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  margin-bottom: 14px;
}

.groupTitle {
  font-size: 12px;
  color: var(--color-font-label);
}

.checkItem {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  color: var(--color-font);
  cursor: pointer;
  user-select: none;

  input {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
  }

  &.disabled {
    opacity: .42;
    cursor: default;

    input {
      cursor: default;
    }
  }
}

</style>
