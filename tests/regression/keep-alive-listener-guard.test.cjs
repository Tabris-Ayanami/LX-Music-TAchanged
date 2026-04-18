const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')

const selectionSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'base', 'Selection.vue'), 'utf8')
const popupSource = fs.readFileSync(path.join(rootDir, 'src', 'renderer', 'components', 'base', 'Popup.vue'), 'utf8')

test('RG-014: selection detaches document listeners when a kept-alive view deactivates', () => {
  assert.match(
    selectionSource,
    /activated\(\)\s*\{[\s\S]*attachDocumentListener\(\)/m,
    'Selection should reattach its document click listener when the cached view reactivates',
  )
  assert.match(
    selectionSource,
    /deactivated\(\)\s*\{[\s\S]*handleHide\(\)[\s\S]*detachDocumentListener\(\)/m,
    'Selection should close itself and detach document listeners when the cached view deactivates',
  )
})

test('RG-014: popup detaches document listeners when a kept-alive view deactivates', () => {
  assert.match(
    popupSource,
    /onActivated\(\(\)\s*=>\s*\{[\s\S]*attachDocumentListener\(\)/m,
    'Popup should reattach its document click listener when the cached view reactivates',
  )
  assert.match(
    popupSource,
    /onDeactivated\(\(\)\s*=>\s*\{[\s\S]*emit\('update:visible', false\)[\s\S]*detachDocumentListener\(\)/m,
    'Popup should hide itself and detach document listeners when the cached view deactivates',
  )
})

test('RG-016: quality gate includes a production renderer build', () => {
  const qualityGateSource = fs.readFileSync(path.join(rootDir, 'scripts', 'quality', 'run-quality-gate.cjs'), 'utf8')
  assert.match(
    qualityGateSource,
    /const steps = \['lint', 'typecheck', 'test:unit', 'build:renderer'\]/,
    'Quality gate should cover the production renderer build before release',
  )
})
