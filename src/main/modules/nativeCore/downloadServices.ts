import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { mkdir, rm, stat } from 'node:fs/promises'
import { sizeFormate } from '@common/utils/common'
import { getNativeCoreSupervisor, resolveFfmpeg } from './supervisor'

const CONVERT_TIMEOUT_MS = 30 * 60 * 1000
const DOWNLOAD_POLL_MS = 250

interface NativeTask {
  request: LX.Download.NativeDownloadRequest
  jobId: string
  timer: NodeJS.Timeout | null
  paused: boolean
  removed: boolean
}

const nativeTasks = new Map<string, NativeTask>()
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

const clearNativeTask = (task: NativeTask) => {
  if (task.timer) clearTimeout(task.timer)
  if (nativeTasks.get(task.request.taskId) == task) nativeTasks.delete(task.request.taskId)
}

const scheduleNativePoll = (task: NativeTask) => {
  if (task.timer != null || nativeTasks.get(task.request.taskId) != task) return
  task.timer = setTimeout(() => {
    task.timer = null
    void pollNativeTask(task)
  }, DOWNLOAD_POLL_MS)
}

const pollNativeTask = async(task: NativeTask): Promise<void> => {
  if (nativeTasks.get(task.request.taskId) != task) return
  let status: { state: string, total: number, downloaded: number, bytesPerSecond: number, statusCode?: number, error?: string }
  try {
    status = await getNativeCoreSupervisor().call('download.http.status', { jobId: task.jobId }, undefined, 10_000)
  } catch (error) {
    emitNativeDownloadAction(task.request.taskId, { action: 'error', data: { message: error instanceof Error ? error.message : String(error) } })
    clearNativeTask(task)
    return
  }

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
    scheduleNativePoll(task)
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
  const task: NativeTask = { request, jobId: result.jobId, timer: null, paused: false, removed: false }
  nativeTasks.set(request.taskId, task)
  emitNativeDownloadAction(request.taskId, { action: 'start' })
  scheduleNativePoll(task)
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
