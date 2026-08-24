import { spawn } from 'node:child_process'
import { getNativeCoreSupervisor, resolveFfmpeg } from './supervisor'

const CONVERT_TIMEOUT_MS = 30 * 60 * 1000

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
      throw new Error(`Unsupported conversion format: ${request.extension}`)
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
