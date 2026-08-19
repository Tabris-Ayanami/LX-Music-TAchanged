#!/usr/bin/env node

'use strict'

const { connectRenderer } = require('./stage2/cdp-client.cjs')
const { collectRendererMetrics, installProbe } = require('./stage2/renderer-probe.cjs')
const { collectProcessTree } = require('./stage2/sample.cjs')

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

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const main = async() => {
  const client = await connectRenderer(port)
  try {
    await installProbe(client)
    if (targetHash) {
      await client.call('Runtime.evaluate', { expression: `location.hash = ${JSON.stringify(targetHash)}` })
      await delay(1500)
    }
    const [rendererResources, processTree, rendererState] = await Promise.all([
      collectRendererMetrics(client),
      collectProcessTree(rootPid, sampleMs),
      client.call('Runtime.evaluate', {
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

    console.log(JSON.stringify({
      capturedAt: new Date().toISOString(),
      scenario,
      rootPid,
      cdpPort: port,
      renderer: rendererState.result.value,
      rendererMetrics: rendererResources.performance,
      processMetrics: { processes: processTree.processes, totals: processTree.totals },
      gpuMemory: { available: false, reason: 'No reliable per-process GPU memory counter is available in this capture path.' },
    }, null, 2))
  } finally {
    client.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
