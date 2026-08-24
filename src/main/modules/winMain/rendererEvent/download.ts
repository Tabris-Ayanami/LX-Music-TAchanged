import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainHandle } from '@common/mainIpc'
import { sendEvent } from '../main'
import {
  convertDownloadedAudio,
  pauseNativeDownloadTask,
  removeNativeDownloadTask,
  setNativeDownloadEventSink,
  startNativeDownloadTask,
  updateNativeDownloadTaskUrl,
  writeDownloadedLyrics,
  writeDownloadedMetadata,
} from '@main/modules/nativeCore/downloadServices'


export default () => {
  setNativeDownloadEventSink(event => { sendEvent(WIN_MAIN_RENDERER_EVENT_NAME.download_task_action, event) })
  mainHandle<LX.Download.ListItem[]>(WIN_MAIN_RENDERER_EVENT_NAME.download_list_get, async() => {
    return global.lx.worker.dbService.getDownloadList()
  })
  mainHandle<LX.Download.saveDownloadMusicInfo>(WIN_MAIN_RENDERER_EVENT_NAME.download_list_add, async({ params: { list, addMusicLocationType } }) => {
    await global.lx.worker.dbService.downloadInfoSave(list, addMusicLocationType)
  })
  mainHandle<LX.Download.ListItem[]>(WIN_MAIN_RENDERER_EVENT_NAME.download_list_update, async({ params: list }) => {
    await global.lx.worker.dbService.downloadInfoUpdate(list)
  })
  mainHandle<string[]>(WIN_MAIN_RENDERER_EVENT_NAME.download_list_remove, async({ params: ids }) => {
    await global.lx.worker.dbService.downloadInfoRemove(ids)
  })
  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.download_list_clear, async() => {
    await global.lx.worker.dbService.downloadInfoClear()
  })
  mainHandle<LX.Download.AudioConvertRequest>(WIN_MAIN_RENDERER_EVENT_NAME.convert_download_audio, async({ params }) => {
    await convertDownloadedAudio(params)
  })
  mainHandle<LX.Download.NativeDownloadRequest>(WIN_MAIN_RENDERER_EVENT_NAME.download_task_start, async({ params }) => {
    await startNativeDownloadTask(params)
  })
  mainHandle<string>(WIN_MAIN_RENDERER_EVENT_NAME.download_task_pause, async({ params }) => {
    await pauseNativeDownloadTask(params)
  })
  mainHandle<string>(WIN_MAIN_RENDERER_EVENT_NAME.download_task_remove, async({ params }) => {
    await removeNativeDownloadTask(params)
  })
  mainHandle<{ taskId: string, url: string }>(WIN_MAIN_RENDERER_EVENT_NAME.download_task_update_url, async({ params }) => {
    await updateNativeDownloadTaskUrl(params)
  })
  mainHandle<LX.Download.DownloadMetadataWriteRequest>(WIN_MAIN_RENDERER_EVENT_NAME.download_write_metadata, async({ params }) => {
    await writeDownloadedMetadata(params)
  })
  mainHandle<LX.Download.DownloadLyricsWriteRequest>(WIN_MAIN_RENDERER_EVENT_NAME.download_write_lyrics, async({ params }) => {
    await writeDownloadedLyrics(params)
  })
}
