import { assert, test } from 'vitest'
import { createStore } from 'solid-js/store'
import { merge } from './merge'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <T extends true>() => {}

test('merge exposes merged entries as live getters with later values winning', () => {
  const base = { label: 'Base', value: 10_000 }
  const override = { value: 9_000, count: 100 }
  const merged = merge(base, override)

  assert.deepStrictEqual(Object.keys(merged), ['label', 'value', 'count'])
  assert.strictEqual(merged.label, 'Base')
  assert.strictEqual(merged.value, 9_000)
  assert.strictEqual(merged.count, 100)

  base.label = 'Updated'
  base.value = 8_000
  override.value = 7_500
  override.count = 150

  assert.strictEqual(merged.label, 'Updated')
  assert.strictEqual(merged.value, 7_500)
  assert.strictEqual(merged.count, 150)
})

test('merge reports merged entries as accessor descriptors', () => {
  const source = { value: 1 }
  const merged = merge(source)

  const descriptor = Object.getOwnPropertyDescriptor(merged, 'value')

  assert.isDefined(descriptor)
  assert.strictEqual(descriptor!.enumerable, true)
  assert.strictEqual(descriptor!.configurable, true)
  assert.strictEqual(typeof descriptor!.get, 'function')
  assert.isFalse('value' in descriptor!)

  source.value = 2

  assert.strictEqual(descriptor!.get!.call(merged), 2)
})

test('merge accessor descriptors read function values the same way as property access', () => {
  const source = {
    count: 1,
    increment(amount: number) {
      this.count += amount
    },
  }
  const merged = merge(source)

  const descriptor = Object.getOwnPropertyDescriptor(merged, 'increment')

  assert.strictEqual(typeof descriptor?.get, 'function')

  descriptor!.get!.call(merged)(2)
  merged.increment(3)

  assert.strictEqual(merged.count, 6)
})

test('merge does not cache bound method values', () => {
  const source = {
    count: 0,
    increment() {
      this.count++
    },
  }
  const merged = merge(source)

  assert.notStrictEqual(merged.increment, merged.increment)
})

test('merge extracted methods call the current source entry', () => {
  const source: {
    count: number
    increment: (step?: number) => number
  } = {
    count: 1,
    increment(step = 1) {
      this.count += step
      return this.count
    },
  }
  const merged = merge(source)
  const increment = merged.increment

  assert.notStrictEqual(increment, source.increment)
  assert.strictEqual(increment(3), 4)
  assert.strictEqual(source.count, 4)

  source.increment = function (step = 1) {
    this.count += step * 10
    return this.count
  }

  assert.strictEqual(increment(2), 24)
  assert.strictEqual(source.count, 24)

  ;(source as any).increment = 1

  assert.strictEqual(merged.increment, 1 as any)
  assert.throws(() => increment(), TypeError)
})

test('merge accessor descriptors read overridden keys from the winning source', () => {
  const base = { value: 1 }
  const override = { value: 2 }
  const merged = merge(base, override)

  const descriptor = Object.getOwnPropertyDescriptor(merged, 'value')

  assert.strictEqual(typeof descriptor?.get, 'function')
  assert.strictEqual(descriptor!.get!.call(merged), 2)

  base.value = 3
  override.value = 4

  assert.strictEqual(descriptor!.get!.call(merged), 4)
})

test('merge proxies remain compatible with Solid store wrapping', () => {
  const [nestedStore] = createStore({ value: 'initial' })
  const merged = merge({ nestedStore })
  const [store, setStore] = createStore({} as { data?: typeof merged })

  assert.doesNotThrow(() => setStore({ data: merged }))
  assert.doesNotThrow(() => store.data)
  assert.strictEqual(store.data, merged)
})

test('merge ownKeys remains valid when a target-owned key overlaps a merged key', () => {
  const merged = merge({ value: 1 })

  Object.defineProperty(merged, 'value', {
    configurable: true,
    enumerable: false,
    value: 2,
  })

  assert.doesNotThrow(() => Reflect.ownKeys(merged))
  assert.deepStrictEqual(Reflect.ownKeys(merged), ['value'])
})

