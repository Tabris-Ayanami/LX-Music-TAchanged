const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..', '..')
const { animateElementScroll } = require(path.join(rootDir, 'src', 'renderer', 'components', 'base', 'virtualizedListScrollHelper.cjs'))

const createScheduler = () => {
  let nextId = 1
  const tasks = new Map()

  return {
    setTimeout(fn) {
      const id = nextId++
      tasks.set(id, fn)
      return id
    },
    clearTimeout(id) {
      tasks.delete(id)
    },
    runNext() {
      const nextEntry = tasks.entries().next()
      if (nextEntry.done) return false
      const [id, fn] = nextEntry.value
      tasks.delete(id)
      fn()
      return true
    },
    runAll() {
      while (this.runNext()) {}
    },
    pendingCount() {
      return tasks.size
    },
    reset() {
      tasks.clear()
    },
  }
}

const createScrollableElement = (initialScrollTop = 0) => ({
  scrollTop: initialScrollTop,
  scrollHeight: 1000,
  clientHeight: 100,
  scrollTo(x, y) {
    this.scrollTop = y
  },
})

test('RG-001: animated scroll cancel stays safe when teardown does not pass a callback', () => {
  const scheduler = createScheduler()
  const events = []
  const element = createScrollableElement()

  const cancel = animateElementScroll({
    element,
    to: 180,
    duration: 30,
    increment: 10,
    scheduler,
    onComplete: () => events.push('complete'),
    onCancel: () => events.push('cancel'),
  })

  assert.equal(scheduler.pendingCount(), 1, 'animated scroll should schedule follow-up work')
  assert.doesNotThrow(() => cancel(), 'cancel should tolerate teardown paths that do not pass a resolver')
  scheduler.runAll()

  assert.deepEqual(events, ['cancel'])
  assert.equal(scheduler.pendingCount(), 0, 'cancel should clear pending timers')
})

test('RG-001: animated scroll cancellation is idempotent and only triggers the cancel path once', () => {
  const scheduler = createScheduler()
  const events = []
  const element = createScrollableElement()

  const cancel = animateElementScroll({
    element,
    to: 240,
    duration: 40,
    increment: 10,
    scheduler,
    onComplete: () => events.push('complete'),
    onCancel: () => events.push('cancel'),
  })

  cancel(() => events.push('resolver'))
  cancel(() => events.push('resolver-again'))
  scheduler.runAll()

  assert.deepEqual(events, ['resolver', 'cancel'])
  assert.equal(scheduler.pendingCount(), 0)
})

test('RG-001: animated scroll no-ops cleanly when the container element is unavailable', () => {
  const scheduler = createScheduler()
  const events = []
  const cancel = animateElementScroll({
    element: null,
    to: 100,
    scheduler,
    onComplete: () => events.push('complete'),
    onCancel: () => events.push('cancel'),
  })

  assert.deepEqual(events, ['complete'])
  assert.doesNotThrow(() => cancel())
  assert.equal(scheduler.pendingCount(), 0)
})
