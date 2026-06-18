import kw from './kw/index'
import kg from './kg/index'
import tx from './tx/index'
import wy from './wy/index'
import mg from './mg/index'
import bd from './bd/index'
import xm from './xm'
import bili from './bili/index'
import { supportQuality } from './api-source'

const LOCAL_COMMENT_MATCH_SOURCES = ['wy', 'tx', 'kw', 'kg', 'mg']

const localCommentMatchCache = new Map()

const getIntervalSeconds = interval => {
  if (!interval || typeof interval != 'string') return 0
  const nums = interval.split(':').map(num => parseInt(num))
  if (nums.some(num => Number.isNaN(num))) return 0
  return nums.reduce((sum, num) => sum * 60 + num, 0)
}

const normalizeSearchText = text => String(text || '')
  .replace(/\.[a-z\d]{2,5}$/i, '')
  .replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '')
  .toLowerCase()

const isLocalCommentMatched = (localInfo, onlineInfo) => {
  const localName = normalizeSearchText(localInfo.name)
  const onlineName = normalizeSearchText(onlineInfo.name)
  if (!localName || !onlineName) return false
  if (localName != onlineName && !localName.includes(onlineName) && !onlineName.includes(localName)) return false

  const localSinger = normalizeSearchText(localInfo.singer)
  const onlineSinger = normalizeSearchText(onlineInfo.singer)
  if (localSinger && onlineSinger && !localSinger.includes(onlineSinger) && !onlineSinger.includes(localSinger)) return false

  const localInterval = getIntervalSeconds(localInfo.interval)
  const onlineInterval = getIntervalSeconds(onlineInfo.interval)
  return !localInterval || !onlineInterval || Math.abs(localInterval - onlineInterval) < 8
}

const findLocalCommentMusic = async(localInfo) => {
  const cacheKey = `${localInfo.name}__${localInfo.singer}__${localInfo.interval}`
  if (localCommentMatchCache.has(cacheKey)) return localCommentMatchCache.get(cacheKey)

  const keyword = `${localInfo.name || ''} ${localInfo.singer || ''}`.trim()
  for (const source of LOCAL_COMMENT_MATCH_SOURCES) {
    const sdk = sources[source]
    if (!sdk?.musicSearch?.search || !sdk.comment) continue
    try {
      const result = await sdk.musicSearch.search(keyword, 1, 10)
      const list = result?.list || []
      const matched = list.find(item => isLocalCommentMatched(localInfo, item)) || list[0]
      if (!matched) continue
      localCommentMatchCache.set(cacheKey, matched)
      return matched
    } catch (err) {
      console.log(err)
    }
  }

  throw new Error('未找到可匹配评论的在线歌曲')
}

const local = {
  comment: {
    async getComment(musicInfo, page = 1, limit = 20) {
      const matched = await findLocalCommentMusic(musicInfo)
      const sdk = sources[matched.source]
      if (!sdk?.comment?.getComment) throw new Error('匹配源不支持评论')
      return sdk.comment.getComment(matched, page, limit)
    },
    async getHotComment(musicInfo, page = 1, limit = 20) {
      const matched = await findLocalCommentMusic(musicInfo)
      const sdk = sources[matched.source]
      if (!sdk?.comment?.getHotComment) throw new Error('匹配源不支持热门评论')
      return sdk.comment.getHotComment(matched, page, limit)
    },
  },
}


