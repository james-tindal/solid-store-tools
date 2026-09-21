import { assert, test } from 'vitest'
import { merge } from './merge'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <_T extends true>() => {}

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

test('later prototype entries override earlier own entries', () => {
  class Override {
    get value() { return 7_500 }
  }

  const merged = merge({ value: 10_000 }, new Override)

  assert.deepStrictEqual(Object.keys(merged), [])
  assert.strictEqual(merged.value, 7_500)
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
  const _optional = merge(
    { value: 1 },
    {} as { value?: string },
  )
  assertType<Equal<typeof _optional.value, 1 | string | undefined>>()

  const _undefinedable = merge(
    { value: 1 },
    {} as { value: string | undefined },
  )
  assertType<Equal<typeof _undefinedable.value, string | undefined>>()
})

test('merge defines properties on the winning source', () => {
  const base = { value: 1 }
  const override = { value: 2 }
  const merged = merge(base, override)

  Object.defineProperty(merged, 'value', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: 3,
  })

  assert.strictEqual(base.value, 1)
  assert.strictEqual(override.value, 3)
  assert.deepStrictEqual(Object.getOwnPropertyDescriptor(override, 'value'), {
    configurable: true,
    enumerable: false,
    writable: true,
    value: 3,
  })
})

test('merge defines missing properties on the last source', () => {
  const base = { value: 1 }
  const override = {} as { missing?: number }
  const merged = merge(base, override)

  Object.defineProperty(merged, 'missing', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: 2,
  })

  assert.isFalse('missing' in base)
  assert.strictEqual(override.missing, 2)
  assert.strictEqual(merged.missing, 2)
})

test('merge assigns properties on the winning source', () => {
  const base = { value: 1 }
  const override = { value: 2 }
  const merged = merge(base, override)

  merged.value = 3

  assert.strictEqual(base.value, 1)
  assert.strictEqual(override.value, 3)
  assert.strictEqual(merged.value, 3)
})

test('merge assigns missing properties on the last source', () => {
  const base = { value: 1 }
  const override = {} as { missing?: number }
  const merged = merge(base, override)

  merged.missing = 2

  assert.isFalse('missing' in base)
  assert.strictEqual(override.missing, 2)
  assert.strictEqual(merged.missing, 2)
})

test('merge deletes properties from the winning source', () => {
  const base = { value: 1 }
  const override = { value: 2 }
  const merged = merge(base, override) as { value?: number }

  assert.strictEqual(delete merged.value, true)

  assert.strictEqual(base.value, 1)
  assert.isFalse('value' in override)
  assert.strictEqual(merged.value, 1)
})

test('source accessors read from their source object, not the merged surface', () => {
  const base = {
    count: 1,
    get doubled() {
      return this.count * 2
    },
  }
  const override = { count: 10 }
  const merged = merge(base, override)

  assert.strictEqual(merged.count, 10)
  assert.strictEqual(merged.doubled, 2)
})

test('merge reflects replaced source accessors', () => {
  const source = {
    get value() {
      return 'initial'
    },
  }
  const merged = merge(source)

  assert.strictEqual(merged.value, 'initial')

  Object.defineProperty(source, 'value', {
    configurable: true,
    enumerable: true,
    get() {
      return 'updated'
    },
  })

  assert.strictEqual(merged.value, 'updated')
})
