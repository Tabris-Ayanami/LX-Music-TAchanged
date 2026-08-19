'use strict'

const fs = require('node:fs/promises')
const crypto = require('node:crypto')
const net = require('node:net')
const path = require('node:path')
const { spawn, execFile, execFileSync } = require('node:child_process')
const { promisify } = require('node:util')
const treeKill = require('tree-kill')
const ELECTRON_PATH = require('electron')
const { assertSample } = require('./schema.cjs')
const { connectRenderer } = require('./cdp-client.cjs')
const { installProbe } = require('./renderer-probe.cjs')
const { captureSample } = require('./sample.cjs')
const { createScenarioDrivers, copyResolvedScenarioConfig, resolveScenarioConfig } = require('./scenarios.cjs')
const { installVariant, buildVariantEnvironment, getVariant } = require('./variants.cjs')
const { buildReport } = require('./report.cjs')

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..')
const execFileAsync = promisify(execFile)
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const slug = value => value.replace(/[^a-z0-9_.-]+/gi, '-')

const normalizeForComparison = value => {
  const resolved = path.resolve(value)
  return process.platform == 'win32' ? resolved.toLowerCase() : resolved
}

const isWithin = (parentPath, candidatePath) => {
  const relative = path.relative(normalizeForComparison(parentPath), normalizeForComparison(candidatePath))
  return relative == '' || (!path.isAbsolute(relative) && relative != '..' && !relative.startsWith(`..${path.sep}`))
}

const canonicalizeWithoutLinks = async(targetPath, label) => {
  const absolutePath = path.resolve(targetPath)
  let existing = absolutePath
  const missing = []
  while (true) {
    try {
      await fs.lstat(existing)
      break
    } catch (error) {
      if (error.code != 'ENOENT') throw error
      const parent = path.dirname(existing)
      if (parent == existing) throw error
      missing.unshift(path.basename(existing))
      existing = parent
    }
  }
  const root = path.parse(existing).root
  let current = root
  for (const segment of path.relative(root, existing).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`${label} contains a linked or reparse-point ancestor: ${current}`)
  }
  return path.join(await fs.realpath(existing), ...missing)
}

const hashFile = async filePath => {
  const hash = crypto.createHash('sha256')
  hash.update(await fs.readFile(filePath))
  return hash.digest('hex')
}

const validateWorkspaceManifestForRun = async(manifest, reportDirectory, manifestFilePath = manifest?.manifestPath) => {
  if (!manifest || manifest.version !== 1) throw new Error('Stage 2 runner requires workspace manifest version 1')
  if (manifest.sourceProfileWasInactive !== true || manifest.profileActivityEvidence?.completed !== true) {
    throw new Error('Workspace manifest lacks completed source-profile inactivity evidence')
  }
  if (typeof manifestFilePath != 'string' || !path.isAbsolute(manifestFilePath)) throw new Error('Workspace manifest file path must be absolute')
  const required = ['outputRoot', 'profileSource', 'profilePath', 'mediaPath', 'nativeProfilePath', 'nativeCachePath']
  for (const key of required) if (typeof manifest[key] != 'string' || !path.isAbsolute(manifest[key])) throw new Error(`Workspace manifest ${key} must be absolute`)
  const outputRoot = await canonicalizeWithoutLinks(manifest.outputRoot, 'workspace output root')
  const canonical = { outputRoot, profileSource: await canonicalizeWithoutLinks(manifest.profileSource, 'source profile') }
  if (isWithin(canonical.profileSource, outputRoot) || isWithin(outputRoot, canonical.profileSource)) {
    throw new Error('Prepared workspace must not overlap the source profile')
  }
  const expectedPaths = {
    profilePath: path.join(outputRoot, 'profile-template'),
    mediaPath: path.join(outputRoot, 'media'),
    nativeProfilePath: path.join(outputRoot, 'native-profile'),
    nativeCachePath: path.join(outputRoot, 'native-cache'),
  }
  for (const key of ['profilePath', 'mediaPath', 'nativeProfilePath', 'nativeCachePath']) {
    canonical[key] = await canonicalizeWithoutLinks(manifest[key], `workspace ${key}`)
    if (!isWithin(outputRoot, canonical[key]) || normalizeForComparison(outputRoot) == normalizeForComparison(canonical[key])) {
      throw new Error(`Workspace manifest ${key} must be inside the prepared workspace`)
    }
    if (normalizeForComparison(canonical[key]) != normalizeForComparison(expectedPaths[key])) throw new Error(`Workspace manifest ${key} does not match the prepared workspace layout`)
  }
  const expectedManifestPath = path.join(outputRoot, 'workspace-manifest.json')
  const canonicalManifestPath = await canonicalizeWithoutLinks(manifestFilePath, 'workspace manifest')
  if (normalizeForComparison(canonicalManifestPath) != normalizeForComparison(expectedManifestPath) || normalizeForComparison(manifest.manifestPath) != normalizeForComparison(expectedManifestPath)) {
    throw new Error('Workspace manifest path does not match the prepared workspace')
  }
  const storedManifest = JSON.parse(await fs.readFile(canonicalManifestPath, 'utf8'))
  for (const key of ['version', 'outputRoot', 'profileSource', 'profilePath', 'mediaPath', 'nativeProfilePath', 'nativeCachePath', 'manifestPath']) {
    if (String(storedManifest[key]) != String(manifest[key])) throw new Error(`In-memory workspace manifest differs from its file at ${key}`)
  }
  const expectedDatabasePath = path.join(canonical.profilePath, 'LxDatas', 'lx.data.db')
  if (normalizeForComparison(manifest.database?.path) != normalizeForComparison(expectedDatabasePath) || !/^[a-f0-9]{64}$/i.test(manifest.database?.sha256 ?? '')) {
    throw new Error('Workspace manifest copied database evidence is incomplete')
  }
  if (await hashFile(expectedDatabasePath) != manifest.database.sha256) throw new Error('Workspace copied database hash does not match its manifest')
  for (const [index, mapping] of (manifest.copiedMediaMappings ?? []).entries()) {
    const destination = await canonicalizeWithoutLinks(mapping.destinationPath, `copied media ${index}`)
    if (!isWithin(canonical.mediaPath, destination)) throw new Error(`Copied media ${index} escapes the prepared workspace`)
  }
  const reportPath = await canonicalizeWithoutLinks(reportDirectory, 'report output')
  if (isWithin(canonical.profileSource, reportPath)) throw new Error('Report output must not overlap the source profile')
  for (const key of ['profilePath', 'mediaPath', 'nativeProfilePath', 'nativeCachePath']) {
    if (isWithin(canonical[key], reportPath)) throw new Error(`Report output must not be inside workspace ${key}`)
  }
  return { ...canonical, manifestPath: canonicalManifestPath }
}

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

