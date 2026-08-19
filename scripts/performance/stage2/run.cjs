'use strict'

const fs = require('node:fs/promises')
const net = require('node:net')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const treeKill = require('tree-kill')
const ELECTRON_PATH = require('electron')
const { assertSample } = require('./schema.cjs')
const { connectRenderer } = require('./cdp-client.cjs')
const { installProbe } = require('./renderer-probe.cjs')
const { captureSample } = require('./sample.cjs')
const { createScenarioDrivers, copyResolvedScenarioConfig } = require('./scenarios.cjs')
const { installVariant, buildVariantEnvironment, getVariant } = require('./variants.cjs')
const { buildReport } = require('./report.cjs')

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..')
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const slug = value => value.replace(/[^a-z0-9_.-]+/gi, '-')

const atomicWrite = async(filePath, contents) => {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' })
  await fs.rename(temporaryPath, filePath)
}

const reservePort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.unref()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    server.close(error => error ? reject(error) : resolve(address.port))
  })
})

const waitForExit = (child, timeoutMs) => new Promise(resolve => {
  if (child.exitCode != null) return resolve(true)
  const timer = setTimeout(() => resolve(false), timeoutMs)
  child.once('exit', () => {
    clearTimeout(timer)
    resolve(true)
  })
})

const killTree = pid => new Promise((resolve, reject) => treeKill(pid, 'SIGKILL', error => error ? reject(error) : resolve()))

const connectWithRetry = async(port, attempts = 120) => {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await connectRenderer(port)
    } catch (error) {
      lastError = error
      await delay(250)
    }
  }
  throw new Error(`Unable to connect to isolated Electron renderer: ${lastError?.message ?? 'unknown error'}`)
}

const launchElectron = async context => {
  const cdpPort = await reservePort()
  const variantEnvironment = buildVariantEnvironment(context.variant, {})
  const environment = {
    ...process.env,
    ...variantEnvironment,
    LX_TEST_USER_DATA_PATH: context.profilePath,
    LX_NATIVE_PROFILE_PATH: context.workspaceManifest.nativeProfilePath,
    LX_NATIVE_CACHE_PATH: context.workspaceManifest.nativeCachePath,
    LX_NATIVE_RELEASE: 'true',
  }
  const args = [REPOSITORY_ROOT, `--remote-debugging-port=${cdpPort}`]
  const startedAt = new Date().toISOString()
  const child = spawn(ELECTRON_PATH, args, { cwd: REPOSITORY_ROOT, env: environment, windowsHide: true, stdio: 'ignore' })
  if (!child.pid) throw new Error('Electron launch did not return a PID')
  let client
  try {
    client = await connectWithRetry(cdpPort)
    await installProbe(client)
  } catch (error) {
    if (child.exitCode == null) await killTree(child.pid).catch(() => {})
    throw error
  }
  let closed = false
  const metadata = {
    rootPid: child.pid,
    command: ELECTRON_PATH,
    args,
    environmentKeys: ['LX_TEST_USER_DATA_PATH', 'LX_NATIVE_PROFILE_PATH', 'LX_NATIVE_CACHE_PATH', 'LX_NATIVE_RELEASE', ...Object.keys(variantEnvironment)],
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPOSITORY_ROOT, encoding: 'utf8' }).trim(),
    electronVersion: require('electron/package.json').version,
    nodeVersion: process.version,
    startedAt,
  }
  return {
    rootPid: child.pid,
    cdpPort,
    client,
    metadata,
    async close() {
      if (closed) return
      closed = true
      client.close()
      child.kill()
      if (!await waitForExit(child, 5_000)) await killTree(child.pid)
      metadata.endedAt = new Date().toISOString()
      metadata.exitStatus = child.exitCode == null ? 'forced' : child.exitCode
    },
  }
}

const prepareProfile = async({ templatePath, profilePath }) => {
  await fs.cp(templatePath, profilePath, { recursive: true, errorOnExist: true, force: false })
}

const createEvaluator = client => async expression => {
  const response = await client.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Renderer evaluation failed')
  return response.result?.value
}

const copiedMediaFromManifest = manifest => {
  const audioExtensions = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.ape', '.wma'])
  const playback = manifest.copiedMedia?.find(item => audioExtensions.has(path.extname(item.destinationPath).toLowerCase()))
  if (!playback) throw new Error('Workspace manifest has no copied audio track for playback scenarios')
  const rootIndices = [...new Set(manifest.copiedMediaMappings.map(item => item.rootIndex))]
  return {
    workspaceRoot: manifest.outputRoot,
    roots: rootIndices.map(rootIndex => ({ destinationRoot: path.join(manifest.mediaPath, `root-${rootIndex}`) })),
    playbackTrack: playback.destinationPath,
  }
}

