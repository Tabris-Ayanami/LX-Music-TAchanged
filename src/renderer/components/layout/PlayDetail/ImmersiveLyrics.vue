<template>
  <section
    :class="[$style.immersive, $style[`effect-${effect}`], { [$style.controlsVisible]: controlsVisible }]"
    :style="immersiveStyle"
    :aria-label="$t('player__immersive_mode')"
    @mousemove="handlePointerMove"
    @touchstart="showControls"
  >
    <div :class="$style.windowDragRegion" aria-hidden="true" />
    <div v-if="background == 'aura'" :class="$style.aurora" aria-hidden="true">
      <i :class="$style.orbOne" />
      <i :class="$style.orbTwo" />
      <i :class="$style.noise" />
    </div>
    <div
      v-else-if="background == 'mv'"
      :class="[$style.mvBackground, { [$style.mvReady]: mvUrl }]"
      aria-hidden="true"
    >
      <div :class="$style.mvFallback" :style="blurBackgroundStyle" />
      <video
        v-if="mvUrl"
        ref="mvVideo"
        :src="mvUrl"
        muted
        playsinline
        preload="auto"
        disablepictureinpicture
        @loadedmetadata="syncMvPlayback"
        @canplay="syncMvPlayback"
        @error="mvUrl = ''"
      />
      <i :class="$style.mvShade" />
    </div>
    <div
      v-else
      :class="$style.blurBackground"
      :style="blurBackgroundStyle"
      aria-hidden="true"
    />

    <FoliaVisualizerHost
      :effect="effect"
      :lines="foliaLines"
      :current-line-index="lyric.line"
      :playing="isPlay"
      :cover-url="musicInfo.pic"
      :song-title="songName"
      :song-artist="artist"
      :song-album="musicInfo.album"
      :seed="musicInfo.id"
    />

    <common-audio-visualizer
      v-if="appSetting['common.isShowAnimation'] && appSetting['playDetail.immersiveAudioVisualization']"
      :key="visualizerMode"
      :variant="visualizerMode == 'ambient' ? 'ambient' : 'bottom'"
      :mode="visualizerMode"
      :class="[$style.visualizer, { [$style.visualizerPaused]: !isPlay }]"
      aria-hidden="true"
    />

    <footer :class="$style.controlsDock" @mouseenter="showControls" @mouseleave="scheduleHideControls">
      <button
        type="button"
        :class="$style.progressTrack"
        :aria-label="$t('player__seek')"
        @click.stop="handleSeek"
      >
        <i :style="{ transform: `scaleX(${songProgress})` }" />
      </button>
      <div :class="$style.controlRow">
        <div :class="$style.leftActions">
          <PlayQueueBtn :class="$style.queueControl" placement="left" variant="detail" />
          <button type="button" :class="$style.controlIcon" :aria-label="$t('player__sound_effect')" :title="$t('player__sound_effect')" @click.stop="soundPanelVisible = true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-sliders-modern" /></svg>
          </button>
          <button
            ref="closeButton"
            type="button"
            :class="$style.controlIcon"
            :aria-label="$t('player__immersive_exit')"
            :title="$t('player__immersive_exit')"
            @click="$emit('close')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7" /></svg>
          </button>
        </div>
        <div :class="$style.transport">
          <button type="button" :aria-label="$t('player__prev')" @click.stop="playPrev()">
            <svg viewBox="0 0 134 134" aria-hidden="true"><use xlink:href="#icon-amll-rewind" /></svg>
          </button>
          <button type="button" :class="$style.playButton" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click.stop="togglePlay()">
            <svg v-if="isPlay" viewBox="0 0 38 38" aria-hidden="true"><use xlink:href="#icon-amll-pause" /></svg>
            <svg v-else viewBox="0 0 38 38" aria-hidden="true"><use xlink:href="#icon-amll-play" /></svg>
          </button>
          <button type="button" :aria-label="$t('player__next')" @click.stop="playNext()">
            <svg viewBox="0 0 134 134" aria-hidden="true"><use xlink:href="#icon-amll-forward" /></svg>
          </button>
        </div>
        <div :class="$style.trackInfo">
          <button type="button" :class="$style.controlIcon" :aria-label="$t('setting__play_detail_immersive_source')" :title="$t('setting__play_detail_immersive_source')" @click.stop="sourcePanelVisible = true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7.5 7h10m0 0-3-3m3 3-3 3M16.5 17h-10m0 0 3 3m-3-3 3-3" />
            </svg>
          </button>
          <button type="button" :class="[$style.controlIcon, $style.settingsControl]" :aria-label="$t('player__immersive_lyric_style')" :title="$t('player__immersive_lyric_style')" @click.stop="stylePanelVisible = true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><use xlink:href="#icon-tune-modern" /></svg>
          </button>
          <div :class="$style.songMeta">
            <strong>{{ songName }}</strong>
            <span v-if="artist">{{ artist }}</span>
          </div>
          <img v-if="musicInfo.pic" :class="$style.coverThumb" :src="musicInfo.pic" alt="" decoding="async">
          <span v-else :class="$style.coverPlaceholder" aria-hidden="true">
            <svg viewBox="0 0 24 24"><use xlink:href="#icon-album" /></svg>
          </span>
        </div>
      </div>
    </footer>
    <ImmersiveSoundPanel v-model:show="soundPanelVisible" />
    <ImmersiveStylePanel v-model:show="stylePanelVisible" />
    <ImmersiveSourcePanel
      v-model:show="sourcePanelVisible"
      :title="trackIdentity.title"
      :artist="trackIdentity.artist"
      :duration="playProgress.maxPlayTime"
      :bili-track="biliTrack"
      :mv-status="mvStatus"
      :mv-error="mvError"
      :active-mv-key="activeMvKey"
      @select-mv="selectMvCandidate"
      @select-lyric="selectLyricCandidate"
      @retry-mv="loadMv"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import FoliaVisualizerHost from './FoliaVisualizerHost.vue'
