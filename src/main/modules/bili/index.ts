import { mainHandle } from '@common/mainIpc'
import { BILI_RENDERER_EVENT_NAME } from '@common/ipcNames'
import type { BiliAccountInfo, BiliCommentInfo, BiliCommentParams, BiliMusicQualityInfo, BiliMusicUrlResult, BiliSearchParams, BiliSearchResult, BiliSongListDetail, BiliSongListDetailParams, BiliTrackParams } from './types'

let apiModulePromise: Promise<typeof import('./api')> | null = null
let requestModulePromise: Promise<typeof import('./request')> | null = null
let authCookiePromise: Promise<void> | null = null

const getApiModule = async() => {
  return apiModulePromise ??= import('./api')
}

const getRequestModule = async() => {
  return requestModulePromise ??= import('./request')
}

const ensureAuthCookie = async() => {
  authCookiePromise ??= import('./cookie').then(({ injectAuthCookie }) => injectAuthCookie())
  await authCookiePromise
}

export default () => {
  mainHandle<BiliAccountInfo>(BILI_RENDERER_EVENT_NAME.account_get, async() => {
    await ensureAuthCookie()
    const { getAccountInfo } = await getApiModule()
    return getAccountInfo()
  })
  mainHandle<string, BiliAccountInfo>(BILI_RENDERER_EVENT_NAME.account_set_cookie, async({ params }) => {
    const { setBiliCookie } = await getRequestModule()
    const { getAccountInfo } = await getApiModule()
    await setBiliCookie(params)
    return getAccountInfo()
  })
  mainHandle<BiliAccountInfo>(BILI_RENDERER_EVENT_NAME.account_clear, async() => {
    const { clearBiliCookie } = await getRequestModule()
    await clearBiliCookie()
    return { hasCookie: false, isLogin: false }
  })
  mainHandle<BiliSearchParams, BiliSearchResult>(BILI_RENDERER_EVENT_NAME.search, async({ params }) => {
    await ensureAuthCookie()
    const { search } = await getApiModule()
    return search(params)
  })
  mainHandle<BiliTrackParams, BiliMusicQualityInfo>(BILI_RENDERER_EVENT_NAME.get_music_qualitys, async({ params }) => {
    await ensureAuthCookie()
    const { getMusicQualitys } = await getApiModule()
    return getMusicQualitys(params)
  })
  mainHandle<{ info: BiliTrackParams, type: LX.Quality }, BiliMusicUrlResult>(BILI_RENDERER_EVENT_NAME.get_music_url, async({ params }) => {
    await ensureAuthCookie()
    const { getMusicUrl } = await getApiModule()
    return getMusicUrl(params.info, params.type)
  })
  mainHandle<BiliTrackParams, string>(BILI_RENDERER_EVENT_NAME.get_pic, async({ params }) => {
    await ensureAuthCookie()
    const { getPic } = await getApiModule()
    return getPic(params)
  })
  mainHandle<BiliTrackParams, LX.Music.LyricInfo>(BILI_RENDERER_EVENT_NAME.get_lyric, async({ params }) => {
    await ensureAuthCookie()
    const { getLyric } = await getApiModule()
    return getLyric(params)
  })
  mainHandle<BiliCommentParams, BiliCommentInfo>(BILI_RENDERER_EVENT_NAME.get_comment, async({ params }) => {
    await ensureAuthCookie()
    const { getComment } = await getApiModule()
    return getComment(params)
  })
  mainHandle<BiliSongListDetailParams, BiliSongListDetail>(BILI_RENDERER_EVENT_NAME.get_songlist_detail, async({ params }) => {
    await ensureAuthCookie()
    const { getSongListDetail } = await getApiModule()
    return getSongListDetail(params)
  })
}