const executeScenario = async context => {
  const installedVariant = await installVariant(context.launch.client, context.variant)
  const drivers = createScenarioDrivers({
    config: context.config,
    copiedMedia: copiedMediaFromManifest(context.workspaceManifest),
    evaluate: createEvaluator(context.launch.client),
  })
  const contract = drivers[context.scenario]()
  try {
    const readiness = await contract.readiness()
    const actions = await contract.actions.run()
    return { readiness, actions, checkpoints: contract.checkpoints, cleanup: async() => {
      await contract.actions.cleanup()
      await installedVariant.cleanup()
    } }
  } catch (error) {
    await contract.actions.cleanup().catch(() => {})
    await installedVariant.cleanup().catch(() => {})
    throw error
  }
}

const createDefaultDependencies = () => ({
  prepareProfile,
  launch: launchElectron,
  async prime(context) {
    const launch = await launchElectron(context)
    let execution
    try {
      execution = await executeScenario({ ...context, launch })
    } finally {
      await execution?.cleanup?.().catch(() => {})
      await launch.close()
    }
  },
  executeScenario,
  sleep: delay,
  sample: context => captureSample({
    rootPid: context.launch.rootPid,
    cdpPort: context.launch.cdpPort,
    sampleMs: context.sampleMs ?? 1_000,
    scenario: context.scenario,
    phase: context.phase,
    temperature: context.temperature,
    variant: context.variant,
    runIndex: context.runIndex,
    elapsedMs: context.elapsedMs,
    workspaceManifest: context.workspaceManifest,
    client: context.launch.client,
  }),
})

const validateRunOptions = options => {
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new TypeError('runs must be a positive integer')
  if (options.runs < 5 && options.verificationOnly !== true) throw new Error('formal Stage 2 runs require at least five runs per temperature')
  if (!Array.isArray(options.scenarios) || options.scenarios.length == 0) throw new Error('at least one scenario is required')
  if (!Array.isArray(options.variants) || options.variants.length == 0) throw new Error('at least one variant is required')
  for (const variantName of options.variants) {
    const variant = getVariant(variantName)
    if (!variant.measurable) throw new Error(`Stage 2 memory variant is not measurable: ${variantName}`)
  }
}