import ImmersiveSoundPanel from './ImmersiveSoundPanel.vue'
import ImmersiveStylePanel from './ImmersiveStylePanel.vue'
import ImmersiveSourcePanel from './ImmersiveSourcePanel.vue'
import PlayQueueBtn from './components/PlayQueueBtn.vue'
import { playNext, playPrev, togglePlay } from '@renderer/core/player'
import { getCurrentTime } from '@renderer/plugins/player'
import { lyric } from '@renderer/store/player/lyric'
import { playProgress } from '@renderer/store/player/playProgress'
import { isPlay, musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { setMusicInfo } from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import { biliSearch, getBiliLyricSource, getBiliVideoUrl } from '@renderer/utils/ipc'

defineEmits(['close'])

const closeButton = ref()
const controlsVisible = ref(false)
const soundPanelVisible = ref(false)
const stylePanelVisible = ref(false)
const sourcePanelVisible = ref(false)
const mvVideo = ref()
const mvUrl = ref('')
const mvOverride = ref(null)
const mvStatus = ref('idle')
const mvError = ref('')
const activeMvKey = ref('')
const originalLyric = ref(null)
let originalLyricTrackId = ''
let lyricRequestId = 0
let hideTimer = 0
let mvRequestId = 0
let mvSyncTimer = 0

const effect = computed(() => appSetting['playDetail.immersiveEffect'] ?? 'classic')
const background = computed(() => appSetting['playDetail.immersiveBackground'] ?? 'aura')
const visualizerMode = computed(() => appSetting['playDetail.immersiveAudioVisualizationStyle'] ?? 'wave')
const controlHideDelay = computed(() => {
  const seconds = Number(appSetting['playDetail.immersiveControlHideDelay'] ?? 3)
  return Math.min(10, Math.max(1, Number.isFinite(seconds) ? seconds : 3)) * 1000
})
const immersiveStyle = computed(() => ({
  '--immersive-visualizer-height': `${appSetting['playDetail.immersiveAudioVisualizationHeight'] ?? 112}px`,
  '--immersive-background-blur': `${appSetting['playDetail.immersiveBackgroundBlur'] ?? 32}px`,
}))
const blurBackgroundStyle = computed(() => ({
  backgroundImage: musicInfo.pic ? `url("${String(musicInfo.pic).replace(/"/g, '\\"')}")` : undefined,
}))
const biliTrack = computed(() => {
  const track = playMusicInfo.musicInfo
  if (track?.source != 'bili' || !track.meta?.bvid) return null
  return {
    bvid: track.meta.bvid,
    cid: track.meta.cid,
    page: track.meta.page,
    title: track.name,
    artist: track.singer,
  }
})
const biliTrackKey = computed(() => {
  const track = biliTrack.value
  return track ? `${track.bvid}:${track.cid ?? track.page ?? 1}` : ''
})

const searchBiliTrack = async() => {
  const identity = trackIdentity.value
  const query = [identity.title, identity.artist].filter(Boolean).join(' ')
  if (!query) return null
  const result = await biliSearch({ keyword: query, page: 1, limit: 8 })
  const normalizedTitle = normalizeMatchText(identity.title)
  const normalizedArtist = normalizeMatchText(identity.artist)
  const targetDuration = Number(playProgress.maxPlayTime || 0)
  return [...(result.list ?? [])].sort((a, b) => scoreMvCandidate(b, normalizedTitle, normalizedArtist, targetDuration) - scoreMvCandidate(a, normalizedTitle, normalizedArtist, targetDuration))[0] ?? null
}

const normalizeMatchText = value => String(value ?? '')
  .toLocaleLowerCase()
  .replace(/【[^】]*】|\[[^\]]*]|\([^)]*\)/g, ' ')
  .replace(/[\s\-_·•｜|/\\]+/g, '')

