/**
 * 当前播放歌曲的动态封面状态
 *
 * 在切换歌曲时由调用方触发 loadDynamicCover，成功后按展示场景保存传统、
 * 沉浸、像素三种动态封面视频地址。解析失败/无动态封面时为 null，界面回退静态封面。
 */
import { ref } from '@common/utils/vueTools'
import { getAppleDynamicCover, clearAppleDynamicCoverCache } from '@renderer/utils/appleDynamicCover'

export type DynamicCoverState = 'idle' | 'loading' | 'ready' | 'error'

/** 当前歌曲的传统详情页动态封面视频地址 */
export const dynamicCoverUrl = ref<string | null>(null)
/** 沉浸模式背景使用的动态封面视频地址 */
export const dynamicCoverUrlImmersive = ref<string | null>(null)
/** 像素漫延布局使用的动态封面视频地址 */
export const dynamicCoverUrlPixel = ref<string | null>(null)
/** 动态封面的预览帧地址（可作 poster） */
export const dynamicCoverPoster = ref<string | null>(null)
/** 加载状态 */
export const dynamicCoverState = ref<DynamicCoverState>('idle')
/** 当前正在加载的歌曲 key */
let pendingKey = ''
let pendingPromise: Promise<boolean> | null = null
/** 上一次触发加载的歌曲 key */
let lastRequestKey = ''
let requestGeneration = 0

const getRequestKey = (info: { id?: string | null, name: string, singer: string, album: string }) => {
  const id = info.id?.trim?.() ?? ''
  return id ? `id:${id}` : `text:${[info.name, info.singer, info.album].map(v => v?.trim?.() ?? '').join('|')}`
}

export interface LoadDynamicCoverInfo {
  id?: string | null
  name: string
  singer: string
  album: string
}

/**
 * 根据当前歌曲加载动态封面
 * @returns 是否成功加载到动态封面
 */
export const loadDynamicCover = async(info: LoadDynamicCoverInfo): Promise<boolean> => {
  const requestKey = getRequestKey(info)
  if (requestKey && requestKey == pendingKey && pendingPromise) {
    // 同一首歌正在加载中，不重复请求
    return pendingPromise
  }
  if (requestKey && requestKey == lastRequestKey && dynamicCoverUrl.value) {
    // 同一首歌已成功加载过，直接返回
    return Promise.resolve(true)
  }
  const generation = ++requestGeneration
  lastRequestKey = requestKey
  pendingKey = requestKey

  dynamicCoverState.value = 'loading'
  dynamicCoverUrl.value = null
  dynamicCoverUrlImmersive.value = null
  dynamicCoverUrlPixel.value = null
  dynamicCoverPoster.value = null

  const task = getAppleDynamicCover({
    name: info.name,
    singer: info.singer,
    album: info.album,
  }).then(result => {
    if (generation != requestGeneration || (requestKey && requestKey != lastRequestKey)) return false
    if (result) {
      dynamicCoverUrl.value = result.videoUrl
      dynamicCoverUrlImmersive.value = result.videoUrlImmersive ?? result.videoUrl
      dynamicCoverUrlPixel.value = result.videoUrlPixel ?? result.videoUrl
      dynamicCoverPoster.value = result.posterUrl
      dynamicCoverState.value = 'ready'
      return true
    }
    dynamicCoverState.value = 'error'
    return false
  }).catch(err => {
    console.warn('[dynamicCover] load failed', err)
    if (generation == requestGeneration) dynamicCoverState.value = 'error'
    return false
  }).finally(() => {
    if (pendingPromise == task) {
      pendingKey = ''
      pendingPromise = null
    }
  })
  pendingPromise = task
  return task
}

/** 重置状态（例如停止播放时） */
export const resetDynamicCover = () => {
  requestGeneration++
  pendingKey = ''
  pendingPromise = null
  lastRequestKey = ''
  dynamicCoverState.value = 'idle'
  dynamicCoverUrl.value = null
  dynamicCoverUrlImmersive.value = null
  dynamicCoverUrlPixel.value = null
  dynamicCoverPoster.value = null
}

/** 清空已缓存的动态封面查询结果 */
export const clearDynamicCoverCache = () => {
  clearAppleDynamicCoverCache()
  resetDynamicCover()
}
