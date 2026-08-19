const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const APE_API_URL = 'https://api.github.com/repos/taglib/taglib/contents/tests/data/mac-399-tagged.ape?ref=6d9429b12160524f347bfde369cff3c01b561f44'
const APE_SHA256 = 'b05e359c60fa6a1a8bdb92611da30f830d212222de0cf597dbe0cadb5a0165f1'
const formats = ['mp3', 'flac', 'm4a', 'mp4', 'aac', 'ogg', 'oga', 'opus', 'wav', 'ape', 'wv', 'aiff', 'aif', 'tta', 'wma']

const ffmpegPath = path.resolve(__dirname, '../../node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe')

const run = (args) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' })

const generateAudio = (output, codec, muxer, metadata = true) => {
  const tags = metadata ? [
    '-metadata', 'title=Unicode 标题・テスト',
    '-metadata', 'artist=艺术家; Artist',
    '-metadata', 'album=Stage 1 专辑',
    '-metadata', 'album_artist=LX-TA',
    '-metadata', 'genre=Test',
    '-metadata', 'date=2026',
    '-metadata', 'track=2/9',
    '-metadata', 'disc=1/2',
    '-metadata', 'comment=integration fixture',
    '-metadata', 'composer=作曲者',
    '-metadata', 'lyrics=[00:00.00]Stage 1 embedded lyric',
  ] : []
  run(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=1.2', '-c:a', codec, ...tags, ...(muxer ? ['-f', muxer] : []), output])
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const loadApeFixture = async() => {
  const localCache = path.join(os.tmpdir(), 'lx-ta-upstream-ape.ape')
  try {
    const value = await fs.readFile(localCache)
    if (sha256(value) == APE_SHA256) return value
  } catch {}
  const response = execFileSync('curl.exe', [
    '-fsSL', '--retry', '4', '--connect-timeout', '30',
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'User-Agent: lx-ta-stage1-fixture',
    APE_API_URL,
  ], { maxBuffer: 2 * 1024 * 1024 })
  const payload = JSON.parse(response.toString())
  if (payload.encoding != 'base64' || typeof payload.content != 'string') throw new Error('Pinned TagLib APE fixture response is invalid')
  const value = Buffer.from(payload.content.replace(/\s+/g, ''), 'base64')
  if (sha256(value) != APE_SHA256) throw new Error('Pinned TagLib APE fixture checksum mismatch')
  await fs.writeFile(localCache, value)
  return value
}

const generate = async(root) => {
  root ??= await fs.mkdtemp(path.join(os.tmpdir(), 'lx-ta-stage1-'))
  const corpus = path.join(root, 'corpus')
  const work = path.join(root, 'work')
  const profile = path.join(root, 'profile')
  const cache = path.join(root, 'cache')
  await Promise.all([corpus, work, profile, cache].map(dir => fs.mkdir(dir, { recursive: true })))

  const cover = path.join(work, 'cover.png')
  const largeArtwork = path.join(corpus, 'large-artwork.png')
  const orientationArtwork = path.join(corpus, 'orientation-6.jpg')
  run(['-f', 'lavfi', '-i', 'color=c=0x315C8C:s=640x480:d=0.1', '-frames:v', '1', cover])
  run(['-f', 'lavfi', '-i', 'testsrc2=s=2048x2048:d=0.1', '-frames:v', '1', largeArtwork])
  const plainOrientation = path.join(work, 'orientation-plain.jpg')
  run(['-f', 'lavfi', '-i', 'testsrc2=s=80x40:d=0.1', '-frames:v', '1', plainOrientation])
  const jpeg = await fs.readFile(plainOrientation)
  const exif = Buffer.from([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ])
  const app1 = Buffer.alloc(4)
  app1[0] = 0xff; app1[1] = 0xe1; app1.writeUInt16BE(exif.length + 2, 2)
  await fs.writeFile(orientationArtwork, Buffer.concat([jpeg.subarray(0, 2), app1, exif, jpeg.subarray(2)]))

  const plainMp3 = path.join(work, 'plain.mp3')
  generateAudio(plainMp3, 'libmp3lame', null)
  run(['-i', plainMp3, '-i', largeArtwork, '-map', '0:a', '-map', '1:v', '-c:a', 'copy', '-c:v', 'png', '-disposition:v:0', 'attached_pic', path.join(corpus, 'representative.mp3')])

  generateAudio(path.join(corpus, 'unicode.flac'), 'flac', null)
  generateAudio(path.join(corpus, 'representative.m4a'), 'aac', 'ipod')
  generateAudio(path.join(corpus, 'representative.mp4'), 'aac', 'mp4')
  generateAudio(path.join(corpus, 'representative.aac'), 'aac', 'adts')
  generateAudio(path.join(corpus, 'representative.ogg'), 'libvorbis', 'ogg')
  generateAudio(path.join(corpus, 'representative.oga'), 'libvorbis', 'oga')
  generateAudio(path.join(corpus, 'representative.opus'), 'libopus', 'opus')
  generateAudio(path.join(corpus, 'no-metadata.wav'), 'pcm_s16le', 'wav', false)
  generateAudio(path.join(corpus, 'representative.wv'), 'wavpack', 'wv')
  generateAudio(path.join(corpus, 'representative.aiff'), 'pcm_s16be', 'aiff')
  generateAudio(path.join(corpus, 'representative.aif'), 'pcm_s16be', 'aiff')
  generateAudio(path.join(corpus, 'representative.tta'), 'tta', 'tta')
  generateAudio(path.join(corpus, 'representative.wma'), 'wmav2', 'asf')

  const ape = await loadApeFixture()
  await fs.writeFile(path.join(corpus, 'representative.ape'), ape)

  const source = await fs.readFile(path.join(corpus, 'unicode.flac'))
  await fs.writeFile(path.join(corpus, 'malformed-truncated.flac'), source.subarray(0, 96))

  return {
    root,
    corpus,
    work,
    profile,
    cache,
    ffmpegPath,
    formats,
    files: Object.fromEntries(formats.map(extension => {
      const filename = extension == 'flac' ? 'unicode.flac' : extension == 'wav' ? 'no-metadata.wav' : `representative.${extension}`
      return [extension, path.join(corpus, filename)]
    })),
    largeArtwork,
    orientationArtwork,
    malformed: path.join(corpus, 'malformed-truncated.flac'),
  }
}

module.exports = { generate, formats }

if (require.main === module) {
  generate(process.argv[2] ? path.resolve(process.argv[2]) : undefined).then(value => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`))
}