const scoreMvCandidate = (candidate, title, artistName, duration) => {
  const candidateTitle = normalizeMatchText([candidate.title, candidate.videoTitle, candidate.pageTitle].filter(Boolean).join(' '))
  const candidateArtist = normalizeMatchText(candidate.author)
  let score = 0
  if (title && candidateTitle == title) score += 120
  else if (title && candidateTitle.includes(title)) score += 82
  else if (title?.includes(candidateTitle)) score += 55
  if (artistName && candidateArtist.includes(artistName)) score += 42
  if (duration && candidate.duration) score += Math.max(0, 30 - Math.abs(duration - Number(candidate.duration)) * 2)
  if (/\b(mv|music video|official)\b/i.test(String(candidate.title))) score += 14
  return score
}

const resolveMvTrack = async() => {
  if (mvOverride.value) return mvOverride.value
  const source = appSetting['playDetail.immersiveMvSource'] ?? 'auto'
  if (source == 'current') return biliTrack.value
  if (biliTrack.value) return biliTrack.value
  return searchBiliTrack()
}

const syncMvPlayback = async() => {
  const video = mvVideo.value
  if (!video || !mvUrl.value) return
  const playerTime = getCurrentTime()
  if (Number.isFinite(video.duration) && Math.abs(video.currentTime - playerTime) > 0.45) {
    video.currentTime = Math.min(Math.max(playerTime, 0), Math.max(0, video.duration - 0.05))
  }
  if (isPlay.value) {
    if (video.paused) await video.play().catch(() => {})
  } else if (!video.paused) {
    video.pause()
  }
}

const loadMv = async() => {
  const requestId = ++mvRequestId
  mvStatus.value = 'loading'
  mvError.value = ''
  const track = await resolveMvTrack().catch(() => null)
  if (background.value != 'mv') {
    mvStatus.value = 'idle'
    return
  }
  if (!track) {
    mvUrl.value = ''
    activeMvKey.value = ''
    mvStatus.value = 'error'
    mvError.value = window.i18n.t('setting__play_detail_immersive_mv_no_track')
    return
  }
  try {
    // Vue refs expose nested objects as reactive proxies. Structured clone used
    // by Electron IPC cannot clone those proxies, so keep the IPC boundary
    // explicitly serializable.
    const requestTrack = {
      bvid: String(track.bvid ?? ''),
      cid: track.cid == null ? undefined : Number(track.cid),
      page: track.page == null ? undefined : Number(track.page),
      title: track.title == null ? undefined : String(track.title),
      artist: track.artist == null ? undefined : String(track.artist),
      duration: track.duration == null ? undefined : Number(track.duration),
    }
    if (!requestTrack.bvid) throw new Error(window.i18n.t('setting__play_detail_immersive_mv_no_track'))
    const result = await getBiliVideoUrl(requestTrack)
    if (requestId != mvRequestId || background.value != 'mv') return
    mvUrl.value = result.url
    activeMvKey.value = `${track.bvid}:${track.cid ?? track.page ?? 1}`
    mvStatus.value = 'ready'
    await nextTick()
    await syncMvPlayback()
  } catch (err) {
    if (requestId == mvRequestId) {
      mvUrl.value = ''
      activeMvKey.value = ''
      mvStatus.value = 'error'
      mvError.value = err instanceof Error ? err.message : String(err)
      console.warn('[ImmersiveLyrics] Bilibili MV unavailable, using album background', err)
    }
  }
}

const selectMvCandidate = candidate => {
  mvOverride.value = {
    bvid: candidate.bvid,
    cid: candidate.cid,
    page: candidate.page,
    title: candidate.title,
    artist: candidate.author,
  }
  mvStatus.value = 'loading'
  mvError.value = ''
  void loadMv()
}

const selectLyricCandidate = candidate => {
  lyricRequestId += 1
  rememberOriginalLyric()
  setMusicInfo({
    lrc: candidate.lyrics.lyric,
    tlrc: candidate.lyrics.tlyric ?? null,
    rlrc: candidate.lyrics.rlyric ?? null,
    lxlrc: candidate.lyrics.lxlyric ?? null,
    rawlrc: candidate.lyrics.lyric,
  })
  window.app_event.lyricUpdated()
}

const rememberOriginalLyric = () => {
  if (!musicInfo.id || originalLyricTrackId == musicInfo.id) return
  originalLyricTrackId = musicInfo.id
  originalLyric.value = {
    lrc: musicInfo.lrc,
    tlrc: musicInfo.tlrc,
    rlrc: musicInfo.rlrc,
    lxlrc: musicInfo.lxlrc,
    rawlrc: musicInfo.rawlrc,
  }
}

const applyLyricSource = async() => {
  const requestId = ++lyricRequestId
  const source = appSetting['playDetail.immersiveLyricSource'] ?? 'auto'
  rememberOriginalLyric()
  if (source == 'current') {
    if (originalLyric.value) {
      setMusicInfo(originalLyric.value)
      window.app_event.lyricUpdated()
    }
    return
  }
  let candidate = biliTrack.value
  if ((source == 'bili' || source == 'auto') && !candidate) {
    candidate = await searchBiliTrack().catch(() => null)
  }
  const result = await getBiliLyricSource({
    source: source == 'current' ? 'auto' : source,
    bvid: candidate?.bvid,
    cid: candidate?.cid,
    page: candidate?.page,
    title: trackIdentity.value.title,
    artist: trackIdentity.value.artist,
    duration: playProgress.maxPlayTime || null,
  }).catch(() => null)
  if (requestId != lyricRequestId || !result?.lyric) return
  setMusicInfo({
    lrc: result.lyric,
    tlrc: result.tlyric ?? null,
    rlrc: result.rlyric ?? null,
    lxlrc: result.lxlyric ?? null,
    rawlrc: result.lyric,
  })
  window.app_event.lyricUpdated()
}

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const lineTimeExp = /^(?:\[[\d:.]+\])+/g
const wordTimeExp = /<(\d+),(\d+)>/g

