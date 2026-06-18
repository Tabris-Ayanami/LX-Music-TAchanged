declare namespace LX {
  namespace Bili {
    interface AccountInfo {
      hasCookie: boolean
      isLogin: boolean
      mid?: number | string
      uname?: string
    }

    interface Track {
      id: string
      bvid: string
      aid?: number
      cid: number
      title: string
      videoTitle: string
      author: string
      ownerMid?: number
      cover: string
      duration: number | null
      page: number
      pageTitle: string
      pageCount: number
    }

    interface SearchParams {
      keyword: string
      page?: number
      limit?: number
    }

    interface SearchResult {
      list: Track[]
      page: number
      allPage: number
      total: number
      limit: number
    }

    interface TrackParams {
      bvid: string
      cid?: number | string
      page?: number | string
      title?: string
      artist?: string
      duration?: number | null
    }

    interface MusicUrlResult {
      type: LX.Quality
      url: string
      rawUrl: string
      expiresAt: number
    }

    interface MusicQualityInfo {
      qualitys: Partial<Record<LX.Quality, boolean>>
      audioIds: number[]
      hasFlac: boolean
    }

    interface CommentParams extends TrackParams {
      aid?: number
      page?: number | string
      limit?: number
      sort?: 'hot' | 'new'
    }

    interface CommentItem {
      id: string | number
      text: string
      time: number | string
      timeStr: string
      location?: string
      userName: string
      avatar: string
      userId: string | number
      likedCount: number | null
      images?: string[]
      reply: CommentItem[]
    }

    interface CommentInfo {
      source: 'bili'
      comments: CommentItem[]
      total: number
      page: number
      limit: number
      maxPage: number
    }

    interface SongListDetailParams {
      bvid: string
      page?: number
      limit?: number
    }

    interface SongListDetail {
      list: Track[]
      page: number
      limit: number
      total: number
      source: 'bili'
      info: {
        play_count: string
        name: string
        img: string
        desc: string
        author: string
      }
    }
  }
}
