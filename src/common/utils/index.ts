import type {} from '../hostBridge'

interface OptionalNodeProcess {
  platform?: NodeJS.Platform
  env?: { NODE_ENV?: string }
}

const nodeProcess = (globalThis as typeof globalThis & { process?: OptionalNodeProcess }).process
const hostRuntime = typeof window == 'undefined' ? undefined : window.lxHost?.platform
const runtimePlatform = hostRuntime?.name ?? nodeProcess?.platform ?? 'linux'

export const isLinux = runtimePlatform == 'linux'
export const isWin = runtimePlatform == 'win32'
export const isMac = runtimePlatform == 'darwin'
export const isProd = hostRuntime?.isProduction ?? nodeProcess?.env?.NODE_ENV == 'production'

export const getPlatform = (platform: NodeJS.Platform = runtimePlatform) => {
  switch (platform) {
    case 'win32': return 'windows'
    case 'darwin': return 'mac'
    default: return 'linux'
  }
}


// https://stackoverflow.com/a/53387532
export function compareVer(currentVer: string, targetVer: string): -1 | 0 | 1 {
  // treat non-numerical characters as lower version
  // replacing them with a negative number based on charcode of each character
  const fix = (s: string) => `.${s.toLowerCase().charCodeAt(0) - 2147483647}.`

  const currentVerArr: Array<string | number> = ('' + currentVer).replace(/[^0-9.]/g, fix).split('.')
  const targetVerArr: Array<string | number> = ('' + targetVer).replace(/[^0-9.]/g, fix).split('.')
  let c = Math.max(currentVerArr.length, targetVerArr.length)
  for (let i = 0; i < c; i++) {
    // convert to integer the most efficient way
    currentVerArr[i] = ~~currentVerArr[i]
    targetVerArr[i] = ~~targetVerArr[i]
    if (currentVerArr[i] > targetVerArr[i]) return 1
    else if (currentVerArr[i] < targetVerArr[i]) return -1
  }
  return 0
}

export * from './common'