const parseWordLines = source => {
  if (!source) return []
  const result = []
  for (const rawLine of source.split(/\r\n|\r|\n/)) {
    const timeLabel = rawLine.match(lineTimeExp)?.[0]
    if (!timeLabel) continue
    const matches = [...rawLine.matchAll(wordTimeExp)]
    if (!matches.length) continue

    const timeText = timeLabel.match(/[\d:.]+/)?.[0] ?? '0'
    const parts = timeText.split(':').map(Number)
    const lineTime = parts.reduce((total, part) => total * 60 + part, 0) * 1000
    const words = matches.map((match, index) => {
      const textStart = (match.index ?? 0) + match[0].length
      const textEnd = matches[index + 1]?.index ?? rawLine.length
      return {
        text: rawLine.slice(textStart, textEnd),
        start: Number(match[1]),
        duration: Math.max(80, Number(match[2])),
      }
    }).filter(word => word.text)

    if (!words.length) continue
    const usesAbsoluteTime = lineTime > 1500 && words[0].start > lineTime - 1200
    if (usesAbsoluteTime) {
      for (const word of words) word.start = Math.max(0, word.start - lineTime)
    }
    result.push({ lineTime, text: words.map(word => word.text).join(''), words })
  }
  return result
}

const timedLines = computed(() => parseWordLines(musicInfo.lxlrc))

const splitFallbackText = text => {
  if (!text) return []
  if (typeof Intl?.Segmenter == 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    return [...segmenter.segment(text)].map(item => item.segment).filter(Boolean)
  }
  return text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]|\s+|[^\s\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g) ?? [text]
}

const normalizeLineText = text => String(text ?? '').replace(/\s+/g, '').trim()
const foliaLines = computed(() => lyric.lines.map((line, index) => {
  const startTime = Math.max(0, Number(line.time) / 1000)
  const nextLineTime = Number(lyric.lines[index + 1]?.time)
  const endTime = Number.isFinite(nextLineTime)
    ? Math.max(startTime + 0.12, nextLineTime / 1000)
    : startTime + 4.2
  const normalizedText = String(line.text ?? '')
  const timedLine = timedLines.value.find(item => Math.abs(item.lineTime - line.time) < 700) ??
    timedLines.value.find(item => normalizeLineText(item.text) == normalizeLineText(normalizedText))
  const chunks = timedLine?.words?.length
    ? timedLine.words.map(word => ({
      text: word.text,
      startTime: startTime + word.start / 1000,
      endTime: Math.min(endTime, startTime + (word.start + word.duration) / 1000),
    }))
    : splitFallbackText(normalizedText).map((text, wordIndex, words) => {
      const duration = Math.max(0.12, endTime - startTime)
      const wordDuration = duration / Math.max(1, words.length)
      const wordStart = startTime + wordIndex * wordDuration
      return {
        text,
        startTime: wordStart,
        endTime: Math.min(endTime, wordStart + wordDuration),
      }
    })
  const alternateLyrics = (line.extendedLyrics ?? []).filter(text => /[\p{L}\p{N}]/u.test(text))

  return {
    id: `${musicInfo.id ?? 'music'}-${index}-${line.time}`,
    words: chunks.length
      ? chunks
      : [{ text: normalizedText || '…', startTime, endTime }],
    startTime,
    endTime,
    fullText: normalizedText || '…',
    translation: alternateLyrics[0],
    romanization: alternateLyrics[1],
    alternateTexts: alternateLyrics.map((text, alternateIndex) => ({
      role: alternateIndex == 0 ? 'translation' : alternateIndex == 1 ? 'romanization' : `alternate-${alternateIndex}`,
      text,
    })),
  }
}))
const songName = computed(() => musicInfo.name ?? '')
const artist = computed(() => musicInfo.singer ?? '')
const trackIdentity = computed(() => {
  const rawTitle = String(songName.value ?? '').trim()
  const rawArtist = String(artist.value ?? '').trim()
  let title = rawTitle
    .replace(/^\s*(?:\[[^\]]*\]|【[^】]*】)\s*/u, '')
    .trim()
  let parsedArtist = ''
  const bracketMatch = title.match(/[《「『](.+?)[》」』]/u)
  if (bracketMatch) {
    const prefix = title.slice(0, bracketMatch.index ?? 0)
    const separatorMatch = prefix.match(/(.+?)\s*[-—–:：]\s*$/u)
    if (separatorMatch) parsedArtist = separatorMatch[1].trim()
    title = bracketMatch[1].trim()
  } else {
    const separatorMatch = title.match(/^(.{1,40}?)\s*[-—–:：]\s*(.+)$/u)
    if (separatorMatch) {
      parsedArtist = separatorMatch[1].trim()
      title = separatorMatch[2].trim()
    }
  }
  title = title
    .replace(/\s+(?:MV|PV|音乐视频|官方(?:音乐)?视频|完整版|字幕版|中字|4K|8K|1080P)\b.*$/iu, '')
    .replace(/\s+/g, ' ')
    .trim()
  const uploaderLike = !rawArtist ||
    /^(?:cuber[_\s-]?w|user\d+|official|官方|音乐频道|音乐无限)$/iu.test(rawArtist) ||
    /[_-]/u.test(rawArtist)
  return {
    title: title || rawTitle,
    artist: uploaderLike && parsedArtist ? parsedArtist : rawArtist,
  }
})
const songProgress = computed(() => clamp(playProgress.progress))

