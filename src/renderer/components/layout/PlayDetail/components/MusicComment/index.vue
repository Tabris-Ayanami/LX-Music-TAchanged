<template lang="pug">
div.comment(ref="dom_container" :class="$style.comment")
  div(:class="$style.commentHeader")
    h3 {{ $t('comment__title', { name: currentMusicInfo.name }) }}
    div(:class="$style.commentHeaderBtns")
      div(:class="$style.commentHeaderBtn" :aria-label="$t('comment__refresh')" @click="handleShowComment(true)")
        svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" style="transform: rotate(45deg);" viewBox="0 0 24 24" space="preserve")
          use(xlink:href="#icon-refresh")
      div(:class="$style.commentHeaderBtn" @click="$emit('close')")
        svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
          use(xlink:href="#icon-close")

  div(:class="$style.commentMain")
    template(v-if="available")
      header(:class="$style.tab_header")
        button(type="button" :class="[$style.commentType, { [$style.active]: tabActiveId == 'hot' }]" @click="handleToggleTab('hot')") {{ $t('comment__hot_title') }} ({{ hotComment.total }})
        button(type="button" :class="[$style.commentType, { [$style.active]: tabActiveId == 'new' }]" @click="handleToggleTab('new')") {{ $t('comment__new_title') }} ({{ newComment.total }})
      main(ref="dom_tabMain" :class="$style.tab_main")
        div(:class="$style.tab_content")
          div.scroll(ref="dom_commentHot" :class="$style.tab_content_scroll")
            p(v-if="hotComment.isLoadError" :class="$style.commentLabel" style="cursor: pointer;" @click="handleGetHotComment(currentMusicInfo, hotComment.nextPage, hotComment.limit)") {{ $t('comment__hot_load_error') }}
            p(v-else-if="hotComment.isLoading && !hotComment.list.length" :class="$style.commentLabel") {{ $t('comment__hot_loading') }}
            comment-floor(v-if="!hotComment.isLoadError && hotComment.list.length" :class="[$style.commentFloor, hotComment.isLoading ? $style.loading : null]" :comments="hotComment.list")
            p(v-else-if="!hotComment.isLoadError && !hotComment.isLoading" :class="$style.commentLabel") {{ $t('comment__no_content') }}
            div(:class="$style.pagination")
              material-pagination(:count="hotComment.total" :btn-length="5" :limit="hotComment.limit" :page="hotComment.page" @btn-click="handleToggleHotCommentPage")
        div(:class="$style.tab_content")
          div.scroll(ref="dom_commentNew" :class="$style.tab_content_scroll")
            p(v-if="newComment.isLoadError" :class="$style.commentLabel" style="cursor: pointer;" @click="handleGetNewComment(currentMusicInfo, newComment.nextPage, newComment.limit)") {{ $t('comment__new_load_error') }}
            p(v-else-if="newComment.isLoading && !newComment.list.length" :class="$style.commentLabel") {{ $t('comment__new_loading') }}
            comment-floor(v-if="!newComment.isLoadError && newComment.list.length" :class="[$style.commentFloor, newComment.isLoading ? $style.loading : null]" :comments="newComment.list")
            p(v-else-if="!newComment.isLoadError && !newComment.isLoading" :class="$style.commentLabel") {{ $t('comment__no_content') }}
            div(:class="$style.pagination")
              material-pagination(:count="newComment.total" :btn-length="5" :limit="newComment.limit" :page="newComment.page" @btn-click="handleToggleCommentPage")
    div(v-else :class="$style.unavailable")
      p {{ $t('comment__unavailable') }}
</template>

<script>
import { toOldMusicInfo } from '@renderer/utils'
import { hasComment } from '@renderer/utils/musicSdk/staticMeta'
import CommentFloor from './CommentFloor.vue'

const CANCELLED_REQUEST_MESSAGE = '鍙栨秷璇锋眰'
let activeCommentKey = ''
let activeCommentCache = null
let musicSdkPromise = null

const getMusicSdk = async() => {
  musicSdkPromise ||= import('@renderer/utils/musicSdk').then(({ default: music }) => music)
  return musicSdkPromise
}

const createCommentState = (limit = 20, isLoading = false, isLoadError = false) => ({
  isLoading,
  isLoadError,
  page: 1,
  total: 0,
  maxPage: 1,
  nextPage: 1,
  limit,
  list: [],
})

const getCurrentMusicInfo = musicInfo => {
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata?.musicInfo : musicInfo
}

const getCommentKey = musicInfo => {
  if (!musicInfo) return ''
  return [
    musicInfo.source,
    musicInfo.id,
    musicInfo.songmid,
    musicInfo.hash,
    musicInfo.name,
    musicInfo.singer,
    musicInfo.interval,
  ].filter(Boolean).join('__')
}