const listOwnedProcessIds = async rootPid => {
  if (process.platform != 'win32') return [rootPid]
  const command = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true })
  const parsed = JSON.parse(stdout.trim() || '[]')
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  const owned = new Set([rootPid])
  let previousSize
  do {
    previousSize = owned.size
    for (const row of rows) if (owned.has(Number(row.ParentProcessId))) owned.add(Number(row.ProcessId))
  } while (owned.size > previousSize)
  return [...owned]
}

const isPidRunning = pid => {
  try { process.kill(pid, 0); return true } catch { return false }
}

const terminateRecordedPids = async pids => {
  for (const pid of [...pids].reverse()) {
    if (!isPidRunning(pid)) continue
    try { process.kill(pid, 'SIGKILL') } catch (error) { if (error.code != 'ESRCH') throw error }
  }
  for (let attempt = 0; attempt < 50 && pids.some(isPidRunning); attempt += 1) await delay(100)
  const survivors = pids.filter(isPidRunning)
  if (survivors.length) throw new Error(`Runner-owned processes did not exit: ${survivors.join(', ')}`)
}

const killRootTree = pid => new Promise((resolve, reject) => treeKill(pid, 'SIGKILL', error => error ? reject(error) : resolve()))

const shutdownOwnedProcessTree = async({ rootPid, client, rendererClient = client, child, listProcessIds = listOwnedProcessIds, terminate = terminateRecordedPids }) => {
  let ownedPids
  try {
    ownedPids = await listProcessIds(rootPid)
  } catch (error) {
    await killRootTree(rootPid).catch(() => {})
    client.close()
    if (rendererClient !== client) rendererClient.close()
    throw new Error('Could not snapshot the runner-owned process tree before shutdown', { cause: error })
  }
  try {
    await client.call('Runtime.evaluate', { expression: 'window.close()', returnByValue: true }).catch(() => child.kill())
    await waitForExit(child, 5_000)
    await terminate(ownedPids)
    return ownedPids
  } finally {
    client.close()
    if (rendererClient !== client) rendererClient.close()
  }
}

