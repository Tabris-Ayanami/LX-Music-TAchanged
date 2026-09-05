const fs = require('node:fs')
const path = require('node:path')
const { isBuiltin } = require('node:module')

// Resolve package directories, not entry points: builtins and package-local
// dist/package.json files must never turn into a glob for the project itself.
module.exports = (packagePath, rootDir = path.resolve(__dirname, '..')) => {
  const visited = new Set()
  const files = []
  const findDependency = (name, from) => {
    for (let dir = from; ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', name)
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
      if (dir == rootDir || dir == path.dirname(dir)) return null
    }
  }
  const collect = (dir) => {
    if (visited.has(dir)) return
    const relative = path.relative(rootDir, dir).replaceAll('\\', '/')
    if (!relative.startsWith('node_modules/') || relative.includes('../')) {
      throw new Error(`Dependency directory is outside node_modules: ${dir}`)
    }
    visited.add(dir)
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    files.push(`${relative}/**/*`)
    const names = new Set([
      ...Object.keys(info.dependencies ?? {}),
      ...Object.keys(info.optionalDependencies ?? {}),
      ...Object.keys(info.peerDependencies ?? {}),
    ])
    for (const name of names) {
      const dependency = findDependency(name, dir)
      if (dependency) collect(dependency)
      else if (isBuiltin(name)) continue
      else if (info.dependencies?.[name] && !info.optionalDependencies?.[name]) {
        throw new Error(`Missing required dependency ${name} of ${info.name}`)
      }
    }
  }
  collect(path.resolve(packagePath))
  return files
}
