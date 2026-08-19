#!/usr/bin/env node
'use strict'

const path = require('node:path')
const { spawnSync } = require('node:child_process')

const { prepareWorkspace } = require('./workspace.cjs')

const parseArguments = argumentsList => {
  const parsed = { mediaRoots: [], copyBrowserCaches: false }
  for (const argument of argumentsList) {
    if (argument.startsWith('--profile-source=')) parsed.profileSource = argument.slice('--profile-source='.length)
    else if (argument.startsWith('--media-root=')) parsed.mediaRoots.push(argument.slice('--media-root='.length))
    else if (argument.startsWith('--output=')) parsed.outputRoot = argument.slice('--output='.length)
    else if (argument === '--copy-browser-caches') parsed.copyBrowserCaches = true
    else throw new Error(`unknown argument: ${argument}`)
  }
  if (!parsed.profileSource || !parsed.outputRoot || parsed.mediaRoots.length === 0) {
    throw new Error('usage: --profile-source=<path> --media-root=<path> [--media-root=<path>] --output=<path>')
  }
  return parsed
}

const extractUserDataPaths = commandLine => {
  const paths = []
  const pattern = /(?:^|\s)--user-data-dir(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/gi
  let match
  while ((match = pattern.exec(commandLine)) !== null) paths.push(path.resolve(match[1] ?? match[2] ?? match[3]))
  return paths
}

const getActiveProfilePaths = () => {
  if (process.platform !== 'win32') throw new Error('active profile detection requires Windows')
  const script = '(Get-CimInstance Win32_Process | Where-Object CommandLine | Select-Object -ExpandProperty CommandLine) | ConvertTo-Json -Compress'
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0) throw new Error(`unable to inspect active profiles: ${(result.stderr || '').trim()}`)
  const decoded = result.stdout.trim() === '' ? [] : JSON.parse(result.stdout)
  const commandLines = Array.isArray(decoded) ? decoded : [decoded]
  const activePaths = commandLines.flatMap(commandLine => extractUserDataPaths(String(commandLine)))
  return [...new Map(activePaths.map(activePath => [activePath.toLowerCase(), activePath])).values()]
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  options.activeProfilePaths = getActiveProfilePaths()
  const manifest = await prepareWorkspace(options)
  process.stdout.write(`${manifest.manifestPath}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
