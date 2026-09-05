const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('playback RMS sampling reuses per-deck buffers and handles analyser size changes', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/plugins/player/index.ts'), 'utf8')
  const start = source.indexOf('const readDeckRms')
  const end = source.indexOf('\nexport ', start)
  const buffers = []
  const analyser = { fftSize: 4, getFloatTimeDomainData: buffer => { buffers.push(buffer); buffer.fill(0.5) } }
  const context = { deckAnalysers: [analyser, analyser], deckRmsBuffers: [null, null], Float32Array, Math }
  vm.runInNewContext(ts.transpileModule(source.slice(start, end) + '\nthis.read = readDeckRms', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  assert.equal(context.read(0), 0.5)
  assert.equal(context.read(0), 0.5)
  assert.equal(buffers[0], buffers[1])
  context.read(1)
  assert.notEqual(buffers[1], buffers[2])
  analyser.fftSize = 8
  context.read(0)
  assert.equal(buffers[3].length, 8)
})
