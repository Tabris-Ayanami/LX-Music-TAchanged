import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { sizeFormate } from '@common/utils/common'
import { buildDownloadLyrics } from '@common/utils/lyricUtils/download'
import { getNativeCoreSupervisor, resolveFfmpeg } from './supervisor'

const CONVERT_TIMEOUT_MS = 30 * 60 * 1000
// Two progress updates per second are sufficient for the download UI and
// match the legacy Downloader's roughly one-second emission cadence without
// keeping the Main process in a 4x-per-second native status loop.
const DOWNLOAD_POLL_MS = 500

interface NativeTask {
  request: LX.Download.NativeDownloadRequest
  jobId: string
  paused: boolean
  removed: boolean
}

const nativeTasks = new Map<string, NativeTask>()
let nativePollTimer: NodeJS.Timeout | null = null
let nativePollInFlight = false
let nativeDownloadEventSink: ((event: LX.Download.NativeDownloadAction) => void) | null = null

export const setNativeDownloadEventSink = (sink: ((event: LX.Download.NativeDownloadAction) => void) | null) => {
  nativeDownloadEventSink = sink
}

const emitNativeDownloadAction = (taskId: string, action: LX.Download.DownloadTaskActions) => {
  nativeDownloadEventSink?.({ taskId, action })
}

const getMp3Bitrate = (quality: LX.Quality) => quality == '320k' ? '320k' : quality == '192k' ? '192k' : '128k'

