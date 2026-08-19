'use strict'

const path = require('node:path')

const getProcessId = processRecord => Number(processRecord.processId ?? processRecord.ProcessId)
const getParentProcessId = processRecord => Number(processRecord.parentProcessId ?? processRecord.ParentProcessId)
const getCommandLine = processRecord => String(processRecord.commandLine ?? processRecord.CommandLine ?? '')

const normalizeText = value => {
  const normalized = String(value).replaceAll('/', path.sep)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

const extractUserDataPaths = commandLine => {
  const paths = []
  const pattern = /(?:^|\s)--user-data-dir(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/gi
  let match
  while ((match = pattern.exec(commandLine)) !== null) paths.push(path.resolve(match[1] ?? match[2] ?? match[3]))
  return paths
}

const excludeInvokerProcessChain = (processRecords, currentProcessId) => {
  const byId = new Map(processRecords.map(processRecord => [getProcessId(processRecord), processRecord]))
  const excluded = new Set()
  let processId = Number(currentProcessId)
  while (Number.isInteger(processId) && processId > 0 && !excluded.has(processId)) {
    excluded.add(processId)
    const record = byId.get(processId)
    if (!record) break
    processId = getParentProcessId(record)
  }
  return processRecords.filter(processRecord => !excluded.has(getProcessId(processRecord)))
}

const collectActiveProfilePaths = (processRecords, profileSource) => {
  const resolvedProfileSource = path.resolve(profileSource)
  const normalizedProfileSource = normalizeText(resolvedProfileSource)
  const activePaths = []
  const seen = new Set()
  const addPath = activePath => {
    const resolvedPath = path.resolve(activePath)
    const key = normalizeText(resolvedPath)
    if (seen.has(key)) return
    seen.add(key)
    activePaths.push(resolvedPath)
  }

  for (const processRecord of processRecords) {
    const commandLine = getCommandLine(processRecord)
    if (normalizeText(commandLine).includes(normalizedProfileSource)) addPath(resolvedProfileSource)
    for (const userDataPath of extractUserDataPaths(commandLine)) addPath(userDataPath)
  }
  return activePaths
}

module.exports = {
  collectActiveProfilePaths,
  excludeInvokerProcessChain,
  extractUserDataPaths,
}
