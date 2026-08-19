'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..')
const SQLITE_WORKER_PATH = path.join(__dirname, 'sqlite-worker.cjs')
const ELECTRON_PATH = require('electron')
const BROWSER_CACHE_DIRECTORIES = new Set([
  'cache',
  'code cache',
  'dawncache',
  'gpucache',
  'grshadercache',
  'shadercache',
])
const LOCK_FILES = ['lockfile', 'DevToolsActivePort']

const normalizeForComparison = value => {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

const isWithin = (parentPath, candidatePath) => {
  const relative = path.relative(normalizeForComparison(parentPath), normalizeForComparison(candidatePath))
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

const isSamePath = (left, right) => normalizeForComparison(left) === normalizeForComparison(right)

const getPathAncestors = targetPath => {
  const absolutePath = path.resolve(targetPath)
  const root = path.parse(absolutePath).root
  const relative = path.relative(root, absolutePath)
  const ancestors = [root]
  let current = root
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    ancestors.push(current)
  }
  return ancestors
}

const assertNoLinkedAncestors = async (targetPath, label) => {
  for (const ancestor of getPathAncestors(targetPath)) {
    let stats
    try {
      stats = await fs.lstat(ancestor)
    } catch (error) {
      if (error.code === 'ENOENT') break
      throw error
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} ancestor is a symbolic link, junction, or reparse point: ${ancestor}`)
    }
  }
}

const canonicalizePath = async (targetPath, label) => {
  const absolutePath = path.resolve(targetPath)
  let existingAncestor = absolutePath
  while (true) {
    try {
      await fs.lstat(existingAncestor)
      break
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const parent = path.dirname(existingAncestor)
      if (parent === existingAncestor) throw error
      existingAncestor = parent
    }
  }
  await assertNoLinkedAncestors(existingAncestor, label)
  const physicalAncestor = await fs.realpath(existingAncestor)
  return path.resolve(physicalAncestor, path.relative(existingAncestor, absolutePath))
}

const requireDirectoryWithoutLinks = async (rootPath, label) => {
  const visit = async currentPath => {
    const stats = await fs.lstat(currentPath)
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic link, junction, or reparse point: ${currentPath}`)
    }
    if (stats.isDirectory()) {
      const entries = await fs.readdir(currentPath)
      for (const entry of entries) await visit(path.join(currentPath, entry))
      return
    }
    if (!stats.isFile()) throw new Error(`${label} contains an unsupported filesystem entry: ${currentPath}`)
  }

  const rootStats = await fs.lstat(rootPath)
  if (rootStats.isSymbolicLink()) {
    throw new Error(`${label} is a symbolic link, junction, or reparse point: ${rootPath}`)
  }
  if (!rootStats.isDirectory()) throw new Error(`${label} must be a directory: ${rootPath}`)
  const entries = await fs.readdir(rootPath)
  for (const entry of entries) await visit(path.join(rootPath, entry))
}

const copyProfileDirectory = async (sourcePath, destinationPath, copyBrowserCaches, isRoot = true) => {
  await fs.mkdir(destinationPath)
  const entries = await fs.readdir(sourcePath)
  for (const entry of entries) {
    if (isRoot && !copyBrowserCaches && BROWSER_CACHE_DIRECTORIES.has(entry.toLowerCase())) continue
    const sourceEntry = path.join(sourcePath, entry)
    const destinationEntry = path.join(destinationPath, entry)
    const stats = await fs.lstat(sourceEntry)
    if (stats.isSymbolicLink()) {
      throw new Error(`profile source contains a symbolic link, junction, or reparse point: ${sourceEntry}`)
    }
    if (stats.isDirectory()) {
      await copyProfileDirectory(sourceEntry, destinationEntry, copyBrowserCaches, false)
    } else if (stats.isFile()) {
      await fs.copyFile(sourceEntry, destinationEntry, fs.constants.COPYFILE_EXCL)
    } else {
      throw new Error(`profile source contains an unsupported filesystem entry: ${sourceEntry}`)
    }
  }
}

const hashFile = async filePath => {
  const hash = crypto.createHash('sha256')
  const handle = await fs.open(filePath, 'r')
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk)
  } finally {
    await handle.close()
  }
  return hash.digest('hex')
}

const getGitCommit = () => execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: REPOSITORY_ROOT,
  encoding: 'utf8',
  windowsHide: true,
}).trim()

const getElectronVersion = () => require(path.join(REPOSITORY_ROOT, 'node_modules', 'electron', 'package.json')).version

