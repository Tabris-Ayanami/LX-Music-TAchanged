const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('native download polling remains serialized until conversion finishes', async() => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/main/modules/nativeCore/downloadServices.ts'), 'utf8')
  const start = source.includes('const finishNativePoll') ? source.indexOf('const finishNativePoll') : source.indexOf('const pollNativeTasks')
  const end = source.indexOf('const cancelNativeTask', start)
  let releaseConversion
  const conversion = new Promise(resolve => { releaseConversion = resolve })
  let polls = 0
  let scheduled = 0
  const task = { jobId: 'job', request: { taskId: 'task' } }
  const context = {
    nativePollInFlight: false, nativeTasks: new Map([['task', task]]),
    getNativeCoreSupervisor: () => ({ call: async() => { polls++; return [{ jobId: 'job', state: 'completed' }] } }),
    handleNativeStatus: () => conversion, clearNativeTask() {}, emitNativeDownloadAction() {},
    scheduleNativePoll: () => { scheduled++ },
  }
  vm.runInNewContext(ts.transpileModule(source.slice(start, end) + '\nthis.poll = pollNativeTasks', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  const first = context.poll()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(context.nativePollInFlight, true, 'The in-flight flag must include asynchronous conversion')
  await context.poll()
  assert.equal(polls, 1)
  releaseConversion()
  await first
  assert.equal(context.nativePollInFlight, false)
  assert.equal(scheduled, 1)
})
