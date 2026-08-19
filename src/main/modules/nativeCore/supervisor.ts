import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const PROTOCOL_VERSION = '1.0'
const MAX_FRAME_BYTES = 16 * 1024 * 1024
const START_TIMEOUT_MS = 8_000
const REQUEST_TIMEOUT_MS = 30_000

export interface NativeHandshake {
  protocolVersion: string
  coreVersion: string
  capabilities: string[]
  pid: number
}

interface NativeError {
  code: string
  message: string
  details?: Record<string, unknown>
}

interface NativeResponse<T> {
  protocolVersion: string
  requestId: string
  result?: T
  error?: NativeError
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error & { code?: string, details?: Record<string, unknown> }) => void
  timer: NodeJS.Timeout
}

const delay = async(ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const structuredLog = (level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) => {
  const message = JSON.stringify({ level, event, component: 'native-core-supervisor', ...data })
  if (level == 'error') console.error(message)
  else if (level == 'warn') console.warn(message)
  else console.log(message)
}

const resolveExecutable = () => {
  if (globalThis.process.env.LX_NATIVE_CORE_PATH) return path.resolve(globalThis.process.env.LX_NATIVE_CORE_PATH)
  if (app.isPackaged) return path.join(process.resourcesPath, 'native-core', 'lx-native-core.exe')
  return path.join(process.cwd(), 'native-core', 'target', globalThis.process.env.LX_NATIVE_RELEASE == 'true' ? 'release' : 'debug', 'lx-native-core.exe')
}

const resolveFfmpeg = () => {
  if (globalThis.process.env.LX_NATIVE_FFMPEG_PATH) return path.resolve(globalThis.process.env.LX_NATIVE_FFMPEG_PATH)
  const candidate = path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe')
  return existsSync(candidate) ? candidate : null
}

export class NativeCoreSupervisor {
  private process: ChildProcessWithoutNullStreams | null = null
  private socket: net.Socket | null = null
  private startPromise: Promise<NativeHandshake> | null = null
  private handshakeValue: NativeHandshake | null = null
  private receiveBuffer = Buffer.alloc(0)
  private readonly pending = new Map<string, PendingRequest>()
  private stopping = false

  async handshake(): Promise<NativeHandshake> {
    return this.ensureStarted()
  }

  async call<T>(method: string, params: unknown, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw this.createError('aborted', 'Native request cancelled')
    await this.ensureStarted()
    return this.sendRequest<T>(method, params, signal)
  }

  async stop() {
    this.stopping = true
    this.socket?.destroy()
    this.socket = null
    const child = this.process
    this.process = null
    this.handshakeValue = null
    this.startPromise = null
    if (child && !child.killed) child.kill()
    this.rejectPending(this.createError('backend_unavailable', 'Native core stopped'))
  }

  private async ensureStarted(): Promise<NativeHandshake> {
    if (this.handshakeValue && this.socket && !this.socket.destroyed) return this.handshakeValue
    this.startPromise ??= this.start()
    try {
      return await this.startPromise
    } catch (error) {
      this.startPromise = null
      throw error
    }
  }

  private async start(): Promise<NativeHandshake> {
    const executable = resolveExecutable()
    if (!existsSync(executable)) throw this.createError('backend_unavailable', `Native core executable not found: ${executable}`)
    const profile = globalThis.process.env.LX_NATIVE_PROFILE_PATH ? path.resolve(globalThis.process.env.LX_NATIVE_PROFILE_PATH) : path.join(global.lxDataPath, 'native-core')
    const cache = globalThis.process.env.LX_NATIVE_CACHE_PATH ? path.resolve(globalThis.process.env.LX_NATIVE_CACHE_PATH) : path.join(profile, 'cache')
    await Promise.all([mkdir(profile, { recursive: true }), mkdir(cache, { recursive: true })])
    const pipeName = `\\\\.\\pipe\\lx-ta-native-${process.pid}-${randomUUID()}`
    const args = ['--pipe', pipeName, '--profile', profile, '--cache', cache]
    const ffmpeg = resolveFfmpeg()
    if (ffmpeg) args.push('--ffmpeg', ffmpeg)
    this.stopping = false
    const child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    this.process = child
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/).filter(Boolean)) structuredLog('info', 'sidecar_log', { line })
    })
    child.on('error', error => { this.handleExit(error) })
    child.on('exit', (code, signal) => { this.handleExit(this.createError('backend_unavailable', `Native core exited (${code ?? signal ?? 'unknown'})`)) })

    const startedAt = Date.now()
    let lastError: unknown
    while (Date.now() - startedAt < START_TIMEOUT_MS) {
      if (child.exitCode != null) break
      try {
        await this.connect(pipeName)
        const handshake = await this.sendRequest<NativeHandshake>('core.handshake', {})
        if (handshake.protocolVersion != PROTOCOL_VERSION) throw this.createError('conflict', `Native protocol mismatch: ${handshake.protocolVersion}`)
        this.handshakeValue = handshake
        structuredLog('info', 'sidecar_ready', { pid: handshake.pid, version: handshake.coreVersion, capabilities: handshake.capabilities })
        return handshake
      } catch (error) {
        lastError = error
        this.socket?.destroy()
        this.socket = null
        await delay(80)
      }
    }
    child.kill()
    throw this.createError('backend_unavailable', `Native core failed to start: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  }

  private async connect(pipeName: string) {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const candidate = net.createConnection(pipeName)
      candidate.once('connect', () => { resolve(candidate) })
      candidate.once('error', reject)
    })
    this.socket = socket
    this.receiveBuffer = Buffer.alloc(0)
    socket.on('data', chunk => { this.onData(chunk) })
    socket.on('error', error => { this.handleExit(error) })
    socket.on('close', () => {
      if (!this.stopping) this.handleExit(this.createError('backend_unavailable', 'Native pipe closed'))
    })
  }

  private async sendRequest<T>(method: string, params: unknown, signal?: AbortSignal): Promise<T> {
    const socket = this.socket
    if (!socket || socket.destroyed) throw this.createError('backend_unavailable', 'Native core is not connected')
    const requestId = randomUUID()
    const payload = Buffer.from(JSON.stringify({ protocolVersion: PROTOCOL_VERSION, requestId, method, params }))
    if (payload.length > MAX_FRAME_BYTES) throw this.createError('invalid_argument', 'Native request exceeds frame limit')
    const frame = Buffer.allocUnsafe(4 + payload.length)
    frame.writeUInt32LE(payload.length, 0)
    payload.copy(frame, 4)
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(this.createError('backend_unavailable', `Native request timed out: ${method}`))
      }, REQUEST_TIMEOUT_MS)
      const onAbort = () => {
        void this.sendCancellation(requestId)
        const pending = this.pending.get(requestId)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(requestId)
        pending.reject(this.createError('aborted', 'Native request cancelled'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      this.pending.set(requestId, {
        timer,
        resolve: value => { signal?.removeEventListener('abort', onAbort); resolve(value as T) },
        reject: error => { signal?.removeEventListener('abort', onAbort); reject(error) },
      })
      socket.write(frame, error => {
        if (!error) return
        const pending = this.pending.get(requestId)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(requestId)
        pending.reject(this.createError('backend_unavailable', error.message))
      })
    })
  }

  private async sendCancellation(requestId: string) {
    try { await this.sendRequest('rpc.cancel', { requestId }) } catch {}
  }

  private onData(chunk: Buffer) {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk])
    while (this.receiveBuffer.length >= 4) {
      const size = this.receiveBuffer.readUInt32LE(0)
      if (size > MAX_FRAME_BYTES) {
        this.handleExit(this.createError('invalid_argument', `Native response exceeds frame limit: ${size}`))
        return
      }
      if (this.receiveBuffer.length < 4 + size) return
      const payload = this.receiveBuffer.subarray(4, 4 + size)
      this.receiveBuffer = this.receiveBuffer.subarray(4 + size)
      try { this.resolveResponse(JSON.parse(payload.toString('utf8')) as NativeResponse<unknown>) } catch (error) { this.handleExit(error) }
    }
  }

  private resolveResponse(response: NativeResponse<unknown>) {
    const pending = this.pending.get(response.requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(response.requestId)
    if (response.protocolVersion != PROTOCOL_VERSION) {
      pending.reject(this.createError('conflict', `Native response protocol mismatch: ${response.protocolVersion}`))
    } else if (response.error) {
      pending.reject(this.createError(response.error.code, response.error.message, response.error.details))
    } else {
      pending.resolve(response.result)
    }
  }

  private handleExit(error: unknown) {
    const normalized = error instanceof Error ? error : this.createError('backend_unavailable', String(error))
    this.socket?.destroy()
    this.socket = null
    this.handshakeValue = null
    this.startPromise = null
    this.rejectPending(normalized)
    if (!this.stopping) structuredLog('warn', 'sidecar_unavailable', { message: normalized.message })
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private createError(code: string, message: string, details?: Record<string, unknown>) {
    return Object.assign(new Error(message), { code, details })
  }
}

let supervisor: NativeCoreSupervisor | null = null
export const getNativeCoreSupervisor = () => supervisor ??= new NativeCoreSupervisor()
export const shutdownNativeCore = async() => supervisor?.stop()
