const path = require('node:path')
const Module = require('node:module')

const buildRoot = path.resolve(__dirname, '../../build/backend-contract-tests')
global.window = {
  lxHost: {
    platform: {
      name: process.platform,
      arch: process.arch,
      appVersion: 'test',
      isProduction: false,
      defaultDownloadPath: '',
      pathSeparator: path.sep,
      normalizePath: value => value,
      pathToFileURL: value => value,
      showItemInFolder: () => {},
      openExternal: async() => {},
      clipboardWriteText: () => {},
      clipboardReadText: () => '',
    },
  },
}
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function(request, parent, ...rest) {
  const alias = request.startsWith('@renderer/')
    ? path.join(buildRoot, 'src/renderer', request.slice('@renderer/'.length))
    : request.startsWith('@common/')
      ? path.join(buildRoot, 'src/common', request.slice('@common/'.length))
      : null
  if (alias) {
    for (const candidate of [alias, `${alias}.js`, `${alias}.json`, path.join(alias, 'index.js')]) {
      try { return originalResolveFilename.call(this, candidate, parent, ...rest) } catch {}
    }
  }
  return originalResolveFilename.call(this, request, parent, ...rest)
}

require(path.join(buildRoot, 'tests/backend-contract/backend-contract.test.js'))