test('merge exposes own values, getters, and methods', () => {
  const source = {
    count: 10,

    get status() {
      if (this.count === 0)
        return 'empty'
    },

    decrement(amount: number) {
      this.count -= amount
    },
  }

  const merged = merge(source)
  const decrement = merged.decrement

  assert.deepStrictEqual(Object.keys(merged), ['count', 'status', 'decrement'])
  assert.strictEqual(merged.count, 10)
  assert.isUndefined(merged.status)

  decrement(10)

  assert.strictEqual(merged.count, 0)
  assert.strictEqual(merged.status, 'empty')
})

test('merge exposes prototype getters as live getters', () => {
  const source = { count: 100, enabled: false }

  class SourceView {
    get status() {
      if (source.count === 0 && !source.enabled)
        return 'inactive'
      if (source.count === 0)
        return 'empty'
    }
  }

  const merged = merge(new SourceView)

  assert.deepStrictEqual(Object.keys(merged), ['status'])
  assert.isUndefined(merged.status)

  source.count = 0
  source.enabled = true

  assert.strictEqual(merged.status, 'empty')
})

test('merge exposes prototype methods bound to the source object', () => {
  const source = { count: 10, total: 0 }

  class SourceActions {
    transfer(amount: number) {
      source.count -= amount
      source.total += amount
    }
  }

  const merged = merge(new SourceActions)
  const transfer = merged.transfer

  assert.deepStrictEqual(Object.keys(merged), ['transfer'])

  transfer(3)

  assert.strictEqual(source.count, 7)
  assert.strictEqual(source.total, 3)
})

test('merge lets later prototype entries override earlier object entries', () => {
  class Override {
    get value() { return 7_500 }
  }

  const merged = merge({ value: 10_000 }, new Override)

  assert.deepStrictEqual(Object.keys(merged), ['value'])
  assert.strictEqual(merged.value, 7_500)
})

test('merge reflects keys added to and deleted from sources after creation', () => {
  const source = { value: 10_000 } as { value: number, status?: string }
  const merged = merge(source)

  assert.deepStrictEqual(Object.keys(merged), ['value'])
  assert.isFalse('status' in merged)

  source.status = 'ready'

  assert.deepStrictEqual(Object.keys(merged), ['value', 'status'])
  assert.isTrue('status' in merged)
  assert.strictEqual(merged.status, 'ready')

  delete source.status

  assert.deepStrictEqual(Object.keys(merged), ['value'])
  assert.isFalse('status' in merged)
  assert.isUndefined(merged.status)
})

test('merge reports keys as present even when their value is undefined', () => {
  const merged = merge({ value: undefined as number | undefined })

  assert.isTrue('value' in merged)
  assert.deepStrictEqual(Object.keys(merged), ['value'])
  assert.isUndefined(merged.value)
})

test('merge falls through only when a later source is missing the key', () => {
  const withUndefined = merge(
    { value: 1 },
    { value: undefined as number | undefined },
  )

  assert.isTrue('value' in withUndefined)
  assert.deepStrictEqual(Object.keys(withUndefined), ['value'])
  assert.isUndefined(withUndefined.value)

  const missing = merge(
    { value: 1 },
    {} as { value?: number },
  )

  assert.isTrue('value' in missing)
  assert.deepStrictEqual(Object.keys(missing), ['value'])
  assert.strictEqual(missing.value, 1)
})

test('merge binds prototype methods to class instances with private fields', () => {
  class Counter {
    #count = 10

    decrement(amount: number) {
      this.#count -= amount
    }

    get count() {
      return this.#count
    }
  }

  const merged = merge(new Counter)
  const decrement = merged.decrement

  assert.strictEqual(merged.count, 10)

  decrement(3)

  assert.strictEqual(merged.count, 7)
})

test('merge types distinguish optional entries from required undefinedable entries', () => {
  const optional = merge(
    { value: 1 },
    {} as { value?: string },
  )
  assertType<Equal<typeof optional.value, 1 | string | undefined>>()

  const undefinedable = merge(
    { value: 1 },
    {} as { value: string | undefined },
  )
  assertType<Equal<typeof undefinedable.value, string | undefined>>()
})
