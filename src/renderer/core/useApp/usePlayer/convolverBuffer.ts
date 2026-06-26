import { getAudioContext } from '@renderer/plugins/player'

const cache = new Map<string, AudioBuffer>()
const CACHE_LIMIT = 4

const setCache = (path: string, buffer: AudioBuffer) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  cache.set(path, buffer)
}

const loadFilterAsset = async(name: string) => {
  const mod = await import('@renderer/assets/medias/filters/' + name) as { default: string }
  return mod.default
}

export const loadConvolverBuffer = async(name: string) => {
  const path = await loadFilterAsset(name)
  if (cache.has(path)) return cache.get(path)!

  return new Promise<AudioBuffer>((resolve, reject) => {
    let request = new XMLHttpRequest()
    request.open('GET', path, true)
    request.responseType = 'arraybuffer'

    request.onload = function() {
      void getAudioContext().decodeAudioData(request.response, (buffer) => {
        if (!buffer) {
          reject(new Error('error decoding file data: ' + path))
          return
        }
        setCache(path, buffer)
        resolve(buffer)
      },
      function(error) {
        reject(error)
        console.error('decodeAudioData error', error)
      })
    }

    request.onerror = function() {
      reject(new Error('XHR error'))
    }

    request.send()
  })
}
