import musicDetailApi from './musicDetail'
import { getWYCookie } from './utils/index'
import { extractLoginCookie } from '@common/wyAccountCookie'
import { request, requestBody } from './ncmApi'

export default {
  /**
   * 校验网易云 Cookie 是否有效，并返回账号信息
   */
  async getAccountInfo() {
    const cookie = getWYCookie()
    if (!cookie) {
      console.warn('[wy] get account info skipped: cookie not set')
      return { hasCookie: false, isLogin: false }
    }
    try {
      const body = await requestBody('user_account')
      if (!body.profile) {
        console.warn('[wy] get account info failed: user_account profile missing, cookie may be invalid')
        return { hasCookie: true, isLogin: false }
      }
      return {
        hasCookie: true,
        isLogin: true,
        userId: body.profile.userId,
        nickname: body.profile.nickname,
      }
    } catch (err) {
      console.warn('[wy] get account info failed', err)
      return { hasCookie: true, isLogin: false }
    }
  },

  /**
   * 获取网易云每日推荐（需要登录），返回旧格式歌曲列表
   */
  async getDailyRecommend() {
    const cookie = getWYCookie()
    if (!cookie) throw new Error('未登录网易云账号')
    const body = await requestBody('recommend_songs', { afresh: false })
    const songs = body.data?.dailySongs || body.data?.recommend || []
    if (!songs.length) return []
    const detailBody = await requestBody('song_detail', {
      ids: songs.map(song => song.id).join(','),
    })
    return musicDetailApi.filterList(detailBody)
  },

  /**
   * 创建网易云扫码登录二维码
   */
  async createQrLogin() {
    const keyBody = await requestBody('login_qr_key')
    const unikey = keyBody.data?.unikey ?? keyBody.data?.data?.unikey
    if (!unikey) throw new Error('获取登录二维码失败')
    const qrBody = await requestBody('login_qr_create', {
      key: unikey,
      qrimg: true,
    })
    const qrimg = qrBody.data?.qrimg ?? ''
    if (typeof qrimg != 'string' || !qrimg.startsWith('data:')) throw new Error('获取登录二维码失败')
    return {
      unikey,
      qrimg,
    }
  },

  /**
   * 查询扫码登录状态。code 遵循 api-enhanced 约定：
   * 801 等待扫码、802 待确认、803 已授权、800 二维码过期或不存在。
   */
  async checkQrLogin(unikey) {
    const response = await request('login_qr_check', { key: unikey })
    const body = response?.body ?? {}
    return {
      code: Number(body.code ?? 0),
      cookie: extractLoginCookie(typeof body.cookie == 'string' ? body.cookie : ''),
      message: body.message ?? body.msg ?? '未知状态',
    }
  },
}
