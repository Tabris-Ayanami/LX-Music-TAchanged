import { type Message } from '@root/lang'

// interface DownloadList {

// }


declare global {
  namespace LX {
    namespace Download {
      type DownloadTaskStatus = 'run'
      | 'waiting'
      | 'pause'
      | 'error'
      | 'completed'

      type FileExt = 'mp3' | 'flac' | 'wav' | 'ape'

      interface ProgressInfo {
        progress: number
        speed: string
        downloaded: number
        total: number
        writeQueue: number
      }

      interface AudioConvertRequest {
        inputPath: string
        outputPath: string
        extension: Extract<FileExt, 'mp3' | 'flac' | 'wav'>
        quality: LX.Quality
      }

      interface NativeDownloadRequest {
        taskId: string
        url: string
        outputPath: string
        finalPath: string
        skipExisting: boolean
        resume?: boolean
        proxy?: { host: string, port: number }
        convert?: AudioConvertRequest
      }

      interface NativeDownloadAction {
        taskId: string
        action: DownloadTaskActions
      }

      interface DownloadMetadataWriteRequest {
        filePath: string
        isEmbedLyricLx: boolean
        isEmbedLyricT: boolean
        isEmbedLyricR: boolean
        title: string
        artist: string
        album: string
        APIC: string | null
        lyrics: LX.Music.LyricInfo
        proxy?: { host: string, port: number }
      }

      interface DownloadLyricsWriteRequest {
        lrcData: LX.Music.LyricInfo
        filePath: string
        format: LX.LyricFormat
        downloadLxlrc: boolean
        downloadTlrc: boolean
        downloadRlrc: boolean
      }

      interface DownloadTaskActionBase <A> {
        action: A
      }
      interface DownloadTaskActionData<A, D> extends DownloadTaskActionBase<A> {
        data: D
      }
      type DownloadTaskAction<A, D = undefined> = D extends undefined ? DownloadTaskActionBase<A> : DownloadTaskActionData<A, D>

      type DownloadTaskActions = DownloadTaskAction<'start'>
      | DownloadTaskAction<'complete'>
      | DownloadTaskAction<'refreshUrl'>
      | DownloadTaskAction<'statusText', string>
      | DownloadTaskAction<'progress', ProgressInfo>
      | DownloadTaskAction<'error', {
        error?: keyof Message
        message?: string
      }>

      interface ListItem {
        id: string
        isComplate: boolean
        status: DownloadTaskStatus
        statusText: string
        downloaded: number
        total: number
        progress: number
        speed: string
        writeQueue: number
        metadata: {
          musicInfo: LX.Music.MusicInfoOnline
          url: string | null
          quality: LX.Quality
          ext: FileExt
          fileName: string
          filePath: string
          listId?: string
        }
      }

      interface saveDownloadMusicInfo {
        list: ListItem[]
        addMusicLocationType: LX.AddMusicLocationType
      }
    }
  }
}
