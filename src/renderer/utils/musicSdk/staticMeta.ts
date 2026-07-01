export const onlineSources = [
  {
    name: '酷我音乐',
    id: 'kw',
  },
  {
    name: '酷狗音乐',
    id: 'kg',
  },
  {
    name: 'QQ音乐',
    id: 'tx',
  },
  {
    name: '网易音乐',
    id: 'wy',
  },
  {
    name: '咪咕音乐',
    id: 'mg',
  },
  {
    name: '虾米音乐',
    id: 'xm',
  },
  {
    name: 'B站音乐',
    id: 'bili',
  },
] as const

export const songListSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'bili'] as const

export const leaderboardSources = ['kw', 'kg', 'tx', 'wy', 'mg'] as const

export const musicDetailPageSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'bili'] as const
export const songListDetailPageSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'bili'] as const
export const leaderboardDetailPageSources = ['kg', 'tx', 'wy', 'mg'] as const
export const commentSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'bili', 'local'] as const

export const songListSorts = {
  kw: [
    { name: '最新', id: 'new' },
    { name: '最热', id: 'hot' },
  ],
  kg: [
    { name: '推荐', id: '5' },
    { name: '最热', id: '6' },
    { name: '最新', id: '7' },
    { name: '热藏', id: '3' },
    { name: '飙升', id: '8' },
  ],
  tx: [
    { name: '最热', id: 5 },
    { name: '最新', id: 2 },
  ],
  wy: [
    { name: '最热', id: 'hot' },
  ],
  mg: [
    { name: '推荐', id: '15127315' },
  ],
  bili: [
    { name: '综合', id: 'totalrank' },
    { name: '最多播放', id: 'click' },
    { name: '最新发布', id: 'pubdate' },
    { name: '最多收藏', id: 'stow' },
  ],
} as const

const hasSource = (list: readonly string[], source?: string | null) => {
  return !!source && list.includes(source)
}

export const hasMusicDetailPage = (source?: string | null) => {
  return hasSource(musicDetailPageSources, source)
}

export const hasSongList = (source?: string | null) => {
  return hasSource(songListSources, source)
}

export const hasSongListDetailPage = (source?: string | null) => {
  return hasSource(songListDetailPageSources, source)
}

export const hasLeaderboardDetailPage = (source?: string | null) => {
  return hasSource(leaderboardDetailPageSources, source)
}

export const hasComment = (source?: string | null) => {
  return hasSource(commentSources, source)
}