const convertWithElectron = async(request: LX.Download.AudioConvertRequest) => {
  const ffmpegPath = resolveFfmpeg()
  if (!ffmpegPath) throw new Error('ffmpeg executable is unavailable')
  const args = ['-y', '-i', request.inputPath, '-vn']
  switch (request.extension) {
    case 'flac':
      args.push('-codec:a', 'flac')
      break
    case 'wav':
      args.push('-codec:a', 'pcm_s16le')
      break
    case 'mp3':
      args.push('-codec:a', 'libmp3lame', '-b:a', getMp3Bitrate(request.quality))
      break
    default:
      throw new Error(`Unsupported conversion format: ${String(request.extension)}`)
  }
  args.push(request.outputPath)
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''
    child.stderr.on('data', data => { stderr += String(data) })
    child.on('error', reject)
    child.on('close', code => {
      if (code == 0) resolve()
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code ?? 'unknown'}`))
    })
  })
}

export const convertDownloadedAudio = async(request: LX.Download.AudioConvertRequest) => {
  try {
    await getNativeCoreSupervisor().call('download.ffmpeg.convert', request, undefined, CONVERT_TIMEOUT_MS)
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'download_native_ffmpeg_fallback',
      component: 'native-core',
      message: error instanceof Error ? error.message : String(error),
    }))
    await convertWithElectron(request)
  }
}

export const resolveDownloadedFilePath = async(musicInfo: LX.Download.ListItem, savePath: string) => {
  if (!musicInfo.isComplate || /\.ape$/.test(musicInfo.metadata.fileName)) return ''
  if (await stat(musicInfo.metadata.filePath).then(info => info.isFile()).catch(() => false)) return musicInfo.metadata.filePath
  const fallbackPath = join(savePath, musicInfo.metadata.fileName)
  return await stat(fallbackPath).then(info => info.isFile() ? fallbackPath : '').catch(() => '')
}

export const writeDownloadedMetadata = async(request: LX.Download.DownloadMetadataWriteRequest) => {
  const { setMeta } = await import('@common/utils/musicMeta')
  const { filePath, isEmbedLyricLx, isEmbedLyricT, isEmbedLyricR, lyrics, proxy, ...meta } = request
  setMeta(filePath, {
    ...meta,
    lyrics: buildDownloadLyrics(lyrics, isEmbedLyricLx, isEmbedLyricT, isEmbedLyricR),
  }, proxy)
}

export const writeDownloadedLyrics = async(request: LX.Download.DownloadLyricsWriteRequest) => {
  const iconv = (await import('iconv-lite')).default
  const lyric = buildDownloadLyrics(request.lrcData, request.downloadLxlrc, request.downloadTlrc, request.downloadRlrc)
  const encoding = request.format == 'gbk' ? 'gbk' : 'utf8'
  await writeFile(request.filePath, iconv.encode(lyric, encoding, { addBOM: true }))
}

const clearNativeTask = (task: NativeTask) => {
  if (nativeTasks.get(task.request.taskId) == task) nativeTasks.delete(task.request.taskId)
  if (!nativeTasks.size && nativePollTimer) {
    clearTimeout(nativePollTimer)
    nativePollTimer = null
  }
}

const scheduleNativePoll = () => {
  if (nativePollTimer != null || nativePollInFlight || !nativeTasks.size) return
  nativePollTimer = setTimeout(() => {
    nativePollTimer = null
    void pollNativeTasks()
  }, DOWNLOAD_POLL_MS)
}

interface NativeDownloadStatus { jobId: string, state: string, total: number, downloaded: number, bytesPerSecond: number, statusCode?: number, error?: string }

const handleNativeStatus = async(task: NativeTask, status: NativeDownloadStatus) => {
  if (nativeTasks.get(task.request.taskId) != task) return
  if (status.state == 'running') {
    if (!task.paused && !task.removed) {
      const total = status.total ?? 0
      emitNativeDownloadAction(task.request.taskId, {
        action: 'progress',
        data: {
          progress: total ? Math.min(99.99, status.downloaded / total * 100) : 0,
          speed: sizeFormate(status.bytesPerSecond),
          downloaded: status.downloaded,
          total,
          writeQueue: 0,
        },
      })
    }
    return
  }

  if (status.state == 'completed') {
    if (!task.removed) {
      if (task.request.convert) {
        emitNativeDownloadAction(task.request.taskId, { action: 'statusText', data: `正在转换为 ${task.request.convert.extension.toUpperCase()}` })
        try {
          await convertDownloadedAudio(task.request.convert)
          if (task.request.outputPath != task.request.finalPath) await rm(task.request.outputPath, { force: true })
        } catch (error) {
          emitNativeDownloadAction(task.request.taskId, { action: 'error', data: { message: error instanceof Error ? error.message : String(error) } })
          clearNativeTask(task)
          return
        }
      }
      emitNativeDownloadAction(task.request.taskId, { action: 'complete' })
    }
    clearNativeTask(task)
    return
  }

  if (status.state == 'cancelled') {
    clearNativeTask(task)
    return
  }

  if (!task.removed) {
    if (status.statusCode == 401 || status.statusCode == 403 || status.statusCode == 410) {
      emitNativeDownloadAction(task.request.taskId, { action: 'refreshUrl' })
    } else {
      emitNativeDownloadAction(task.request.taskId, { action: 'error', data: { message: status.error } })
    }
  }
  clearNativeTask(task)
}

const finishNativePoll = () => {
  nativePollInFlight = false
  scheduleNativePoll()
}

const pollNativeTasks = async(): Promise<void> => {
  if (nativePollInFlight || !nativeTasks.size) return
  nativePollInFlight = true
  const tasks = [...nativeTasks.values()]
  let statuses: NativeDownloadStatus[]
  try {
    statuses = await getNativeCoreSupervisor().call<NativeDownloadStatus[]>('download.http.status_many', { jobIds: tasks.map(task => task.jobId) }, undefined, 10_000)
    const statusByJobId = new Map(statuses.map(status => [status.jobId, status]))
    await Promise.all(tasks.map(async task => {
      const status = statusByJobId.get(task.jobId)
      if (status) await handleNativeStatus(task, status)
      else if (nativeTasks.get(task.request.taskId) == task) clearNativeTask(task)
    }))
  } catch (error) {
    for (const task of tasks) {
      if (nativeTasks.get(task.request.taskId) == task && !task.removed) {
        emitNativeDownloadAction(task.request.taskId, { action: 'error', data: { message: error instanceof Error ? error.message : String(error) } })
      }
      clearNativeTask(task)
    }
  } finally {
    finishNativePoll()
  }
}

const cancelNativeTask = async(task: NativeTask) => {
  try { await getNativeCoreSupervisor().call('download.http.cancel', { jobId: task.jobId }, undefined, 10_000) } catch {}
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const status = await getNativeCoreSupervisor().call<{ state: string }>('download.http.status', { jobId: task.jobId }, undefined, 2_000)
      if (status.state != 'running') return
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

export const startNativeDownloadTask = async(request: LX.Download.NativeDownloadRequest) => {
  const previous = nativeTasks.get(request.taskId)
  if (previous) {
    previous.removed = true
    await cancelNativeTask(previous)
    clearNativeTask(previous)
  }
  if (!request.url) throw new Error('download url is empty')
  await mkdir(dirname(request.outputPath), { recursive: true })
  if (!request.resume) {
    if (request.convert) await rm(request.outputPath, { force: true })
    if (request.skipExisting) {
      try {
        const existing = await stat(request.finalPath)
        if (existing.size > 100) {
          emitNativeDownloadAction(request.taskId, { action: 'error', data: { error: 'download_status_error_check_path_exist' } })
          return
        }
      } catch {}
    } else {
      await rm(request.finalPath, { force: true })
    }
  }
  const result = await getNativeCoreSupervisor().call<{ jobId: string }>('download.http.start', {
    url: request.url,
    outputPath: request.outputPath,
    proxy: request.proxy,
  }, undefined, 30_000)
  const task: NativeTask = { request, jobId: result.jobId, paused: false, removed: false }
  nativeTasks.set(request.taskId, task)
  emitNativeDownloadAction(request.taskId, { action: 'start' })
  scheduleNativePoll()
}

export const pauseNativeDownloadTask = async(taskId: string) => {
  const task = nativeTasks.get(taskId)
  if (!task) return
  task.paused = true
  await cancelNativeTask(task)
  clearNativeTask(task)
}

export const removeNativeDownloadTask = async(taskId: string) => {
  const task = nativeTasks.get(taskId)
  if (!task) return
  task.removed = true
  await cancelNativeTask(task)
  await Promise.all([
    rm(task.request.outputPath, { force: true }),
    task.request.finalPath == task.request.outputPath ? Promise.resolve() : rm(task.request.finalPath, { force: true }),
  ])
  clearNativeTask(task)
}

export const updateNativeDownloadTaskUrl = async({ taskId, url }: { taskId: string, url: string }) => {
  const task = nativeTasks.get(taskId)
  if (!task) return
  const request = { ...task.request, url, resume: true }
  task.removed = true
  await cancelNativeTask(task)
  clearNativeTask(task)
  await startNativeDownloadTask(request)
}