const connectWithRetry = async(port, connector, attempts = 120) => {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await connector(port)
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
    client = await connectWithRetry(cdpPort, connectRenderer)
  } catch (error) {
    client?.close()
    if (child.exitCode == null) await killRootTree(child.pid).catch(() => {})
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
      await shutdownOwnedProcessTree({ rootPid: child.pid, client, child })
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

const applyRunConfiguration = async(rendererClient, config) => {
  const requested = config.window
  if (!requested || !Number.isInteger(requested.width) || !Number.isInteger(requested.height)) throw new Error('Resolved scenario config has invalid window dimensions')
  const observed = await rendererClient.call('Runtime.evaluate', {
    expression: `(async() => {
      window.resizeTo(${requested.width}, ${requested.height})
      await new Promise(resolve => setTimeout(resolve, 100))
      return {
        width: window.outerWidth,
        height: window.outerHeight,
        effectiveTheme: {
          documentTheme: document.documentElement.dataset.theme || document.documentElement.className,
          prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
        },
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  const bounds = observed.result?.value
  if (bounds?.width != requested.width || bounds?.height != requested.height) {
    throw new Error(`Electron window bounds differ from requested ${requested.width}x${requested.height}`)
  }
  return { window: { width: bounds.width, height: bounds.height }, requestedTheme: config.theme, effectiveTheme: bounds.effectiveTheme ?? null }
}

const prepareLaunch = async context => {
  const installedVariant = await installVariant(context.launch.client, context.variant)
  try {
    await installProbe(context.launch.client)
    const conditions = await applyRunConfiguration(context.launch.client, context.config)
    return { attribution: installedVariant.attribution, conditions, cleanup: installedVariant.cleanup }
  } catch (error) {
    await installedVariant.cleanup().catch(() => {})
    throw error
  }
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
  const drivers = createScenarioDrivers({
    config: context.config,
    copiedMedia: copiedMediaFromManifest(context.workspaceManifest),
    evaluate: createEvaluator(context.launch.client),
  })
  const contract = drivers[context.scenario]()
  try {
    const readiness = await contract.readiness()
    const actions = await contract.actions.run()
    return { readiness, actions, checkpoints: contract.checkpoints, recovery: contract.recovery, cleanup: contract.actions.cleanup }
  } catch (error) {
    await contract.actions.cleanup().catch(() => {})
    throw error
  }
}

const createDefaultDependencies = () => ({
  prepareProfile,
  launch: launchElectron,
  prepareLaunch,
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
    attribution: context.attribution,
  }),
})

const validateRunOptions = options => {
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new TypeError('runs must be a positive integer')
  if (options.runs < 5 && options.verificationOnly !== true) throw new Error('formal Stage 2 runs require at least five runs per temperature')
  if (!Array.isArray(options.scenarios) || options.scenarios.length == 0) throw new Error('at least one scenario is required')
  if (!Array.isArray(options.variants) || options.variants.length == 0) throw new Error('at least one variant is required')
  for (const variantName of options.variants) getVariant(variantName)
}

const runMatrix = async(options, injectedDependencies = {}) => {
  validateRunOptions(options)
  const resolvedOptions = { ...options, config: resolveScenarioConfig(options.config) }
  const dependencies = { ...createDefaultDependencies(), ...injectedDependencies }
  const outputDirectory = path.resolve(options.outputDirectory)
  const canonicalWorkspace = await validateWorkspaceManifestForRun(options.workspaceManifest, outputDirectory, options.workspaceManifestPath)
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

  const measure = async(context, measured = true) => {
    if (interrupted) throw new Error('Stage 2 run interrupted')
    const launch = await dependencies.launch(context)
    activeLaunches.add(launch)
    await appendLog({ kind: measured ? 'launch' : 'prime-launch', scenario: context.scenario, temperature: context.temperature, variant: context.variant, runIndex: context.runIndex, ...launch.metadata })
    const started = Date.now()
    const pendingSamples = []
    let lifecycle
    let execution
    let failure
    try {
      lifecycle = await dependencies.prepareLaunch({ ...context, launch })
      await appendLog({ kind: 'run-conditions', scenario: context.scenario, temperature: context.temperature, variant: context.variant, runIndex: context.runIndex, conditions: lifecycle.conditions })
      execution = await dependencies.executeScenario({ ...context, launch })
      if (measured) {
        let phases
        if (execution?.recovery) {
          const origin = execution.actions?.recoveryStartedAtMs
          if (!Number.isFinite(origin)) throw new Error('Recovery scenario did not return recoveryStartedAtMs')
          phases = execution.recovery.checkpointsMs.map(checkpoint => ({
            name: checkpoint == execution.recovery.stableCheckpointMs ? 'stable' : `recovery-${checkpoint}`,
            deadline: origin + checkpoint,
          }))
        } else {
          phases = [{ name: 'stable', deadline: Date.now() }]
        }
        for (const phase of phases) {
          const remaining = phase.deadline - Date.now()
          if (remaining > 0) await dependencies.sleep(remaining)
          pendingSamples.push(assertSample(await dependencies.sample({
            ...context,
            launch,
            attribution: lifecycle.attribution,
            conditions: lifecycle.conditions,
            phase: phase.name,
            elapsedMs: Date.now() - started,
          })))
        }
      }
    } catch (error) {
      failure = error
    } finally {
      for (const cleanup of [execution?.cleanup, lifecycle?.cleanup]) {
        if (!cleanup) continue
        try { await cleanup() } catch (error) {
          await appendLog({ kind: 'cleanup-failure', error: error.message })
          failure ??= error
        }
      }
      try { await launch.close() } catch (error) { failure ??= error }
      activeLaunches.delete(launch)
      await appendLog({ kind: 'exit', rootPid: launch.rootPid, scenario: context.scenario, temperature: context.temperature, variant: context.variant, runIndex: context.runIndex, endedAt: launch.metadata?.endedAt, exitStatus: launch.metadata?.exitStatus })
    }
    if (failure) {
      await appendLog({ kind: 'failure', scenario: context.scenario, temperature: context.temperature, variant: context.variant, runIndex: context.runIndex, error: failure.message })
      throw failure
    }
    for (const sample of pendingSamples) {
      await fs.appendFile(paths.rawSamples, `${JSON.stringify(sample)}\n`)
      samples.push(sample)
    }
  }

  try {
    const profilesRoot = path.join(canonicalWorkspace.outputRoot, 'run-profiles', crypto.randomUUID())
    await fs.mkdir(profilesRoot, { recursive: true })
    const selectedVariants = options.variants.map(getVariant)
    const unavailableVariants = selectedVariants.filter(variant => !variant.measurable).map(({ name, reason }) => ({ name, reason }))
    for (const variantDefinition of selectedVariants.filter(variant => variant.measurable)) {
      const variant = variantDefinition.name
      for (const scenario of options.scenarios) {
        const groupRoot = path.join(profilesRoot, `${slug(variant)}--${slug(scenario)}`)
        await fs.mkdir(groupRoot)
        for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
          const profilePath = path.join(groupRoot, `cold-${runIndex}`)
          await dependencies.prepareProfile({ templatePath: options.workspaceManifest.profilePath, profilePath, temperature: 'cold', variant, scenario, runIndex })
          await measure({ ...resolvedOptions, profilePath, temperature: 'cold', variant, scenario, runIndex })
        }
        const warmProfilePath = path.join(groupRoot, 'warm')
        await dependencies.prepareProfile({ templatePath: options.workspaceManifest.profilePath, profilePath: warmProfilePath, temperature: 'warm', variant, scenario, runIndex: 0 })
        await measure({ ...resolvedOptions, profilePath: warmProfilePath, temperature: 'warm', variant, scenario, runIndex: 0 }, false)
        await appendLog({ kind: 'prime', scenario, variant, temperature: 'warm' })
        for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
          await measure({ ...resolvedOptions, profilePath: warmProfilePath, temperature: 'warm', variant, scenario, runIndex })
        }
      }
    }
    const report = buildReport(samples, {
      recoveryCheckpointsMs: resolvedOptions.config.recoveryCheckpointsMs,
      conditions: { config: resolvedOptions.config, runsPerTemperature: options.runs, scenarios: options.scenarios, variants: options.variants, verificationOnly: options.verificationOnly === true },
      paths,
      verificationOnly: options.verificationOnly === true,
      unavailableVariants,
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
  await validateWorkspaceManifestForRun(workspaceManifest, outputDirectory, path.resolve(args.workspace))
  await fs.mkdir(outputDirectory, { recursive: true })
  copyResolvedScenarioConfig(config, outputDirectory)
  const scenarioFilter = args.scenarios ?? args.scenario
  const variantFilter = args.variants ?? args.variant
  const scenarios = scenarioFilter ? scenarioFilter.split(',').filter(Boolean) : Object.keys(createScenarioDrivers({ config, copiedMedia: copiedMediaFromManifest(workspaceManifest), evaluate: async() => {} }))
  const variants = variantFilter ? variantFilter.split(',').filter(Boolean) : ['control']
  const result = await runMatrix({
    outputDirectory,
    workspaceManifest,
    workspaceManifestPath: path.resolve(args.workspace),
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

module.exports = { createDefaultDependencies, launchElectron, parseArguments, prepareLaunch, runMatrix, shutdownOwnedProcessTree, validateWorkspaceManifestForRun }
