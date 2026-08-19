import { weapi } from './utils/crypto'
import { httpFetch } from '../../request'
import { getWYCookie } from './utils/index'
import musicDetailApi from './musicDetail'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const headersWithCookie = (extra = {}) => {
  const headers = {
    'User-Agent': USER_AGENT,
    origin: 'https://music.163.com',
    ...extra,
  }
  const cookie = getWYCookie()
  if (cookie) headers.Cookie = cookie
  return headers
}

export default {
  /**
   * 校验网易云 Cookie 是否有效，并返回账号信息
   */
  async getAccountInfo() {
    const cookie = getWYCookie()
    if (!cookie) return { hasCookie: false, isLogin: false }
    const requestObj = httpFetch('https://music.163.com/weapi/nuser/account/get', {
      method: 'post',
      headers: headersWithCookie(),
      form: weapi({}),
    })
    const { statusCode, body } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200 || !body.profile) {
      return { hasCookie: true, isLogin: false }
    }
    return {
      hasCookie: true,
      isLogin: true,
      userId: body.profile.userId,
      nickname: body.profile.nickname,
    }
  },

  /**
   * 获取网易云每日推荐（需要登录），返回旧格式歌曲列表
   */
  async getDailyRecommend() {
    const cookie = getWYCookie()
    if (!cookie) throw new Error('未登录网易云账号')
    const requestObj = httpFetch('https://music.163.com/weapi/v1/discovery/recommend/songs', {
      method: 'post',
      headers: headersWithCookie(),
      form: weapi({ c: 'WlZob2JpRnBZZE1Jb0Z4ZW5sSEhGclhGZ0JCd1FIUmVRVUp3Y0FqOE5LalJUeXhIY0JNb3RRdnhiM2duT0pIb3hRc2hFU2t1SW5nPT0=' }),
    })
    const { statusCode, body } = await requestObj.promise
    if (statusCode !== 200 || body.code !== 200) throw new Error('获取每日推荐失败')
    const songs = body.data?.dailySongs || []
    if (!songs.length) return []
    // 每日推荐返回的歌曲有时不带完整专辑封面/音质信息，
    // 这里统一走歌单详情的歌曲详情接口，保证封面与音质可靠
    return musicDetailApi.getList(songs.map(song => song.id)).then(result => result.list)
  },
}
