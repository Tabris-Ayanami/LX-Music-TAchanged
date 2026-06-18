import { httpFetch } from '../../request'
import { createLimitedCache } from '@renderer/utils/limitedCache'

export default {
  cache: createLimitedCache(100, 30 * 60 * 1000),
  getMusicInfo(songmid) {
    const cachedInfo = this.cache.get(songmid)
    if (cachedInfo) {
      return { promise: Promise.resolve(cachedInfo) }
    }
    const requestObj = httpFetch(`https://musicapi.qianqian.com/v1/restserver/ting?method=baidu.ting.song.getSongLink&format=json&from=bmpc&version=1.0.0&version_d=11.1.6.0&songid=${songmid}&type=1&res=1&s_protocol=1&aac=2&project=tpass`)
    requestObj.promise = requestObj.promise.then(({ body }) => {
      // console.log(body)
      if (body.error_code == 22000) {
        this.cache.set(songmid, body.result.songinfo)
        return body.result.songinfo
      }
      return Promise.reject(new Error('获取音乐信息失败'))
    })
    return requestObj
  },
}
