#!/usr/bin/env node
/**
 * Lightweight regression-test runner.
 * We use Node's built-in test runner so the suite can grow without introducing
 * another test framework before the project is ready for one.
 */
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..', '..')
const testsDir = path.join(rootDir, 'tests', 'regression')

const collectTestFiles = (dir) => {
  if (!fs.existsSync(dir)) return []

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap(entry => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectTestFiles(entryPath)
    return entry.name.endsWith('.test.cjs') ? [entryPath] : []
  })
}

const testFiles = collectTestFiles(testsDir)

if (!testFiles.length) {
  console.error('No regression test files were found under tests/regression.')
  process.exit(1)
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: rootDir,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