const resolveOptions = options => {
  if (!options || typeof options !== 'object') throw new TypeError('workspace options are required')
  if (typeof options.profileSource !== 'string' || options.profileSource.length === 0) {
    throw new TypeError('profileSource is required')
  }
  if (typeof options.outputRoot !== 'string' || options.outputRoot.length === 0) {
    throw new TypeError('outputRoot is required')
  }
  if (!Array.isArray(options.mediaRoots) || options.mediaRoots.length === 0 || options.mediaRoots.some(root => typeof root !== 'string' || root.length === 0)) {
    throw new TypeError('at least one media root is required')
  }
  if (!Object.prototype.hasOwnProperty.call(options, 'activeProfilePaths') || !Array.isArray(options.activeProfilePaths)) {
    throw new Error('completed profile activity evidence is required in activeProfilePaths')
  }
  if (options.activeProfilePaths.some(activePath => typeof activePath !== 'string' || activePath.length === 0)) {
    throw new TypeError('activeProfilePaths must contain paths')
  }
  if (options.verificationMediaSubset != null && typeof options.verificationMediaSubset !== 'boolean') {
    throw new TypeError('verificationMediaSubset must be boolean')
  }

  return {
    profileSource: path.resolve(options.profileSource),
    outputRoot: path.resolve(options.outputRoot),
    mediaRoots: options.mediaRoots.map(root => path.resolve(root)),
    activeProfilePaths: options.activeProfilePaths.map(activePath => path.resolve(activePath)),
    activityEvidenceMethod: options.activityEvidenceMethod ?? 'injected-active-profile-paths',
    copyBrowserCaches: options.copyBrowserCaches === true,
    verificationMediaSubset: options.verificationMediaSubset === true,
  }
}

const validatePathBoundaries = ({ profileSource, outputRoot, mediaRoots, activeProfilePaths }) => {
  const sources = [profileSource, ...mediaRoots]
  for (const sourcePath of sources) {
    if (isWithin(sourcePath, outputRoot) || isWithin(outputRoot, sourcePath)) {
      throw new Error(`destination must not contain or be contained by a source: ${outputRoot}`)
    }
  }
  if (activeProfilePaths.some(activePath => isSamePath(activePath, profileSource))) {
    throw new Error(`profile is in use and cannot be copied: ${profileSource}`)
  }
  for (let index = 0; index < mediaRoots.length; index += 1) {
    if (mediaRoots.findIndex(root => isSamePath(root, mediaRoots[index])) !== index) {
      throw new Error(`media roots must be unique: ${mediaRoots[index]}`)
    }
  }
}

const canonicalizeSafetyPaths = async resolved => ({
  profileSource: await canonicalizePath(resolved.profileSource, 'profile source'),
  outputRoot: await canonicalizePath(resolved.outputRoot, 'destination'),
  mediaRoots: await Promise.all(resolved.mediaRoots.map(mediaRoot => canonicalizePath(mediaRoot, 'media root'))),
  activeProfilePaths: await Promise.all(resolved.activeProfilePaths.map(activePath => canonicalizePath(activePath, 'active profile'))),
})

const findMediaRoot = (filePath, mediaRoots) => {
  if (typeof filePath !== 'string' || filePath.length === 0 || !path.isAbsolute(filePath)) return null
  const resolvedPath = path.resolve(filePath)
  const rootIndex = mediaRoots.findIndex(root => isWithin(root, resolvedPath))
  if (rootIndex === -1) return null
  const relativePath = path.relative(mediaRoots[rootIndex], resolvedPath)
  if (!relativePath || path.isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) return null
  return { resolvedPath, rootIndex, relativePath }
}

const shouldRewriteOptionalPath = (key, parentKey) => {
  if (/^(?:picUrl|lyricPath|lrcPath|lrcUrl)$/i.test(key)) return true
  return key === 'path' && /^(?:lyric|lyrics|lyricInfo|lrc)$/i.test(parentKey ?? '')
}

const atomicWriteJson = async (filePath, value) => {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await fs.rename(temporaryPath, filePath)
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {})
    throw error
  }
}

