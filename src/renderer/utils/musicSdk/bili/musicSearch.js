import { decodeName } from '@renderer/utils'
import { formatPlayTime } from '../../index'
import { biliSearch } from '@renderer/utils/ipc'

export default {
  limit: 20,
  total: 0,
  page: 0,
  allPage: 1,
  async musicSearch(str, page) {
    return biliSearch({
      keyword: str,
      page,
      limit: this.limit,
    })
  },
  handleResult(rawList) {
    if (!Array.isArray(rawList)) return []
    return rawList.map(item => {
      const interval = item.duration
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
        interval: interval == null ? null : formatPlayTime(interval),
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
    })
  },
  async search(str, page = 1, limit) {
    if (limit == null) limit = this.limit
    this.limit = limit
    const result = await this.musicSearch(str, page)
    const list = this.handleResult(result.list || []).slice(0, limit)

    this.total = result.total || list.length
    this.page = page
    this.allPage = result.allPage || Math.ceil(this.total / limit) || 1

    return {
      list,
      allPage: this.allPage,
      limit,
      total: this.total,
      source: 'bili',
    }
  },
}
