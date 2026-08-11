#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const WebSocket = require('ws')

const args = new Map(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('=')
  return index < 0 ? [arg.replace(/^--/, ''), 'true'] : [arg.slice(2, index), arg.slice(index + 1)]
}))
const rootPid = Number(args.get('pid'))
const port = Number(args.get('port') ?? 9229)
const scenario = args.get('scenario') ?? 'unspecified'
const sampleMs = Math.max(500, Number(args.get('sample-ms') ?? 3000))
const targetHash = args.get('hash')

if (!Number.isInteger(rootPid) || rootPid <= 0) {
  console.error('Usage: npm run baseline:capture -- --pid=<electron-browser-pid> [--port=9229] [--scenario=idle]')
  process.exit(2)
}

const fetchJson = async path => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`)
  if (!response.ok) throw new Error(`CDP ${path} returned ${response.status}`)
  return response.json()
}

const main = async() => {
const targets = await fetchJson('/json')
const page = targets.find(target => target.type === 'page' && /\/dist\/index\.html|\\dist\\index\.html/i.test(decodeURIComponent(target.url))) ??
  targets.find(target => target.type === 'page' && target.title !== 'User api')
if (!page?.webSocketDebuggerUrl) throw new Error('LX-TA renderer target was not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.once('open', resolve)
  socket.once('error', reject)
})

let sequence = 0
const pending = new Map()
socket.on('message', raw => {
  const message = JSON.parse(String(raw))
  if (!message.id) return
  const waiter = pending.get(message.id)
  if (!waiter) return
  pending.delete(message.id)
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result)
})
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})

await call('Performance.enable')
if (targetHash) {
  await call('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(targetHash)}` })
  await new Promise(resolve => setTimeout(resolve, 1500))
}
const [performanceMetrics, rendererState] = await Promise.all([
  call('Performance.getMetrics'),
  call('Runtime.evaluate', {
    expression: `(() => {
      const navigation = performance.getEntriesByType('navigation')[0]
      const paints = Object.fromEntries(performance.getEntriesByType('paint').map(entry => [entry.name, entry.startTime]))
      return {
        title: document.title,
        hash: location.hash,
        visibility: document.visibilityState,
        nodes: document.getElementsByTagName('*').length,
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
        loadEventEndMs: navigation?.loadEventEnd ?? null,
        firstPaintMs: paints['first-paint'] ?? null,
        firstContentfulPaintMs: paints['first-contentful-paint'] ?? null,
      }
    })()`,
    returnByValue: true,
  }),
])
socket.close()

const powershell = String.raw`
$rootPid = ${rootPid}
$sampleSeconds = ${sampleMs / 1000}
$all = Get-CimInstance Win32_Process
$ids = [System.Collections.Generic.HashSet[int]]::new()
[void]$ids.Add($rootPid)
do {
  $previousCount = $ids.Count
  foreach ($item in $all) {
    if ($ids.Contains([int]$item.ParentProcessId)) { [void]$ids.Add([int]$item.ProcessId) }
  }
} while ($ids.Count -gt $previousCount)
if (-not ($all | Where-Object ProcessId -eq $rootPid)) { throw 'Electron root process not found' }
$cpuBefore = @{}
foreach ($id in $ids) {
  $process = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($process) { $cpuBefore[$id] = $process.CPU }
}
Start-Sleep -Milliseconds ${sampleMs}
$rows = foreach ($id in $ids) {
  $process = Get-Process -Id $id -ErrorAction SilentlyContinue
  $cim = $all | Where-Object ProcessId -eq $id | Select-Object -First 1
  if ($process) {
    [pscustomobject]@{
      pid = $id
      parentPid = [int]$cim.ParentProcessId
      type = if ($cim.CommandLine -match '--type=([^ ]+)') { $Matches[1] } else { 'browser' }
      workingSetMiB = [math]::Round($process.WorkingSet64 / 1MB, 2)
      privateBytesMiB = [math]::Round($process.PrivateMemorySize64 / 1MB, 2)
      cpuPercentOneCore = [math]::Round((($process.CPU - $cpuBefore[$id]) / $sampleSeconds) * 100, 1)
      threads = $process.Threads.Count
      handles = $process.HandleCount
    }
  }
}
[pscustomobject]@{
  processes = @($rows)
  totals = [pscustomobject]@{
    processCount = @($rows).Count
    workingSetMiB = [math]::Round(($rows | Measure-Object workingSetMiB -Sum).Sum, 2)
    privateBytesMiB = [math]::Round(($rows | Measure-Object privateBytesMiB -Sum).Sum, 2)
    cpuPercentOneCore = [math]::Round(($rows | Measure-Object cpuPercentOneCore -Sum).Sum, 1)
    threads = ($rows | Measure-Object threads -Sum).Sum
    handles = ($rows | Measure-Object handles -Sum).Sum
  }
} | ConvertTo-Json -Depth 5 -Compress
`

const processResult = spawnSync('powershell.exe', ['-NoProfile', '-Command', powershell], { encoding: 'utf8' })
if (processResult.status !== 0) throw new Error(processResult.stderr || `PowerShell exited ${processResult.status}`)
const processMetrics = JSON.parse(processResult.stdout.trim())
const selectedMetrics = Object.fromEntries(performanceMetrics.metrics
  .filter(metric => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Documents', 'Frames', 'Nodes', 'LayoutCount', 'RecalcStyleCount'].includes(metric.name))
  .map(metric => [metric.name, metric.value]))

console.log(JSON.stringify({
  capturedAt: new Date().toISOString(),
  scenario,
  rootPid,
  cdpPort: port,
  renderer: rendererState.result.value,
  rendererMetrics: selectedMetrics,
  processMetrics,
  gpuMemory: { available: false, reason: 'No reliable per-process GPU memory counter is available in this capture path.' },
}, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