const runMatrix = async(options, injectedDependencies = {}) => {
  validateRunOptions(options)
  const dependencies = { ...createDefaultDependencies(), ...injectedDependencies }
  const outputDirectory = path.resolve(options.outputDirectory)
  await fs.mkdir(outputDirectory, { recursive: true })
  const paths = {
    rawSamples: path.join(outputDirectory, 'raw-samples.jsonl'),
    runLog: path.join(outputDirectory, 'run-log.jsonl'),
    summary: path.join(outputDirectory, 'summary.json'),
    report: path.join(outputDirectory, 'stage-2a-memory-report.md'),
  }
  await fs.writeFile(paths.rawSamples, '', { flag: 'wx' })
  await fs.writeFile(paths.runLog, '', { flag: 'wx' })
  const appendLog = event => fs.appendFile(paths.runLog, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`)
  const samples = []
  const activeLaunches = new Set()
  let interrupted = false
  const closeActive = async() => Promise.allSettled([...activeLaunches].map(launch => launch.close()))
  const onSignal = () => { interrupted = true; void closeActive() }
  process.once('SIGINT', onSignal)

  const measure = async context => {
    if (interrupted) throw new Error('Stage 2 run interrupted')
    const launch = await dependencies.launch(context)
    activeLaunches.add(launch)
    await appendLog({ kind: 'launch', scenario: context.scenario, temperature: context.temperature, variant: context.variant, runIndex: context.runIndex, ...launch.metadata })
    const started = Date.now()
    let execution
    try {
      execution = await dependencies.executeScenario({ ...context, launch })
      const phases = [{ name: 'stable', waitMs: 0 }]
      let previousCheckpoint = 0
      for (const checkpoint of execution?.checkpoints ?? []) {
        phases.push({ name: `recovery-${checkpoint}`, waitMs: checkpoint - previousCheckpoint })
        previousCheckpoint = checkpoint
      }
      for (const phase of phases) {
        if (phase.waitMs) await dependencies.sleep(phase.waitMs)
        const sample = assertSample(await dependencies.sample({
          ...context,
          launch,
          phase: phase.name,
          elapsedMs: Date.now() - started,
        }))
        await fs.appendFile(paths.rawSamples, `${JSON.stringify(sample)}\n`)
        samples.push(sample)
      }
    } catch (error) {
      await appendLog({ kind: 'failure', scenario: context.scenario, temperature: context.temperature, variant: context.variant, runIndex: context.runIndex, error: error.message })
      throw error
    } finally {
      await execution?.cleanup?.().catch(async error => appendLog({ kind: 'cleanup-failure', error: error.message }))
      await launch.close()
      activeLaunches.delete(launch)
      await appendLog({ kind: 'exit', rootPid: launch.rootPid, scenario: context.scenario, temperature: context.temperature, variant: context.variant, runIndex: context.runIndex, endedAt: launch.metadata?.endedAt, exitStatus: launch.metadata?.exitStatus })
    }
  }

  try {
    const profilesRoot = path.join(outputDirectory, 'profiles')
    await fs.mkdir(profilesRoot)
    for (const variant of options.variants) {
      for (const scenario of options.scenarios) {
        const groupRoot = path.join(profilesRoot, `${slug(variant)}--${slug(scenario)}`)
        await fs.mkdir(groupRoot)
        for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
          const profilePath = path.join(groupRoot, `cold-${runIndex}`)
          await dependencies.prepareProfile({ templatePath: options.workspaceManifest.profilePath, profilePath, temperature: 'cold', variant, scenario, runIndex })
          await measure({ ...options, profilePath, temperature: 'cold', variant, scenario, runIndex })
        }
        const warmProfilePath = path.join(groupRoot, 'warm')
        await dependencies.prepareProfile({ templatePath: options.workspaceManifest.profilePath, profilePath: warmProfilePath, temperature: 'warm', variant, scenario, runIndex: 0 })
        await dependencies.prime({ ...options, profilePath: warmProfilePath, temperature: 'warm', variant, scenario, runIndex: 0 })
        await appendLog({ kind: 'prime', scenario, variant, temperature: 'warm' })
        for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
          await measure({ ...options, profilePath: warmProfilePath, temperature: 'warm', variant, scenario, runIndex })
        }
      }
    }
    const report = buildReport(samples, {
      recoveryCheckpointsMs: options.config.recoveryCheckpointsMs,
      conditions: { runsPerTemperature: options.runs, scenarios: options.scenarios, variants: options.variants, verificationOnly: options.verificationOnly === true },
      paths,
      verificationOnly: options.verificationOnly === true,
    })
    await atomicWrite(paths.summary, `${JSON.stringify(report.summary, null, 2)}\n`)
    await atomicWrite(paths.report, report.markdown)
    return { ...report, samples, paths }
  } finally {
    process.removeListener('SIGINT', onSignal)
    await closeActive()
  }
}

const parseArguments = argv => Object.fromEntries(argv.map(argument => {
  const match = argument.match(/^--([^=]+)=(.*)$/)
  if (!match) throw new Error(`Expected --name=value argument, received: ${argument}`)
  return [match[1], match[2]]
}))

const main = async() => {
  const args = parseArguments(process.argv.slice(2))
  for (const required of ['workspace', 'config', 'output']) if (!args[required]) throw new Error(`--${required} is required`)
  const workspaceManifest = JSON.parse(await fs.readFile(path.resolve(args.workspace), 'utf8'))
  const config = JSON.parse(await fs.readFile(path.resolve(args.config), 'utf8'))
  const outputDirectory = path.resolve(args.output)
  await fs.mkdir(outputDirectory, { recursive: true })
  copyResolvedScenarioConfig(config, outputDirectory)
  const scenarios = args.scenarios ? args.scenarios.split(',').filter(Boolean) : Object.keys(createScenarioDrivers({ config, copiedMedia: copiedMediaFromManifest(workspaceManifest), evaluate: async() => {} }))
  const variants = args.variants ? args.variants.split(',').filter(Boolean) : ['control']
  const result = await runMatrix({
    outputDirectory,
    workspaceManifest,
    config,
    scenarios,
    variants,
    runs: Number(args.runs ?? 5),
    verificationOnly: args['verification-only'] === 'true',
  })
  process.stdout.write(`${result.paths.report}\n`)
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})

module.exports = { createDefaultDependencies, launchElectron, parseArguments, runMatrix }
