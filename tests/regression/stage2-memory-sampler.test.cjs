'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const { EventEmitter } = require('node:events')

const { connectRenderer } = require('../../scripts/performance/stage2/cdp-client.cjs')
const { installProbe, collectRendererMetrics, getProbeSource } = require('../../scripts/performance/stage2/renderer-probe.cjs')
const { collectProcessTree } = require('../../scripts/performance/stage2/sample.cjs')
const { captureSample } = require('../../scripts/performance/stage2/sample.cjs')
const { completeStage2Sample } = require('../helpers/stage2-sample-fixture.cjs')

const processTreeFixture = JSON.stringify({
  processes: [
    { pid: 10, parentPid: 0, imageName: 'LX-TA.exe', type: 'browser', workingSetMiB: 60, privateBytesMiB: 80, cpuPercentOneCore: 2, threads: 8, handles: 100 },
    { pid: 11, parentPid: 10, imageName: 'LX-TA.exe', type: 'gpu-process', workingSetMiB: 50, privateBytesMiB: 70, cpuPercentOneCore: 3, threads: 5, handles: 40 },
  ],
  totals: { processCount: 2, workingSetMiB: 110, privateBytesMiB: 150, cpuPercentOneCore: 5, threads: 13, handles: 140 },
})

test('CDP client dispatches method events without ids and supports unsubscribe', async() => {
  let socket
  class FakeWebSocket extends EventEmitter {
    constructor(url) {
      super()
      this.url = url
      socket = this
      setImmediate(() => this.emit('open'))
    }

    send(raw, callback) {
      callback?.()
      const request = JSON.parse(raw)
      setImmediate(() => this.emit('message', JSON.stringify({ id: request.id, result: {} })))
    }

    close() {
      this.emit('close')
    }
  }
  const client = await connectRenderer(9229, {
    fetchJson: async() => [{ type: 'page', title: 'LX-TA', url: 'file:///dist/index.html', webSocketDebuggerUrl: 'ws://fake' }],
    WebSocketClass: FakeWebSocket,
  })
  const received = []
  const unsubscribe = client.on('Fetch.requestPaused', params => received.push(params.requestId))
  socket.emit('message', JSON.stringify({ method: 'Fetch.requestPaused', params: { requestId: 'one' } }))
  unsubscribe()
  socket.emit('message', JSON.stringify({ method: 'Fetch.requestPaused', params: { requestId: 'two' } }))
  assert.deepEqual(received, ['one'])
  client.close()
})

test('probe reports live resources, not cumulative creations or duplicate getter calls', () => {
  let objectUrlSequence = 0
  class FakeWorker {
    terminate() {}
  }
  class FakeCanvas {
    getContext(type) {
      return type === 'webgl' ? { type } : null
    }
  }
  const canvas = new FakeCanvas()
  const elements = {
    img: [{ complete: true, naturalWidth: 20, naturalHeight: 10 }, { complete: false, naturalWidth: 30, naturalHeight: 30 }],
    video: [{}],
    canvas: [canvas],
  }
  const window = {
    URL: {
      createObjectURL() { return `blob:test-${++objectUrlSequence}` },
      revokeObjectURL() {},
    },
    Worker: FakeWorker,
    HTMLCanvasElement: FakeCanvas,
    document: { querySelectorAll: selector => elements[selector] ?? [] },
  }
  window.window = window
  vm.runInNewContext(getProbeSource(), window)

  const first = window.URL.createObjectURL({})
  window.URL.createObjectURL({})
  window.URL.revokeObjectURL(first)
  const worker1 = new window.Worker('one.js')
  new window.Worker('two.js')
  new window.Worker('three.js')
  worker1.terminate()
  canvas.getContext('webgl')
  canvas.getContext('webgl')

  const probe = window.__LX_STAGE2_MEMORY_PROBE__
  assert.deepEqual(Object.keys(probe), ['snapshot'])
  const snapshot = probe.snapshot()
  assert.equal(snapshot.liveObjectUrls, 1)
  assert.deepEqual({ ...snapshot.objectUrls }, { live: 1, created: 2, revoked: 1 })
  assert.equal(snapshot.workers.live, 2)
  assert.equal(snapshot.workers.created, 3)
  assert.equal(snapshot.workers.terminated, 1)
  assert.equal(snapshot.contexts.webgl, 1)
  assert.deepEqual({ ...snapshot.dom }, { images: 2, loadedImages: 1, loadedImagePixels: 200, videos: 1, canvases: 1 })
})

