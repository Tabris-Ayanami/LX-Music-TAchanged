import musicSearch from './musicSearch'
import { getBiliComment, getBiliLyric, getBiliMusicUrl, getBiliPic, getBiliSongListDetail } from '@renderer/utils/ipc'
import { decodeName } from '@renderer/utils'
import { formatPlayTime } from '../../index'

const getBiliParams = songInfo => ({
  bvid: songInfo.bvid || songInfo.songmid,
  cid: songInfo.cid,
  page: songInfo.page,
  title: songInfo.name,
  artist: songInfo.singer,
  duration: parseInterval(songInfo.interval),
})

const parseInterval = interval => {
  if (!interval || typeof interval != 'string') return null
  const nums = interval.split(':').map(num => parseInt(num))
  if (nums.some(num => Number.isNaN(num))) return null
  return nums.reduce((sum, num) => sum * 60 + num, 0)
}

const formatCount = num => {
  if (num > 100000000) return `${Math.trunc(num / 10000000) / 10}亿`
  if (num > 10000) return `${Math.trunc(num / 1000) / 10}万`
  return String(num ?? '')
}

const getTrackPic = async(item) => {
  if (!item?.bvid) return item?.cover || ''
  return getBiliPic({
    bvid: item.bvid,
    cid: item.cid,
    page: item.page,
  }).catch(() => item.cover || '')
}

const trackToOldMusic = item => {
  const types = [
    { type: 'flac24bit', size: null },
    { type: '320k', size: null },
    { type: '192k', size: null },
    { type: '128k', size: null },
  ]
  const _types = {
    flac24bit: {
      size: null,
    },
    '320k': {
      size: null,
    },
    '192k': {
      size: null,
    },
    '128k': {
      size: null,
    },
  }
  return {
    singer: decodeName(item.author || ''),
    name: decodeName(item.title || item.videoTitle || ''),
    albumName: decodeName(item.videoTitle || 'Bilibili'),
    albumId: item.bvid,
    source: 'bili',
    interval: item.duration == null ? null : formatPlayTime(item.duration),
    songmid: item.id,
    img: item.cover || '',
    lrc: null,
    types,
    _types,
    typeUrl: {},
    bvid: item.bvid,
    aid: item.aid,
    cid: item.cid,
    page: item.page,
    pageTitle: decodeName(item.pageTitle || ''),
    pageCount: item.pageCount,
    videoTitle: decodeName(item.videoTitle || ''),
    ownerMid: item.ownerMid,
  }
}

const tracksToSongLists = async(result, limit) => {
  const map = new Map()
  for (const item of result.list || []) {
    if (map.has(item.bvid)) continue
    map.set(item.bvid, item)
  }
  const list = await Promise.all([...map.values()].slice(0, limit).map(async item => ({
    play_count: '',
    id: item.bvid,
    author: decodeName(item.author || ''),
    name: decodeName(item.videoTitle || item.title || ''),
    total: item.pageCount,
    img: await getTrackPic(item),
    desc: item.pageCount > 1 ? `共 ${item.pageCount} 个分P` : '单P视频',
    source: 'bili',
  })))
  return {
    list,
    limit,
    total: result.total || list.length,
    source: 'bili',
  }
}

const bili = {
  musicSearch,
  songList: {
    limit_list: 20,
    limit_song: 1000,
    sortList: [
      { name: '综合', id: 'totalrank' },
      { name: '最多播放', id: 'click' },
      { name: '最新发布', id: 'pubdate' },
      { name: '最多收藏', id: 'stow' },
    ],
    getTags() {
      return Promise.resolve({
        tags: [
          {
            name: 'B站视频',
            list: [
              { parent_id: 'bili', parent_name: 'B站视频', id: '音乐', name: '音乐', source: 'bili' },
              { parent_id: 'bili', parent_name: 'B站视频', id: '翻唱', name: '翻唱', source: 'bili' },
              { parent_id: 'bili', parent_name: 'B站视频', id: 'LIVE', name: 'LIVE', source: 'bili' },
              { parent_id: 'bili', parent_name: 'B站视频', id: '动漫音乐', name: '动漫音乐', source: 'bili' },
              { parent_id: 'bili', parent_name: 'B站视频', id: '游戏音乐', name: '游戏音乐', source: 'bili' },
            ],
          },
        ],
        hotTag: [
          { parent_id: 'bili', parent_name: 'B站视频', id: '音乐', name: '音乐', source: 'bili' },
          { parent_id: 'bili', parent_name: 'B站视频', id: '翻唱', name: '翻唱', source: 'bili' },
        ],
        source: 'bili',
      })
    },
    async getList(sortId, tagId, page) {
      const keyword = tagId || '音乐'
      const result = await musicSearch.search(keyword, page, this.limit_list)
      return tracksToSongLists(result, this.limit_list)
    },
    async getListDetail(id, page = 1) {
      const result = await getBiliSongListDetail({
        bvid: id,
        page,
        limit: this.limit_song,
      })
      const list = result.list.map(trackToOldMusic)
      const cover = await getTrackPic(result.list[0]).catch(() => list[0]?.img || result.info.img)
      return {
        list,
        page: result.page,
        limit: result.limit,
        total: result.total,
        source: 'bili',
        info: {
          play_count: formatCount(Number(result.info.play_count)),
          name: decodeName(result.info.name),
          img: cover || list[0]?.img || result.info.img,
          desc: result.info.desc,
          author: decodeName(result.info.author),
        },
      }
    },
    async search(text, page, limit = 20) {
      const result = await musicSearch.search(text, page, limit)
      return tracksToSongLists(result, limit)
    },
    getDetailPageUrl(id) {
      return `https://www.bilibili.com/video/${id}`
    },
  },
  comment: {
    getComment(songInfo, page = 1, limit = 20) {
      return getBiliComment({
        ...getBiliParams(songInfo),
        aid: songInfo.aid,
        page,
        limit,
        sort: 'new',
      })
    },
    getHotComment(songInfo, page = 1, limit = 20) {
      return getBiliComment({
        ...getBiliParams(songInfo),
        aid: songInfo.aid,
        page,
        limit,
        sort: 'hot',
      })
    },
  },
  getMusicUrl(songInfo, type = '128k') {
    return {
      promise: getBiliMusicUrl(getBiliParams(songInfo), type),
    }
  },
  getLyric(songInfo) {
    return {
      promise: getBiliLyric(getBiliParams(songInfo)),
    }
  },
  async getPic(songInfo) {
    return getBiliPic(getBiliParams(songInfo))
  },
  getMusicDetailPageUrl(songInfo) {
    return `https://www.bilibili.com/video/${songInfo.bvid || songInfo.songmid}${songInfo.page ? `?p=${songInfo.page}` : ''}`
  },
}

export default bili
