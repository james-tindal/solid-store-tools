import { createComputed } from 'solid-js'
import { afterEach, assert, test } from 'vitest'
import { MutableStore } from '../index'
import { testRoot } from '../solid-root'

class Counter extends MutableStore {
  count = 0

  constructor(initialCount: number) {
    super()
    this.count = initialCount
  }

  get doubled() { return this.count * 2 }

  increment() {
    this.count++
  }
}

afterEach(() => testRoot.dispose())

test('MutableStore makes subclass fields and derived getters reactive', () => {
  testRoot(() => {
    const counter = new Counter(2)
    const counts: number[] = []
    const doubled: number[] = []

    createComputed(() => {
      counts.push(counter.count)
    })
    createComputed(() => {
      doubled.push(counter.doubled)
    })

    assert.instanceOf(counter, Counter)
    assert.instanceOf(counter, MutableStore)
    assert.deepEqual(counts, [2])
    assert.deepEqual(doubled, [4])

    counter.increment()

    assert.deepEqual(counts, [2, 3])
    assert.deepEqual(doubled, [4, 6])

    counter.count = 5

    assert.deepEqual(counts, [2, 3, 5])
    assert.deepEqual(doubled, [4, 6, 10])
  })
})
