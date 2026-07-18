const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const virtualizedListPath = path.join(rootDir, 'src', 'renderer', 'components', 'base', 'VirtualizedList.vue')
const useListScrollPath = path.join(rootDir, 'src', 'renderer', 'views', 'List', 'MusicList', 'useListScroll.js')

const virtualizedListSource = fs.readFileSync(virtualizedListPath, 'utf8')
const useListScrollSource = fs.readFileSync(useListScrollPath, 'utf8')

test('RG-001: VirtualizedList protects scroll reads when the container ref is gone', () => {
  assert.match(
    virtualizedListSource,
    /const container = dom_scrollContainer\.value[\s\S]*if \(!container\) return/,
    'VirtualizedList should guard container access before reading scrollTop/clientHeight',
  )
})

test('RG-001: VirtualizedList clears deferred updates during unmount', () => {
  assert.match(
    virtualizedListSource,
    /const clearScheduledUpdate = \(\) => \{/,
    'VirtualizedList should centralize deferred timeout / RAF cleanup',
  )
  assert.match(
    virtualizedListSource,
    /onBeforeUnmount\(\(\) => \{[\s\S]*clearScheduledUpdate\(\)/,
    'VirtualizedList should cancel pending async updates before the component is destroyed',
  )
  assert.match(
    virtualizedListSource,
    /const scheduleUpdateView = \(\) => \{[\s\S]*if \(updateFrame != null\) return[\s\S]*requestAnimationFrame/,
    'VirtualizedList should coalesce repeated scroll and resize updates into one animation frame',
  )
  assert.doesNotMatch(
    virtualizedListSource,
    /const updateView = [\s\S]*?requestAnimationFrame\(/,
    'VirtualizedList should not enqueue a second untracked animation frame while rendering a scheduled update',
  )
  assert.match(
    virtualizedListSource,
    /onBeforeUnmount\(\(\) => \{[\s\S]*setStopScrollStatus\.cancel\(\)/,
    'VirtualizedList should release the scroll debounce closure during unmount',
  )
})

test('RG-001: list scroll restore waits for a mounted list controller', () => {
  assert.match(
    useListScrollSource,
    /const getListController = async\(\) => \{[\s\S]*await nextTick\(\)/,
    'Scroll restoration should wait for the virtualized list ref to exist',
  )
  assert.match(
    useListScrollSource,
    /if \(!controller\) return/,
    'Scroll restoration should no-op when the list controller is still unavailable',
  )
})