const showControls = () => {
  window.clearTimeout(hideTimer)
  controlsVisible.value = true
  scheduleHideControls()
}

const scheduleHideControls = () => {
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    controlsVisible.value = false
  }, controlHideDelay.value)
}

const handlePointerMove = event => {
  if (event.clientY >= window.innerHeight - 112) showControls()
  else if (controlsVisible.value) scheduleHideControls()
}

const handleSeek = event => {
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width || !playProgress.maxPlayTime) return
  const progress = clamp((event.clientX - rect.left) / rect.width)
  window.app_event.setProgress(progress * playProgress.maxPlayTime)
  showControls()
  scheduleHideControls()
}

const handleKeydown = event => {
  if (event.key != 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  if (soundPanelVisible.value) {
    soundPanelVisible.value = false
    return
  }
  if (stylePanelVisible.value) {
    stylePanelVisible.value = false
    return
  }
  if (sourcePanelVisible.value) {
    sourcePanelVisible.value = false
    return
  }
  closeButton.value?.click()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown, true)
  mvSyncTimer = window.setInterval(() => {
    if (background.value == 'mv') void syncMvPlayback()
  }, 800)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown, true)
  window.clearTimeout(hideTimer)
  window.clearInterval(mvSyncTimer)
  mvRequestId += 1
})

watch(() => [background.value, biliTrackKey.value], () => {
  void loadMv()
}, { immediate: true })

watch(() => appSetting['playDetail.immersiveMvSource'], () => {
  mvOverride.value = null
  void loadMv()
})

watch(() => appSetting['playDetail.immersiveLyricSource'], () => {
  void applyLyricSource()
}, { immediate: true })

watch(() => musicInfo.id, () => {
  mvOverride.value = null
  originalLyricTrackId = ''
  originalLyric.value = null
  void loadMv()
  void applyLyricSource()
})

watch(isPlay, () => {
  void syncMvPlayback()
})
</script>

<style lang="less" module>
.immersive {
  --immersive-control-height: 112px;
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: hidden;
  color: white;
  background:
    radial-gradient(circle at 50% 42%, rgba(var(--detail-color-light), 0.14), transparent 42%),
    linear-gradient(145deg, rgba(var(--detail-color-deep), 0.7), rgba(8, 10, 16, 0.66));
  isolation: isolate;
}

.windowDragRegion {
  position: absolute;
  top: 0;
  right: 132px;
  left: 0;
  z-index: 8;
  height: 38px;
  cursor: default;
  -webkit-app-region: drag;
}

.aurora {
  position: absolute;
  inset: -12%;
  z-index: -1;
  overflow: hidden;
  filter: saturate(1.25);

  i {
    position: absolute;
    display: block;
    border-radius: 50%;
    pointer-events: none;
  }
}

.blurBackground {
  position: absolute;
  inset: -54px;
  z-index: -1;
  background-position: center;
  background-size: cover;
  filter: blur(var(--immersive-background-blur, 32px)) saturate(1.12);
  transform: scale(1.08);

  &::after {
    position: absolute;
    inset: 0;
    content: '';
    background:
      radial-gradient(circle at 50% 42%, rgba(var(--detail-color-light), .08), transparent 46%),
      linear-gradient(145deg, rgba(var(--detail-color-deep), .44), rgba(7, 9, 15, .7));
  }
}

.mvBackground {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: rgb(7, 9, 15);

  video,
  .mvFallback,
  .mvShade {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  video {
    z-index: 1;
    object-fit: cover;
    opacity: 0;
    filter: saturate(.92) contrast(1.03);
    transform: scale(1.015);
    transition: opacity .5s ease;
  }
}

.mvReady video {
  opacity: 1;
}

.mvFallback {
  background-position: center;
  background-size: cover;
  filter: blur(var(--immersive-background-blur, 32px)) saturate(1.08);
  transform: scale(1.1);
}

.mvShade {
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(4, 6, 11, .28), rgba(4, 6, 11, .08) 42%, rgba(4, 6, 11, .34)),
    radial-gradient(circle at 50% 45%, transparent 16%, rgba(5, 7, 12, .28) 100%);
}

