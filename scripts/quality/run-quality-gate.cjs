#!/usr/bin/env node
/**
 * Minimal quality gate runner.
 * Keep this small and deterministic so future maintenance threads can reuse it
 * as the default local verification entry point.
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const steps = ['lint', 'typecheck', 'test:unit', 'build:renderer']
const failures = []

for (const step of steps) {
  console.log(`\n[quality] running ${step}\n`)
  const result = spawnSync(npmCmd, ['run', step], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) failures.push({ step, status: result.status ?? 1 })
}

if (failures.length) {
  console.error('\n[quality] failed checks:')
  for (const failure of failures) {
    console.error(`- ${failure.step} (exit ${failure.status})`)
  }
  process.exit(failures[0].status)
}

console.log('\n[quality] all checks passed\n')
