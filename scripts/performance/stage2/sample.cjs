'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { assertSample, STAGE2_SAMPLE_VERSION } = require('./schema.cjs')
const { collectRendererMetrics } = require('./renderer-probe.cjs')

const execFileAsync = promisify(execFile)
const PROCESS_TREE_SCRIPT = path.join(__dirname, 'process-tree.ps1')
const GPU_MEMORY_UNAVAILABLE = Object.freeze({
  available: false,
  reason: 'No reliable GPU-memory counter is available in this capture path.',
})

const defaultRunPowerShell = async(scriptPath, args) => {
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...args,
  ], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
  return stdout
}

const collectProcessTree = async(rootPid, sampleMs, options = {}) => {
  if (!Number.isInteger(rootPid) || rootPid <= 0) throw new TypeError('rootPid must be a positive integer')
  if (!Number.isInteger(sampleMs) || sampleMs <= 0) throw new TypeError('sampleMs must be a positive integer')
  const output = await (options.runPowerShell ?? defaultRunPowerShell)(PROCESS_TREE_SCRIPT, [
    '-RootPid', String(rootPid), '-SampleMs', String(sampleMs),
  ])
  const tree = typeof output === 'string' ? JSON.parse(output.trim()) : output
  if (!tree || !Array.isArray(tree.processes) || !tree.totals || tree.processes.length !== tree.totals.processCount) {
    throw new Error('PowerShell process tree output is incomplete')
  }
  return tree
}

const measureDirectory = async rootPath => {
  const absoluteRoot = path.resolve(rootPath)
  let files = 0
  let bytes = 0
  const visit = async directoryPath => {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name)
      if (entry.isSymbolicLink()) throw new Error(`native cache contains a linked entry: ${entryPath}`)
      if (entry.isDirectory()) {
        await visit(entryPath)
      } else if (entry.isFile()) {
        const stats = await fs.stat(entryPath)
        files += 1
        bytes += stats.size
      }
    }
  }
  await visit(absoluteRoot)
  return { path: absoluteRoot, files, bytes }
}

const captureSample = async context => {
  if (!context || typeof context !== 'object') throw new TypeError('capture context is required')
  const collectRenderer = context.collectRenderer ?? (() => collectRendererMetrics(context.client))
  const collectProcesses = context.collectProcesses ?? (() => collectProcessTree(context.rootPid, context.sampleMs))
  const [renderer, processTree, nativeCache] = await Promise.all([
    collectRenderer(),
    collectProcesses(),
    measureDirectory(context.workspaceManifest.nativeCachePath),
  ])
  const sample = {
    version: STAGE2_SAMPLE_VERSION,
    capturedAt: new Date().toISOString(),
    scenario: context.scenario,
    phase: context.phase,
    temperature: context.temperature,
    variant: context.variant,
    runIndex: context.runIndex,
    elapsedMs: context.elapsedMs,
    rootPid: context.rootPid,
    cdpPort: context.cdpPort,
    renderer,
    processes: processTree.processes,
    processTotals: processTree.totals,
    nativeCache,
    gpuMemory: { ...GPU_MEMORY_UNAVAILABLE },
  }
  assertSample(sample)
  if (context.outputPath) {
    await fs.writeFile(context.outputPath, `${JSON.stringify(sample, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  }
  return sample
}

module.exports = { GPU_MEMORY_UNAVAILABLE, captureSample, collectProcessTree, measureDirectory }