.visualizer {
  z-index: 2;
  transition: opacity .24s ease;
}

.visualizerPaused {
  opacity: 0 !important;
}

.orbOne {
  width: 62vw;
  height: 62vw;
  left: -13vw;
  top: -25vw;
  background: rgba(var(--detail-color-base), 0.38);
  filter: blur(90px);
  animation: orb-drift-one 14s ease-in-out infinite alternate;
}

.orbTwo {
  width: 58vw;
  height: 58vw;
  right: -18vw;
  bottom: -30vw;
  background: rgba(var(--detail-color-warm), 0.3);
  filter: blur(110px);
  animation: orb-drift-two 17s ease-in-out infinite alternate;
}

.noise {
  inset: 0;
  border-radius: 0 !important;
  opacity: .12;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E");
}

.header {
  position: absolute;
  top: clamp(30px, 5vh, 58px);
  left: clamp(28px, 4.5vw, 68px);
  right: clamp(180px, 15vw, 230px);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 24px;
}

.closeButton {
  min-height: 44px;
  padding: 0 18px 0 13px;
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: rgba(255, 255, 255, .9);
  background: rgba(12, 14, 22, .18);
  backdrop-filter: blur(18px);
  cursor: pointer;
  transition: background-color .2s ease, transform .2s ease, border-color .2s ease;

  svg {
    width: 19px;
    height: 19px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    transform: translateX(-2px);
    border-color: rgba(255, 255, 255, .34);
    background: rgba(255, 255, 255, .12);
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--detail-color-light), .9);
    outline-offset: 3px;
  }
}

.songMeta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-shadow: 0 2px 18px rgba(0, 0, 0, .25);

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: .02em;
  }

  span {
    color: rgba(255, 255, 255, .58);
    font-size: 12px;
  }
}

.stage {
  position: absolute;
  inset: 8vh clamp(32px, 7vw, 120px) 15vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  perspective: 1000px;
  user-select: none;
}

.activeLine {
  width: min(1120px, 90vw);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: center;
  align-items: center;
  column-gap: clamp(5px, .65vw, 13px);
  row-gap: clamp(8px, 1.2vh, 16px);
  animation: line-breathe 7s ease-in-out infinite;
}

.word {
  --word-progress: 0;
  position: relative;
  display: inline-block;
  font-size: clamp(34px, 5.2vw, 80px);
  font-weight: 750;
  line-height: 1.08;
  letter-spacing: -.045em;
  white-space: pre;
  transform:
    translate3d(var(--word-x), var(--word-y), var(--word-z, 0px))
    rotate(var(--word-rotate))
    scale(var(--word-scale));
  transform-origin: center;
  transition: opacity .34s ease, filter .38s ease, transform .48s cubic-bezier(.2, .8, .2, 1);
  will-change: transform, opacity;

  &[data-state="waiting"] {
    opacity: .46;
    filter: blur(calc(.7px + var(--immersive-word-blur, 0px)));
    transform:
      translate3d(calc(var(--word-x) * 1.2), calc(var(--word-y) + 5px), var(--word-z, 0px))
      rotate(calc(var(--word-rotate) * 1.2))
      scale(calc(var(--word-scale) * .96));
  }

  &[data-state="active"] {
    opacity: 1;
    filter: none;
    transform:
      translate3d(var(--word-x), var(--word-y), var(--word-z, 0px))
      rotate(var(--word-rotate))
      scale(calc(var(--word-scale) * 1.08));
  }

  &[data-state="passed"] {
    opacity: .72;
    filter: none;
    transform:
      translate3d(var(--word-x), calc(var(--word-y) - 2px), var(--word-z, 0px))
      rotate(calc(var(--word-rotate) * .45))
      scale(var(--word-scale));
  }
}

.wordBase,
.wordLight,
.wordGlow {
  display: block;
}

.wordBase {
  color: rgba(255, 255, 255, .38);
  text-shadow: 0 7px 32px rgba(0, 0, 0, .24);
}

.wordLight,
.wordGlow {
  position: absolute;
  inset: 0;
  color: white;
  clip-path: inset(0 calc((1 - var(--word-progress)) * 100%) 0 0);
}

.wordLight {
  text-shadow: 0 0 1px rgba(255, 255, 255, .95);
}

.wordGlow {
  color: rgba(var(--detail-color-light), .95);
  filter: blur(8px);
  opacity: var(--immersive-glow-opacity, .76);
  text-shadow:
    0 0 22px rgba(var(--detail-color-warm), .9),
    0 0 54px rgba(var(--detail-color-base), .62);
}

.word[data-state="waiting"] .wordGlow,
.word[data-state="passed"] .wordGlow {
  opacity: .18;
}

