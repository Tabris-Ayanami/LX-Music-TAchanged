const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const { runListAction } = require(path.join(rootDir, 'src', 'renderer', 'utils', 'listActionRunner.cjs'))

test('RG-011: list button actions close the context menu before running the business action', () => {
  const executionOrder = []

  const result = runListAction({
    beforeAction: () => executionOrder.push('before'),
    closeMenu: () => executionOrder.push('close'),
    action: () => {
      executionOrder.push('action')
      return 'done'
    },
  })

  assert.deepEqual(executionOrder, ['before', 'close', 'action'])
  assert.equal(result, 'done')
})
