const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const rendererMainSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'main.ts'), 'utf8')
const runnerDevSource = fs.readFileSync(path.join(rootDir, 'build-config', 'runner-dev.js'), 'utf8')

test('RG-047: dev-server overlay errors do not replace the renderer with startup failure', () => {
  assert.match(
    runnerDevSource,
    /client: \{[\s\S]*logging: 'warn',[\s\S]*overlay: false,[\s\S]*\}/m,
    'The Electron dev runner should disable webpack-dev-server DOM overlay injection',
  )
  assert.match(
    rendererMainSource,
    /const isBootstrapped = \(\) => \{[\s\S]*__lxRendererBootstrapped/m,
    'Renderer startup handling should know whether the app has already mounted',
  )
  assert.match(
    rendererMainSource,
    /const isWebpackDevOverlayError = \(error: unknown\) => \{[\s\S]*webpack-dev-server\/client\/overlay\.js[\s\S]*removeChild[\s\S]*The node to be removed is not a child of this node/m,
    'Known webpack-dev-server overlay cleanup errors should be classified separately',
  )
  assert.match(
    rendererMainSource,
    /if \(isWebpackDevOverlayError\(error\)\) \{[\s\S]*appendStartupLog\(title, error\)[\s\S]*return[\s\S]*\}/m,
    'Known overlay cleanup errors should be logged without taking over the page',
  )
  assert.match(
    rendererMainSource,
    /if \(!isBootstrapped\(\)\) \{[\s\S]*showStartupError\(title, error\)[\s\S]*return[\s\S]*\}/m,
    'The startup failure page should only take over before the renderer has mounted',
  )
})