.previousLine,
.nextLine,
.translation {
  width: min(820px, 78vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 2px 16px rgba(0, 0, 0, .2);
}

.previousLine,
.nextLine {
  position: absolute;
  color: rgba(255, 255, 255, .22);
  font-size: clamp(14px, 1.5vw, 21px);
  letter-spacing: .04em;
  filter: blur(.35px);
}

.previousLine {
  top: 1vh;
  transform: translateY(-10px) scale(.94);
}

.nextLine {
  bottom: 1vh;
  color: rgba(255, 255, 255, .34);
  transform: translateY(10px) scale(.96);
}

.translation {
  min-height: 22px;
  color: rgba(255, 255, 255, .68);
  font-size: clamp(13px, 1.25vw, 18px);
  letter-spacing: .025em;
}

.translationGroup {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: clamp(12px, 2vh, 22px);
}

.empty {
  color: rgba(255, 255, 255, .48);
  font-size: clamp(22px, 3vw, 38px);
  letter-spacing: .08em;
}

.controlsDock {
  position: absolute;
  inset: auto 0 0;
  min-height: var(--immersive-control-height);
  padding: 8px clamp(16px, 2.8vw, 44px) 16px;
  transform: translateY(12px);
  z-index: 3;
  box-sizing: border-box;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  opacity: 0;
  pointer-events: none;
  transition: opacity .22s ease, transform .22s ease;
}

.controlsVisible .controlsDock {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.progressTrack {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 14px;
  padding: 10px 0 0;
  border: 0;
  background: transparent;
  cursor: pointer;

  &::before {
    position: absolute;
    inset: auto 0 0;
    height: 4px;
    content: '';
    background: rgba(255, 255, 255, .24);
  }

  i {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1;
    display: block;
    height: 4px;
    background: rgba(255, 255, 255, .92);
    box-shadow: 0 0 14px rgba(var(--detail-color-light), .5);
    transform-origin: left;
    transition: transform .12s linear;
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--detail-color-light), .95);
    outline-offset: -3px;
  }
}

.controlRow {
  min-height: 52px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 20px;
  background: transparent;
}

.leftActions {
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: 2px;
}

.queueControl {
  width: 42px;
  height: 42px;
  justify-content: center;
  color: rgba(255, 255, 255, .78);

  :global(button) {
    width: 42px;
    height: 42px;
  }

  :global(svg) {
    width: 20px;
    height: 20px;
  }
}

.controlIcon {
  width: 42px;
  height: 42px;
  padding: 10px;
  flex: none;
  justify-self: start;
  border: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, .78);
  background: transparent;
  cursor: pointer;
  transition: color .18s ease, background-color .18s ease;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, .1);
  }

  &:focus-visible {
    outline: 2px solid rgba(var(--detail-color-light), .9);
    outline-offset: 2px;
  }

  svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.settingsControl {
  color: rgba(255, 255, 255, .96);
  background: rgba(255, 255, 255, .13);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08);

  &:hover {
    background: rgba(255, 255, 255, .21);
  }
}

.transport {
  grid-column: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;

  button {
    width: 38px;
    height: 38px;
    padding: 10px;
    border: 0;
    border-radius: 50%;
    color: rgba(255, 255, 255, .86);
    background: transparent;
    cursor: pointer;
    transition: color .18s ease, background-color .18s ease, transform .18s ease;

    &:hover {
      color: white;
      background: rgba(255, 255, 255, .1);
      transform: scale(1.05);
    }

    &:focus-visible {
      outline: 2px solid rgba(var(--detail-color-light), .9);
      outline-offset: 2px;
    }
  }

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  .playButton {
    width: 42px;
    height: 42px;
    padding: 9px;
    color: rgba(255, 255, 255, .96);
    background: rgba(255, 255, 255, .14);

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, .22);
    }
  }
}

.trackInfo {
  grid-column: 3;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.songMeta {
  max-width: min(240px, 23vw);
  text-align: right;
}

.coverThumb,
.coverPlaceholder {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, .24);
}

.coverThumb {
  display: block;
  object-fit: cover;
}

.coverPlaceholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, .64);
  background: rgba(255, 255, 255, .1);

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
}

.effect-classic {
  .activeLine {
    text-shadow: 0 0 26px rgba(var(--detail-color-light), .16);
  }

  .wordGlow {
    filter: blur(5px);
  }
}

.effect-cadenza {
  .stage {
    align-items: center;
  }

  .activeLine {
    width: min(1180px, 88vw);
    column-gap: clamp(7px, .8vw, 16px);
  }

  .word {
    font-size: clamp(38px, 5.6vw, 88px);
    letter-spacing: -.075em;
  }

  .wordBase {
    color: rgba(255, 255, 255, .48);
  }

  .wordGlow {
    filter: blur(11px);
  }
}

.effect-partita {
  .stage {
    align-items: flex-start;
  }

  .activeLine {
    width: min(860px, 74vw);
    flex-direction: column;
    align-items: flex-start;
    align-content: flex-start;
    row-gap: 1px;
    text-align: left;
  }

  .word {
    font-size: clamp(30px, 4.8vw, 74px);
    letter-spacing: -.025em;
  }

  .wordBase {
    color: rgba(173, 255, 224, .38);
  }

  .wordGlow {
    color: rgba(173, 255, 224, .95);
    filter: blur(5px);
  }
}

