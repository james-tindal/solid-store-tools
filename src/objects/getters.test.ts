import { assert, expectTypeOf, test } from 'vitest'
import { createComputed, createRoot, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { getters } from './getters'

test('getters() exposes derived entries as properties', () => createRoot(dispose => {
  const [count, setCount] = createSignal(1)
  const object = getters({
    count,
    label: 'chips',
  })

  assert.strictEqual(object.count, 1)
  assert.strictEqual(object.label, 'chips')

  setCount(2)

  assert.strictEqual(object.count, 2)
  dispose()
}))

test('getters() evaluates derived entries lazily', () => {
  let reads = 0
  const object = getters({
    value: () => {
      reads++
      return 1
    },
  })

  assert.strictEqual(reads, 0)
  assert.strictEqual(object.value, 1)
  assert.strictEqual(reads, 1)
  assert.strictEqual(object.value, 1)
  assert.strictEqual(reads, 2)
})

test('getters() reads source values at access time', () => {
  const source = {
    value: 1,
    nested: {
      value: 10,
    },
  }
  const object = getters(source)

  assert.strictEqual(object.value, 1)
  assert.strictEqual(object.nested.value, 10)

  source.value = 2
  source.nested.value = 20

  assert.strictEqual(object.value, 2)
  assert.strictEqual(object.nested.value, 20)
})

test('getters() retains functions with parameters', () => {
  const double = (value: number) => value * 2
  const optional = (value?: number) => value ?? 1
  const object = getters({
    double,
    optional,
    nested: {
      double,
      optional,
    },
  })

  assert.strictEqual(object.double, double)
  assert.strictEqual(object.double(3), 6)
  assert.strictEqual(object.optional, optional)
  assert.strictEqual(object.optional(), 1)
  assert.strictEqual(object.optional(5), 5)
  assert.strictEqual(object.nested.double, double)
  assert.strictEqual(object.nested.double(4), 8)
  assert.strictEqual(object.nested.optional, optional)
  assert.strictEqual(object.nested.optional(), 1)
  assert.strictEqual(object.nested.optional(6), 6)
})

test('getters() types match runtime arity rule', () => {
  const accessor = () => 1
  const required = (value: number) => value * 2
  const optional = (value?: number) => value ?? 1
  const object = getters({
    accessor,
    required,
    optional,
    label: 'chips',
    items: [accessor],
    nested: {
      accessor,
      required,
      optional,
      items: [accessor],
    },
  })

  expectTypeOf(object.accessor).toEqualTypeOf<number>()
  expectTypeOf(object.required).toEqualTypeOf<(value: number) => number>()
  expectTypeOf(object.optional).toEqualTypeOf<(value?: number) => number>()
  expectTypeOf(object.label).toEqualTypeOf<'chips'>()
  expectTypeOf(object.items).toEqualTypeOf<readonly [() => number]>()
  expectTypeOf(object.nested.accessor).toEqualTypeOf<number>()
  expectTypeOf(object.nested.required).toEqualTypeOf<(value: number) => number>()
  expectTypeOf(object.nested.optional).toEqualTypeOf<(value?: number) => number>()
  expectTypeOf(object.nested.items).toEqualTypeOf<readonly [() => number]>()
})

test('getters() tracks source dependencies from the read site', () => createRoot(dispose => {
  const [count, setCount] = createSignal(1)
  const object = getters({
    count,
    other: () => 'stable',
  })
  const seen: number[] = []

  createComputed(() => {
    seen.push(object.count)
  })

  assert.deepStrictEqual(seen, [1])

  setCount(2)

  assert.deepStrictEqual(seen, [1, 2])
  dispose()
}))

test('getters() recurses into object entries and retains arrays', () => createRoot(dispose => {
  const [value, setValue] = createSignal(10_000)
  const items = [{ value }]
  const object = getters({
    item: {
      label: 'Item',
      value,
    },
    items,
  })

  assert.strictEqual(object.item.label, 'Item')
  assert.strictEqual(object.item.value, 10_000)
  assert.strictEqual(object.items, items)
  assert.strictEqual(object.items[0]!.value, value)
  assert.strictEqual(object.items[0]!.value(), 10_000)

  setValue(9_900)

  assert.strictEqual(object.item.value, 9_900)
  assert.strictEqual(object.items[0]!.value(), 9_900)
  dispose()
}))

test('getters() properties are enumerable and spread current values', () => createRoot(dispose => {
  const [count, setCount] = createSignal(1)
  const object = getters({
    count,
    label: 'chips',
  })

  assert.deepStrictEqual(Object.keys(object), ['count', 'label'])
  assert.deepStrictEqual({ ...object }, { count: 1, label: 'chips' })

  setCount(2)

  assert.deepStrictEqual({ ...object }, { count: 2, label: 'chips' })
  dispose()
}))

test('getters() all entries are accessors', () => {
    const object = getters({
      value: () => 1,
      label: 'static',
    })

    const value = Object.getOwnPropertyDescriptor(object, 'value')
    const label = Object.getOwnPropertyDescriptor(object, 'label')

    assert.strictEqual(typeof value?.get, 'function')
    assert.strictEqual(value?.enumerable, true)
    assert.strictEqual(value?.configurable, true)
    assert.strictEqual(value?.get?.call(object), 1)

    assert.strictEqual(typeof label?.get, 'function')
    assert.strictEqual(label?.enumerable, true)
    assert.strictEqual(label?.configurable, true)
    assert.strictEqual(label?.get?.call(object), 'static')
  })

test('getters() accessor descriptors can be passed through Solid store updates', () => {
  const object = getters({
    nested: () => ({ value: 'initial' }),
  })
  const [, setStore] = createStore({} as { data?: typeof object })

  assert.doesNotThrow(() => setStore({ data: object }))
})