const runSqliteWorker = async (outputRoot, request) => {
  const token = `${process.pid}.${crypto.randomBytes(8).toString('hex')}`
  const requestPath = path.join(outputRoot, `.sqlite-request.${token}.json`)
  const responsePath = path.join(outputRoot, `.sqlite-response.${token}.json`)
  try {
    await fs.writeFile(requestPath, JSON.stringify(request), { encoding: 'utf8', flag: 'wx' })
    await new Promise((resolve, reject) => {
      const child = spawn(ELECTRON_PATH, [SQLITE_WORKER_PATH, requestPath, responsePath], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      })
      let stderr = ''
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', chunk => { stderr += chunk })
      child.once('error', reject)
      child.once('exit', code => {
        if (code === 0) resolve()
        else reject(new Error(`copied database worker failed (${code}): ${stderr.trim()}`))
      })
    })
    return JSON.parse(await fs.readFile(responsePath, 'utf8'))
  } finally {
    await Promise.all([
      fs.rm(requestPath, { force: true }),
      fs.rm(responsePath, { force: true }),
    ])
  }
}

const prepareWorkspace = async options => {
  const resolved = resolveOptions(options)
  const physicalPaths = await canonicalizeSafetyPaths(resolved)
  validatePathBoundaries(physicalPaths)
  await requireDirectoryWithoutLinks(resolved.profileSource, 'profile source')
  for (const mediaRoot of resolved.mediaRoots) await requireDirectoryWithoutLinks(mediaRoot, 'media root')

  const profilePath = path.join(resolved.outputRoot, 'profile-template')
  const mediaPath = path.join(resolved.outputRoot, 'media')
  const nativeProfilePath = path.join(resolved.outputRoot, 'native-profile')
  const nativeCachePath = path.join(resolved.outputRoot, 'native-cache')
  const manifestPath = path.join(resolved.outputRoot, 'workspace-manifest.json')
  let ownsOutput = false

  try {
    await fs.mkdir(resolved.outputRoot)
    ownsOutput = true
    await copyProfileDirectory(resolved.profileSource, profilePath, resolved.copyBrowserCaches)
    await Promise.all(LOCK_FILES.map(fileName => fs.rm(path.join(profilePath, fileName), { force: true })))
    await fs.mkdir(mediaPath)
    await fs.mkdir(nativeProfilePath)
    await fs.mkdir(nativeCachePath)

    const sourceDatabasePath = path.join(resolved.profileSource, 'LxDatas', 'lx.data.db')
    const databasePath = path.join(profilePath, 'LxDatas', 'lx.data.db')
    const sourceDatabaseSha256 = await hashFile(sourceDatabasePath)
    const copiedBySource = new Map()
    const copiedMedia = []
    let copiedLocalTrackCount = 0
    let copiedLocalTrackBytes = 0
    const excludedLocalRows = []

    const copyReferencedFile = async sourceFilePath => {
      const match = findMediaRoot(sourceFilePath, resolved.mediaRoots)
      if (!match) throw new Error(`local file path is outside every declared media root: ${sourceFilePath}`)
      const comparisonKey = normalizeForComparison(match.resolvedPath)
      if (copiedBySource.has(comparisonKey)) return copiedBySource.get(comparisonKey)

      const sourceStats = await fs.lstat(match.resolvedPath)
      if (sourceStats.isSymbolicLink()) {
        throw new Error(`media file is a symbolic link, junction, or reparse point: ${match.resolvedPath}`)
      }
      if (!sourceStats.isFile()) throw new Error(`referenced media path is not a file: ${match.resolvedPath}`)
      const destinationPath = path.join(mediaPath, `root-${match.rootIndex}`, match.relativePath)
      await fs.mkdir(path.dirname(destinationPath), { recursive: true })
      await fs.copyFile(match.resolvedPath, destinationPath, fs.constants.COPYFILE_EXCL)
      const copiedStats = await fs.stat(destinationPath)
      const sourceSha256 = await hashFile(match.resolvedPath)
      const copiedSha256 = await hashFile(destinationPath)
      if (sourceStats.size !== copiedStats.size || sourceSha256 !== copiedSha256) {
        throw new Error(`copied media verification failed: ${match.resolvedPath}`)
      }
      const mapping = {
        sourcePath: match.resolvedPath,
        destinationPath,
        rootIndex: match.rootIndex,
        relativePath: match.relativePath,
        bytes: copiedStats.size,
        sha256: copiedSha256,
        sourceSha256,
      }
      copiedBySource.set(comparisonKey, mapping)
      copiedMedia.push(mapping)
      return mapping
    }

    const { rows } = await runSqliteWorker(resolved.outputRoot, {
      operation: 'checkpoint-read-local',
      databasePath,
    })
    const rewrittenRows = []
    for (const row of rows) {
        let meta
        try {
          meta = JSON.parse(row.meta)
        } catch {
          throw new Error(`local row ${row.workspaceRowId} contains invalid meta JSON`)
        }
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
          throw new Error(`local row ${row.workspaceRowId} contains invalid meta JSON`)
        }

        const trackRoot = findMediaRoot(meta.filePath, resolved.mediaRoots)
        if (!trackRoot && resolved.verificationMediaSubset) {
          excludedLocalRows.push({ workspaceRowId: row.workspaceRowId, reason: 'outside-declared-media-roots' })
          continue
        }
        let trackMapping
        try {
          trackMapping = await copyReferencedFile(meta.filePath)
        } catch (error) {
          if (!resolved.verificationMediaSubset || error.code !== 'ENOENT') throw error
          excludedLocalRows.push({ workspaceRowId: row.workspaceRowId, reason: 'source-file-missing' })
          continue
        }
        meta.filePath = trackMapping.destinationPath
        copiedLocalTrackCount += 1
        copiedLocalTrackBytes += trackMapping.bytes

        const rewriteOptionalPaths = async (value, parentKey) => {
          if (!value || typeof value !== 'object') return
          for (const [key, child] of Object.entries(value)) {
            if (typeof child === 'string' && shouldRewriteOptionalPath(key, parentKey)) {
              const match = findMediaRoot(child, resolved.mediaRoots)
              if (match) value[key] = (await copyReferencedFile(child)).destinationPath
              else if (path.isAbsolute(child)) throw new Error(`local asset path is outside every declared media root: ${child}`)
            } else if (child && typeof child === 'object') {
              await rewriteOptionalPaths(child, key)
            }
          }
        }
        await rewriteOptionalPaths(meta)
        rewrittenRows.push({ meta: JSON.stringify(meta), workspaceRowId: row.workspaceRowId })
    }
    if (resolved.verificationMediaSubset && rewrittenRows.length === 0) {
      throw new Error('verification media subset contains no usable local tracks')
    }
    await runSqliteWorker(resolved.outputRoot, {
      operation: 'rewrite-local',
      databasePath,
      rows: rewrittenRows,
      excludedRowIds: excludedLocalRows.map(row => row.workspaceRowId),
    })

    copiedMedia.sort((left, right) => left.destinationPath.localeCompare(right.destinationPath))
    const databaseSha256 = await hashFile(databasePath)
    const gitCommit = getGitCommit()
    const electronVersion = getElectronVersion()
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      outputRoot: resolved.outputRoot,
      manifestPath,
      profileSource: resolved.profileSource,
      profilePath,
      mediaPath,
      nativeProfilePath,
      nativeCachePath,
      outputPaths: { profilePath, mediaPath, nativeProfilePath, nativeCachePath, manifestPath },
      mediaRoots: resolved.mediaRoots,
      copiedMedia,
      copiedMediaMappings: copiedMedia.map(({ sourcePath, destinationPath, rootIndex, relativePath }) => ({
        sourcePath,
        destinationPath,
        rootIndex,
        relativePath,
      })),
      copiedLocalTrackCount,
      copiedLocalTrackBytes,
      ...(resolved.verificationMediaSubset ? {
        verificationMediaSubset: {
          enabled: true,
          complete: false,
          includedLocalTrackCount: copiedLocalTrackCount,
          excludedLocalTrackCount: excludedLocalRows.length,
          exclusions: excludedLocalRows,
        },
      } : {}),
      database: {
        sourcePath: sourceDatabasePath,
        path: databasePath,
        sha256: databaseSha256,
        sourceSha256: sourceDatabaseSha256,
      },
      sourceHashes: {
        database: { path: sourceDatabasePath, sha256: sourceDatabaseSha256 },
        media: copiedMedia.map(({ sourcePath: sourcePathValue, sourceSha256 }) => ({ path: sourcePathValue, sha256: sourceSha256 })),
      },
      copyBrowserCaches: resolved.copyBrowserCaches,
      electronVersion,
      gitCommit,
      sourceProfileWasInactive: true,
      profileActivityEvidence: {
        completed: true,
        method: resolved.activityEvidenceMethod,
      },
    }
    await atomicWriteJson(manifestPath, manifest)
    return manifest
  } catch (error) {
    if (ownsOutput) await fs.rm(resolved.outputRoot, { recursive: true, force: true })
    throw error
  }
}

module.exports = { prepareWorkspace }
