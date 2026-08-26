#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const rendererRoot = path.join(root, 'src', 'renderer')
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.vue'])
const adapterPath = 'src/renderer/backend/electron.ts'
const limits = {
  legacyTransportFiles: 58,
  directRuntimeFiles: 33,
}

const files = []
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'vendor') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(fullPath)
    else if (allowedExtensions.has(path.extname(entry.name))) files.push(fullPath)
  }
}
walk(rendererRoot)

const importPattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g
const transportSpecs = new Set(['@renderer/utils/ipc', '@common/rendererIpc', '@common/ipcNames'])
const isRuntimeSpec = spec => spec === 'electron' ||
  spec === 'electron-updater' ||
  spec === '@common/utils/electron' ||
  spec === 'better-sqlite3' ||
  spec === '@ffmpeg-installer/ffmpeg' ||
  spec.startsWith('node:')

const legacyTransportFiles = new Set()
const directRuntimeFiles = new Set()
const backendViolations = []

for (const file of files) {
  const relativePath = path.relative(root, file).replaceAll('\\', '/')
  const source = fs.readFileSync(file, 'utf8')
  const specs = []
  for (const match of source.matchAll(importPattern)) specs.push(match[1])
  if (specs.some(spec => transportSpecs.has(spec))) legacyTransportFiles.add(relativePath)
  if (specs.some(isRuntimeSpec)) directRuntimeFiles.add(relativePath)
  if (relativePath.startsWith('src/renderer/backend/') && relativePath !== adapterPath) {
    const forbidden = specs.filter(spec => transportSpecs.has(spec) || isRuntimeSpec(spec))
    if (forbidden.length) backendViolations.push(`${relativePath}: ${forbidden.join(', ')}`)
  }
}

const failures = []
if (backendViolations.length) failures.push(`Backend contracts/fakes imported runtime details:\n${backendViolations.join('\n')}`)
if (legacyTransportFiles.size > limits.legacyTransportFiles) failures.push(`Legacy transport file count grew: ${legacyTransportFiles.size} > ${limits.legacyTransportFiles}`)
if (directRuntimeFiles.size > limits.directRuntimeFiles) failures.push(`Direct Electron/Node runtime file count grew: ${directRuntimeFiles.size} > ${limits.directRuntimeFiles}`)

console.log(`[backend-boundary] legacy transport files: ${legacyTransportFiles.size}/${limits.legacyTransportFiles}`)
console.log(`[backend-boundary] direct runtime files: ${directRuntimeFiles.size}/${limits.directRuntimeFiles}`)

if (process.argv.includes('--list')) {
  console.log('[backend-boundary] legacy transport inventory:')
  for (const file of [...legacyTransportFiles].sort()) console.log(`  ${file}`)
  console.log('[backend-boundary] direct runtime inventory:')
  for (const file of [...directRuntimeFiles].sort()) console.log(`  ${file}`)
}

if (failures.length) {
  for (const failure of failures) console.error(`[backend-boundary] ${failure}`)
  process.exit(1)
}

console.log('[backend-boundary] no new dependency direction violations')