const sources = {
  sources: [
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
    // {
    //   name: '百度音乐',
    //   id: 'bd',
    // },
  ],
  kw,
  kg,
  tx,
  wy,
  mg,
  bd,
  xm,
  bili,
  local,
}
/** @type {any} */
const musicSdk = {
  ...sources,
  init() {
    const tasks = []
    for (let source of sources.sources) {
      let sm = sources[source.id]
      sm && sm.init && tasks.push(sm.init())
    }
    return Promise.all(tasks)
  },
  supportQuality,

  async searchMusic({ name, singer, source: s, limit = 25 }) {
    const trimStr = str => typeof str == 'string' ? str.trim() : str
    const musicName = trimStr(name)
    const tasks = []
    const excludeSource = ['xm', 'bili']
    for (const source of sources.sources) {
      if (!sources[source.id].musicSearch || source.id == s || excludeSource.includes(source.id)) continue
      tasks.push(sources[source.id].musicSearch.search(`${musicName} ${singer || ''}`.trim(), 1, limit).catch(_ => null))
    }
    return (await Promise.all(tasks)).filter(s => s)
  },

  async findMusic({ name, singer, albumName, interval, source: s }) {
    const lists = await this.searchMusic({ name, singer, source: s, limit: 25 })
    // console.log(lists)
    // console.log({ name, singer, albumName, interval, source: s })

    const singersRxp = /、|&|;|；|\/|,|，|\|/
    const sortSingle = singer => singersRxp.test(singer)
      ? singer.split(singersRxp).sort((a, b) => a.localeCompare(b)).join('、')
      : (singer || '')
    const sortMusic = (arr, callback) => {
      const tempResult = []
      for (let i = arr.length - 1; i > -1; i--) {
        const item = arr[i]
        if (callback(item)) {
          delete item.fSinger
          delete item.fMusicName
          delete item.fAlbumName
          delete item.fInterval
          tempResult.push(item)
          arr.splice(i, 1)
        }
      }
      tempResult.reverse()
      return tempResult
    }
    const getIntv = (interval) => {
      if (!interval) return 0
      // if (musicInfo._interval) return musicInfo._interval
      let intvArr = interval.split(':')
      let intv = 0
      let unit = 1
      while (intvArr.length) {
        intv += parseInt(intvArr.pop()) * unit
        unit *= 60
      }
      return intv
    }
    const trimStr = str => typeof str == 'string' ? str.trim() : (str || '')
    const filterStr = str => typeof str == 'string' ? str.replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '') : String(str || '')
    const fMusicName = filterStr(name).toLowerCase()
    const fSinger = filterStr(sortSingle(singer)).toLowerCase()
    const fAlbumName = filterStr(albumName).toLowerCase()
    const fInterval = getIntv(interval)
    const isEqualsInterval = (intv) => Math.abs((fInterval || intv) - (intv || fInterval)) < 5
    const isIncludesName = (name) => (fMusicName.includes(name) || name.includes(fMusicName))
    const isIncludesSinger = (singer) => fSinger ? (fSinger.includes(singer) || singer.includes(fSinger)) : true
    const isEqualsAlbum = (album) => fAlbumName ? fAlbumName == album : true

    const result = lists.map(source => {
      for (const item of source.list) {
        item.name = trimStr(item.name)
        item.singer = trimStr(item.singer)
        item.fSinger = filterStr(sortSingle(item.singer).toLowerCase())
        item.fMusicName = filterStr(String(item.name ?? '').toLowerCase())
        item.fAlbumName = filterStr(String(item.albumName ?? '').toLowerCase())
        item.fInterval = getIntv(item.interval)
        // console.log(fMusicName, item.fMusicName, item.source)
        if (!isEqualsInterval(item.fInterval)) {
          item.name = null
          continue
        }
        if (item.fMusicName == fMusicName && isIncludesSinger(item.fSinger)) return item
      }
      for (const item of source.list) {
        if (item.name == null) continue
        if (item.fSinger == fSinger && isIncludesName(item.fMusicName)) return item
      }
      for (const item of source.list) {
        if (item.name == null) continue
        if (isEqualsAlbum(item.fAlbumName) && isIncludesSinger(item.fSinger) && isIncludesName(item.fMusicName)) return item
      }
      return null
    }).filter(s => s)
    const newResult = []
    if (result.length) {
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.fMusicName == fMusicName && item.interval == interval))
      newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName && item.fSinger == fSinger && item.fAlbumName == fAlbumName))
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.fMusicName == fMusicName))
      newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName && item.interval == interval))
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.interval == interval))
      newResult.push(...sortMusic(result, item => item.interval == interval))
      newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName))
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger))
      newResult.push(...sortMusic(result, item => item.fAlbumName == fAlbumName))
      for (const item of result) {
        delete item.fSinger
        delete item.fMusicName
        delete item.fAlbumName
        delete item.fInterval
      }
      newResult.push(...result)
    }
    // console.log(newResult)
    return newResult
  },
}

export default musicSdk