.effect-fume {
  .activeLine {
    width: min(1080px, 86vw);
    column-gap: clamp(10px, 1.2vw, 22px);
    row-gap: clamp(14px, 2vh, 28px);
  }

  .word {
    font-size: clamp(28px, 4.3vw, 68px);
    letter-spacing: -.02em;
  }

  .wordBase {
    color: rgba(255, 235, 217, .34);
    filter: blur(.5px);
  }

  .wordGlow {
    color: rgba(var(--detail-color-warm), .9);
    filter: blur(10px);
  }
}

.effect-cappella {
  .activeLine {
    width: min(1120px, 88vw);
    column-gap: clamp(6px, .9vw, 16px);
    row-gap: clamp(13px, 2vh, 24px);
  }

  .word {
    padding: .16em .34em;
    border-radius: 999px;
    background: rgba(255, 255, 255, .06);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .1), 0 8px 22px rgba(0, 0, 0, .12);
    font-size: clamp(27px, 4vw, 62px);
    letter-spacing: -.025em;
  }

  .word:nth-child(3n + 1) { background: rgba(164, 205, 255, .11); }
  .word:nth-child(3n + 2) { background: rgba(255, 183, 208, .1); }
  .word:nth-child(3n + 3) { background: rgba(181, 255, 220, .09); }

  .wordBase {
    color: rgba(255, 255, 255, .42);
  }
}

.effect-tilt {
  .stage {
    align-items: flex-start;
    justify-content: center;
  }

  .activeLine {
    width: min(1040px, 84vw);
    justify-content: flex-start;
    align-items: baseline;
    text-align: left;
    transform: rotate(-4deg) translateX(2vw);
  }

  .word {
    font-size: clamp(32px, 4.9vw, 76px);
    letter-spacing: .01em;
  }

  .wordBase {
    color: rgba(255, 218, 245, .4);
  }

  .wordGlow {
    color: rgba(255, 210, 245, .94);
    filter: blur(5px);
  }
}

.effect-claddagh {
  .stage {
    inset-inline: 0;
  }

  .activeLine {
    position: relative;
    width: min(780px, 70vw);
    height: min(470px, 54vh);
    display: block;
  }

  .word {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: -.55em 0 0 -.5em;
    font-size: clamp(25px, 3.6vw, 58px);
    letter-spacing: -.02em;
  }

  .wordBase {
    color: rgba(205, 224, 255, .34);
  }

  .wordGlow {
    color: rgba(204, 229, 255, .96);
    filter: blur(7px);
  }
}

.effect-diorama {
  .stage {
    perspective: 1000px;
  }

  .activeLine {
    width: min(1160px, 90vw);
    transform-style: preserve-3d;
  }

  .word {
    font-size: clamp(30px, 4.7vw, 74px);
    letter-spacing: -.04em;
    text-shadow: 0 14px 32px rgba(0, 0, 0, .3);
  }

  .wordBase {
    color: rgba(198, 226, 255, .36);
  }

  .wordGlow {
    color: rgba(185, 224, 255, .94);
    filter: blur(8px);
  }
}

.effect-monet {
  .stage {
    align-items: flex-start;
  }

  .activeLine {
    width: min(820px, 72vw);
    flex-direction: column;
    align-items: flex-start;
    align-content: flex-start;
    row-gap: 0;
    text-align: left;
  }

  .word {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(32px, 4.6vw, 72px);
    letter-spacing: -.02em;
  }

  .wordBase {
    color: rgba(255, 224, 224, .38);
  }

  .wordGlow {
    color: rgba(255, 231, 225, .94);
    filter: blur(12px);
  }
}

.effect-pendolo {
  .stage {
    align-items: flex-start;
  }

  .activeLine {
    width: min(1000px, 82vw);
    justify-content: flex-start;
    align-items: baseline;
    text-align: left;
  }

  .word {
    font-size: clamp(30px, 4.8vw, 74px);
    transform-origin: 50% -2.8em;
  }

  .wordBase {
    color: rgba(255, 236, 193, .38);
  }

  .wordGlow {
    color: rgba(255, 237, 190, .95);
    filter: blur(6px);
  }
}

@keyframes line-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  35% { transform: translateY(-7px) scale(1.006); }
  72% { transform: translateY(4px) scale(.997); }
}

@keyframes orb-drift-one {
  to { transform: translate3d(11vw, 9vh, 0) scale(1.12); }
}

@keyframes orb-drift-two {
  to { transform: translate3d(-10vw, -8vh, 0) scale(1.08); }
}

@media (max-width: 760px) {
  .stage {
    inset-inline: 24px;
  }

  .word {
    font-size: clamp(28px, 7.2vw, 54px);
  }

  .controlRow {
    grid-template-columns: 40px 1fr auto;
  }

  .transport {
    justify-self: center;
  }

  .songMeta {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orbOne,
  .orbTwo,
  .activeLine {
    animation: none;
  }

  .word,
  .progressTrack i {
    transition-duration: .01ms;
  }
}
</style>
