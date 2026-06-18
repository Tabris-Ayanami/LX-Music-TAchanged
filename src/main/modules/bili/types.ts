export interface BiliAccountInfo {
  hasCookie: boolean
  isLogin: boolean
  mid?: number | string
  uname?: string
}

export interface BiliTrack {
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

export interface BiliSearchParams {
  keyword: string
  page?: number
  limit?: number
}

export interface BiliSearchResult {
  list: BiliTrack[]
  page: number
  allPage: number
  total: number
  limit: number
}

export interface BiliTrackParams {
  bvid: string
  cid?: number | string
  page?: number | string
  title?: string
  artist?: string
  duration?: number | null
}

export interface BiliMusicUrlResult {
  type: LX.Quality
  url: string
  rawUrl: string
  expiresAt: number
}

export interface BiliMusicQualityInfo {
  qualitys: Partial<Record<LX.Quality, boolean>>
  audioIds: number[]
  hasFlac: boolean
}

export interface BiliCommentParams extends BiliTrackParams {
  aid?: number
  page?: number | string
  limit?: number
  sort?: 'hot' | 'new'
}

export interface BiliCommentItem {
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
  reply: BiliCommentItem[]
}

export interface BiliCommentInfo {
  source: 'bili'
  comments: BiliCommentItem[]
  total: number
  page: number
  limit: number
  maxPage: number
}

export interface BiliSongListDetailParams {
  bvid: string
  page?: number
  limit?: number
}

export interface BiliSongListDetail {
  list: BiliTrack[]
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