const cloneCommentState = state => ({
  ...state,
  list: [...state.list],
})

export default {
  name: 'MusicComment',
  components: {
    CommentFloor,
  },
  props: {
    show: Boolean,
    musicInfo: {
      type: Object,
      required: true,
    },
  },
  emits: ['close'],
  data() {
    return {
      available: false,
      currentMusicInfo: {
        name: '',
        singer: '',
      },
      tabActiveId: 'hot',
      commentKey: '',
      newComment: createCommentState(),
      hotComment: createCommentState(),
    }
  },
  watch: {
    show(n) {
      if (n) this.handleShowComment()
    },
    musicInfo() {
      if (this.show) this.handleShowComment()
    },
  },
  mounted() {
    this.setWidth()
    window.addEventListener('resize', this.setWidth)
    if (this.show) this.handleShowComment()
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.setWidth)
  },
  methods: {
    setWidth() {
      setTimeout(() => {
        const parentWidth = this.$refs.dom_container?.parentNode?.clientWidth ?? 0
        if (!parentWidth) return
        const nextWidth = Math.max(Math.min(Math.floor(parentWidth * 0.36), 500), 360)
        this.$refs.dom_container.style.width = `${nextWidth}px`

        setTimeout(() => {
          this.handleToggleTab(this.tabActiveId, true)
        })
      })
    },
    async getComment(musicInfo, page, limit, retryNum = 0) {
      let resp
      try {
        const music = await getMusicSdk()
        resp = await music[musicInfo.source].comment.getComment(musicInfo, page, limit)
      } catch (error) {
        if (error.message == CANCELLED_REQUEST_MESSAGE || ++retryNum > 2) throw error
        resp = await this.getComment(musicInfo, page, limit, retryNum)
      }
      return resp
    },
    async getHotComment(musicInfo, page, limit, retryNum = 0) {
      let resp
      try {
        const music = await getMusicSdk()
        resp = await music[musicInfo.source].comment.getHotComment(musicInfo, page, limit)
      } catch (error) {
        if (error.message == CANCELLED_REQUEST_MESSAGE || ++retryNum > 2) throw error
        resp = await this.getHotComment(musicInfo, page, limit, retryNum)
      }
      return resp
    },
    handleGetNewComment(musicInfo, page, limit) {
      this.newComment.isLoadError = false
      this.newComment.isLoading = true
      this.saveActiveCache()
      this.getComment(toOldMusicInfo(musicInfo), page, limit).then(comment => {
        if (this.commentKey != activeCommentKey) return
        this.newComment.isLoading = false
        this.newComment.total = comment.total
        this.newComment.maxPage = comment.maxPage
        this.newComment.page = page
        this.newComment.list = comment.comments
        this.saveActiveCache()
        this.$nextTick(() => {
          this.$refs.dom_commentNew?.scrollTo(0, 0)
        })
      }).catch(err => {
        console.log(err)
        if (err.message == CANCELLED_REQUEST_MESSAGE) return
        if (this.commentKey != activeCommentKey) return
        this.newComment.isLoadError = true
        this.newComment.isLoading = false
        this.saveActiveCache()
      })
    },
    handleGetHotComment(musicInfo, page, limit) {
      this.hotComment.isLoadError = false
      this.hotComment.isLoading = true
      this.saveActiveCache()
      this.getHotComment(toOldMusicInfo(musicInfo), page, limit).then(hotComment => {
        if (this.commentKey != activeCommentKey) return
        this.hotComment.isLoading = false
        this.hotComment.total = hotComment.total
        this.hotComment.maxPage = hotComment.maxPage
        this.hotComment.page = page
        this.hotComment.list = hotComment.comments
        this.saveActiveCache()
        this.$nextTick(() => {
          this.$refs.dom_commentHot?.scrollTo(0, 0)
        })
      }).catch(err => {
        console.log(err)
        if (err.message == CANCELLED_REQUEST_MESSAGE) return
        if (this.commentKey != activeCommentKey) return
        this.hotComment.isLoadError = true
        this.hotComment.isLoading = false
        this.saveActiveCache()
      })
    },
    saveActiveCache() {
      if (!this.commentKey || this.commentKey != activeCommentKey) return
      activeCommentCache = {
        available: this.available,
        currentMusicInfo: this.currentMusicInfo,
        tabActiveId: this.tabActiveId,
        hotComment: cloneCommentState(this.hotComment),
        newComment: cloneCommentState(this.newComment),
      }
    },
    applyActiveCache() {
      if (!activeCommentCache || this.commentKey != activeCommentKey) return false
      this.available = activeCommentCache.available
      this.currentMusicInfo = activeCommentCache.currentMusicInfo
      this.tabActiveId = activeCommentCache.tabActiveId
      this.hotComment = cloneCommentState(activeCommentCache.hotComment)
      this.newComment = cloneCommentState(activeCommentCache.newComment)
      this.$nextTick(() => {
        this.handleToggleTab(this.tabActiveId, true)
      })
      return true
    },
    resetComments() {
      this.hotComment = createCommentState(this.hotComment.limit)
      this.newComment = createCommentState(this.newComment.limit)
    },
    handleShowComment(force = false) {
      const currentMusicInfo = getCurrentMusicInfo(this.musicInfo)
      if (!currentMusicInfo) {
        this.available = false
        return
      }

      const commentKey = getCommentKey(currentMusicInfo)
      if (!commentKey) {
        this.available = false
        return
      }

      if (commentKey != activeCommentKey) {
        activeCommentKey = commentKey
        activeCommentCache = null
      }

      this.commentKey = commentKey
      this.currentMusicInfo = currentMusicInfo

      if (!force && this.applyActiveCache()) return

      if (!hasComment(this.currentMusicInfo.source)) {
        this.available = false
        this.saveActiveCache()
        return
      }
      this.available = true
      this.resetComments()
      this.saveActiveCache()

      this.handleGetHotComment(this.currentMusicInfo, this.hotComment.page, this.hotComment.limit)
      this.handleGetNewComment(this.currentMusicInfo, this.newComment.page, this.newComment.limit)
    },
    handleToggleHotCommentPage(page) {
      this.hotComment.nextPage = page
      this.handleGetHotComment(this.currentMusicInfo, page, this.hotComment.limit)
    },
    handleToggleCommentPage(page) {
      this.newComment.nextPage = page
      this.handleGetNewComment(this.currentMusicInfo, page, this.newComment.limit)
    },
    handleToggleTab(id, force) {
      if (!this.available || (!force && this.tabActiveId == id)) return
      switch (id) {
        case 'hot':
          this.$refs.dom_tabMain.scrollLeft = 0
          break
        case 'new':
          this.$refs.dom_tabMain.scrollLeft = this.$refs.dom_tabMain.clientWidth
          break
      }
      this.tabActiveId = id
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.comment {
  display: flex;
  flex-flow: column nowrap;
  transition: @transition-normal;
  transition-property: transform, opacity;
  transform-origin: 100%;
  overflow: hidden;
}
.commentHeader {
  flex: none;
  padding: 2px 4px 10px;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;

  h3 {
    font-size: 14px;
    font-weight: 500;
    color: rgba(46, 56, 70, 0.9);
    .mixin-ellipsis-1();
    line-height: 1.2;
  }
}
.commentHeaderBtns {
  flex: 1 0 auto;
  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-end;
  color: var(--color-primary);
}
.commentHeaderBtn {
  height: 22px;
  width: 22px;
  cursor: pointer;
  transition: opacity @transition-normal;

  + .commentHeaderBtn {
    margin-left: 5px;
  }

  &:hover {
    opacity: .7;
  }
}
.commentMain {
  position: relative;
  flex: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.84), rgba(233, 239, 244, 0.78));
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 16px;
  box-shadow: 0 14px 38px rgba(21, 31, 43, 0.10);
  backdrop-filter: blur(14px) saturate(112%);
  -webkit-backdrop-filter: blur(14px) saturate(112%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08));
    pointer-events: none;
  }
}
.tab_header {
  position: relative;
  z-index: 1;
  display: flex;
  flex-flow: row nowrap;
  gap: 15px;
  padding: 12px 18px 0;
}
.tab_main {
  position: relative;
  z-index: 1;
  flex: auto;
  display: flex;
  flex-flow: row nowrap;
  overflow: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
}
.tab_content {
  flex-shrink: 0;
  width: 100%;
  position: relative;
}
.tab_content_scroll {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  padding-left: 18px;
  padding-right: 14px;
  scroll-behavior: smooth;
}
.commentLabel {
  padding: 15px;
  color: var(--color-font-label);
  font-size: 14px;
}
.commentType {
  padding: 5px;
  margin: 5px 0;
  font-size: 13px;
  background: none;
  border: none;
  cursor: pointer;
  transition: @transition-normal;
  transition-property: opacity, color;

  &:hover {
    opacity: .7;
  }
  &.active {
    color: var(--color-primary);
  }
}
.commentFloor {
  opacity: 1;
  transition: opacity @transition-normal;

  &.loading {
    opacity: .4;
  }
}
.pagination {
  padding: 10px 0;
}

.unavailable {
  flex: auto;
  padding-top: 10%;
  text-align: center;
  font-size: 14px;
  color: var(--color-font-label);
}

</style>
