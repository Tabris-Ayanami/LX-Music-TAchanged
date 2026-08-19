#!/usr/bin/env node
'use strict'

const { spawnSync } = require('node:child_process')

const { prepareWorkspace } = require('./workspace.cjs')
const { collectActiveProfilePaths, excludeInvokerProcessChain } = require('./process-discovery.cjs')

const parseArguments = argumentsList => {
  const parsed = { mediaRoots: [], copyBrowserCaches: false, verificationMediaSubset: false }
  for (const argument of argumentsList) {
    if (argument.startsWith('--profile-source=')) parsed.profileSource = argument.slice('--profile-source='.length)
    else if (argument.startsWith('--media-root=')) parsed.mediaRoots.push(argument.slice('--media-root='.length))
    else if (argument.startsWith('--output=')) parsed.outputRoot = argument.slice('--output='.length)
    else if (argument === '--copy-browser-caches') parsed.copyBrowserCaches = true
    else if (argument === '--verification-media-subset') parsed.verificationMediaSubset = true
    else throw new Error(`unknown argument: ${argument}`)
  }
  if (!parsed.profileSource || !parsed.outputRoot || parsed.mediaRoots.length === 0) {
    throw new Error('usage: --profile-source=<path> --media-root=<path> [--media-root=<path>] --output=<path> [--verification-media-subset]')
  }
  return parsed
}

const getProcessRecords = () => {
  if (process.platform !== 'win32') throw new Error('active profile detection requires Windows')
  const script = 'Get-CimInstance Win32_Process | Where-Object CommandLine | Select-Object ProcessId, ParentProcessId, CommandLine | ConvertTo-Json -Compress'
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.status !== 0) throw new Error(`unable to inspect active profiles: ${(result.stderr || '').trim()}`)
  const decoded = result.stdout.trim() === '' ? [] : JSON.parse(result.stdout)
  return Array.isArray(decoded) ? decoded : [decoded]
}

const buildPreparationOptions = ({ argumentsList, processRecords, currentProcessId }) => {
  const options = parseArguments(argumentsList)
  const eligibleProcesses = excludeInvokerProcessChain(processRecords, currentProcessId)
  options.activeProfilePaths = collectActiveProfilePaths(eligibleProcesses, options.profileSource)
  options.activityEvidenceMethod = 'windows-process-command-lines'
  return options
}

const runPreparation = async ({ argumentsList, processRecords, currentProcessId }) => {
  return prepareWorkspace(buildPreparationOptions({ argumentsList, processRecords, currentProcessId }))
}

const main = async () => {
  const manifest = await runPreparation({
    argumentsList: process.argv.slice(2),
    processRecords: getProcessRecords(),
    currentProcessId: process.pid,
  })
  process.stdout.write(`${manifest.manifestPath}\n`)
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}

module.exports = { buildPreparationOptions, getProcessRecords, main, parseArguments, runPreparation }