test('renderer collection installs the early probe, reloads once, waits, and keeps CDP workers separate', async() => {
  const calls = []
  const client = {
    async call(method, params = {}) {
      calls.push({ method, params })
      if (method === 'Runtime.evaluate' && params.expression.includes('__LX_STAGE2_MEMORY_PROBE__')) {
        return { result: { value: { liveObjectUrls: 1, workers: { live: 2 }, contexts: { webgl: 1 }, dom: {} } } }
      }
      if (method === 'Performance.getMetrics') {
        return { metrics: [{ name: 'JSHeapUsedSize', value: 1048576 }, { name: 'Documents', value: 2 }, { name: 'Ignored', value: 9 }] }
      }
      if (method === 'Target.getTargets') {
        return { targetInfos: [{ type: 'worker' }, { type: 'service_worker' }, { type: 'page' }] }
      }
      return {}
    },
  }

  await installProbe(client, { waitForReady: async() => calls.push({ method: 'test.waitForReady', params: {} }) })
  const renderer = await collectRendererMetrics(client)

  assert.equal(calls.filter(call => call.method === 'Page.addScriptToEvaluateOnNewDocument').length, 1)
  assert.equal(calls.filter(call => call.method === 'Page.reload').length, 1)
  assert.equal(calls.filter(call => call.method === 'test.waitForReady').length, 1)
  assert.equal(renderer.liveObjectUrls, 1)
  assert.equal(renderer.workers.live, 2)
  assert.deepEqual(renderer.cdpTargets, { workers: 1, serviceWorkers: 1 })
  assert.deepEqual(renderer.performance, { JSHeapUsedSize: 1048576, Documents: 2 })
})

test('process sampler accepts literal PowerShell JSON and captureSample validates and writes the complete sample', async() => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-stage2-sampler-'))
  const nativeCachePath = path.join(temporaryRoot, 'native-cache')
  const outputPath = path.join(temporaryRoot, 'sample.json')
  await fs.mkdir(path.join(nativeCachePath, 'nested'), { recursive: true })
  await fs.writeFile(path.join(nativeCachePath, 'art.bin'), Buffer.alloc(3))
  await fs.writeFile(path.join(nativeCachePath, 'nested', 'art.bin'), Buffer.alloc(5))

  try {
    const tree = await collectProcessTree(10, 1000, {
      runPowerShell: async(scriptPath, args) => {
        assert.match(scriptPath, /process-tree\.ps1$/)
        assert.deepEqual(args, ['-RootPid', '10', '-SampleMs', '1000'])
        return processTreeFixture
      },
    })
    const sample = await captureSample({
      rootPid: 10,
      cdpPort: 9229,
      sampleMs: 1000,
      scenario: 'discover-idle',
      phase: 'stable',
      temperature: 'warm',
      variant: 'electron-control',
      attribution: { variant: 'electron-control', measurable: true, effectiveControls: [] },
      runIndex: 2,
      elapsedMs: 12000,
      workspaceManifest: { nativeCachePath },
      outputPath,
      collectRenderer: async() => completeStage2Sample().renderer,
      collectProcesses: async() => tree,
    })

    assert.equal(sample.processTotals.privateBytesMiB, 150)
    assert.equal(sample.processes.find(process => process.type === 'gpu-process').privateBytesMiB, 70)
    assert.deepEqual(sample.gpuMemory, {
      available: false,
      reason: 'No reliable GPU-memory counter is available in this capture path.',
    })
    assert.equal(sample.renderer.liveObjectUrls, 1)
    assert.equal(sample.renderer.workers.live, 2)
    assert.equal(sample.renderer.contexts.webgl, 2)
    assert.deepEqual(sample.attribution, { variant: 'electron-control', measurable: true, effectiveControls: [] })
    assert.deepEqual(sample.nativeCache, { path: nativeCachePath, files: 2, bytes: 8 })
    assert.deepEqual(JSON.parse(await fs.readFile(outputPath, 'utf8')), sample)
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true })
  }
})
