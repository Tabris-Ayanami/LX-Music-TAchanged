import { mainHandle } from '@common/mainIpc'
import { BILI_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { clearBiliCookie, setBiliCookie } from './request'
import { getAccountInfo, getComment, getLyric, getMusicQualitys, getMusicUrl, getPic, getSongListDetail, search } from './api'
import type { BiliAccountInfo, BiliCommentInfo, BiliCommentParams, BiliMusicQualityInfo, BiliMusicUrlResult, BiliSearchParams, BiliSearchResult, BiliSongListDetail, BiliSongListDetailParams, BiliTrackParams } from './types'
import { injectAuthCookie } from './cookie'

export default () => {
  void injectAuthCookie()

  mainHandle<BiliAccountInfo>(BILI_RENDERER_EVENT_NAME.account_get, async() => {
    return getAccountInfo()
  })
  mainHandle<string, BiliAccountInfo>(BILI_RENDERER_EVENT_NAME.account_set_cookie, async({ params }) => {
    await setBiliCookie(params)
    return getAccountInfo()
  })
  mainHandle<BiliAccountInfo>(BILI_RENDERER_EVENT_NAME.account_clear, async() => {
    await clearBiliCookie()
    return { hasCookie: false, isLogin: false }
  })
  mainHandle<BiliSearchParams, BiliSearchResult>(BILI_RENDERER_EVENT_NAME.search, async({ params }) => {
    return search(params)
  })
  mainHandle<BiliTrackParams, BiliMusicQualityInfo>(BILI_RENDERER_EVENT_NAME.get_music_qualitys, async({ params }) => {
    return getMusicQualitys(params)
  })
  mainHandle<{ info: BiliTrackParams, type: LX.Quality }, BiliMusicUrlResult>(BILI_RENDERER_EVENT_NAME.get_music_url, async({ params }) => {
    return getMusicUrl(params.info, params.type)
  })
  mainHandle<BiliTrackParams, string>(BILI_RENDERER_EVENT_NAME.get_pic, async({ params }) => {
    return getPic(params)
  })
  mainHandle<BiliTrackParams, LX.Music.LyricInfo>(BILI_RENDERER_EVENT_NAME.get_lyric, async({ params }) => {
    return getLyric(params)
  })
  mainHandle<BiliCommentParams, BiliCommentInfo>(BILI_RENDERER_EVENT_NAME.get_comment, async({ params }) => {
    return getComment(params)
  })
  mainHandle<BiliSongListDetailParams, BiliSongListDetail>(BILI_RENDERER_EVENT_NAME.get_songlist_detail, async({ params }) => {
    return getSongListDetail(params)
  })
}
