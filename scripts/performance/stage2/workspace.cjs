'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const Database = require('better-sqlite3')

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..')
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
  if (options.activeProfilePaths != null && !Array.isArray(options.activeProfilePaths)) {
    throw new TypeError('activeProfilePaths must be an array')
  }

  return {
    profileSource: path.resolve(options.profileSource),
    outputRoot: path.resolve(options.outputRoot),
    mediaRoots: options.mediaRoots.map(root => path.resolve(root)),
    activeProfilePaths: (options.activeProfilePaths ?? []).map(activePath => path.resolve(activePath)),
    copyBrowserCaches: options.copyBrowserCaches === true,
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

const prepareWorkspace = async options => {
  const resolved = resolveOptions(options)
  validatePathBoundaries(resolved)
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

    const db = new Database(databasePath)
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
      const rows = db.prepare("SELECT rowid AS workspaceRowId, meta FROM my_list_music_info WHERE source = 'local' ORDER BY rowid").all()
      const update = db.prepare('UPDATE my_list_music_info SET meta = ? WHERE rowid = ?')
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

        const trackMapping = await copyReferencedFile(meta.filePath)
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
        rewrittenRows.push([JSON.stringify(meta), row.workspaceRowId])
      }
      const commitRows = db.transaction(() => {
        for (const [meta, rowId] of rewrittenRows) update.run(meta, rowId)
      })
      commitRows()
      db.pragma('wal_checkpoint(TRUNCATE)')
    } finally {
      db.close()
    }

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
    }
    await atomicWriteJson(manifestPath, manifest)
    return manifest
  } catch (error) {
    if (ownsOutput) await fs.rm(resolved.outputRoot, { recursive: true, force: true })
    throw error
  }
}

module.exports = { prepareWorkspace }
