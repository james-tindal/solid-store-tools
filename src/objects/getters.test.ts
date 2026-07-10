import { assert, test } from 'vitest'
import { createComputed, createRoot, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { getters } from './getters'

test('deriveObject exposes derived entries as properties', () => createRoot(dispose => {
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

test('deriveObject evaluates derived entries lazily', () => {
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

test('deriveObject tracks source dependencies from the read site', () => createRoot(dispose => {
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

test('deriveObject recurses into plain object and array entries', () => createRoot(dispose => {
  const [value, setValue] = createSignal(10_000)
  const object = getters({
    item: {
      label: 'Item',
      value,
    },
    items: [
      { value },
    ],
  })

  assert.strictEqual(object.item.label, 'Item')
  assert.strictEqual(object.item.value, 10_000)
  assert.strictEqual(object.items[0]!.value, 10_000)

  setValue(9_900)

  assert.strictEqual(object.item.value, 9_900)
  assert.strictEqual(object.items[0]!.value, 9_900)
  dispose()
}))

test('deriveObject properties are enumerable and spread current values', () => createRoot(dispose => {
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

test('deriveObject reports derived entries as accessor descriptors', () => {
  const object = getters({
    value: () => 1,
    label: 'static',
  })

  const derived = Object.getOwnPropertyDescriptor(object, 'value')
  const staticValue = Object.getOwnPropertyDescriptor(object, 'label')

  assert.strictEqual(typeof derived?.get, 'function')
  assert.strictEqual(derived?.enumerable, true)
  assert.strictEqual(derived?.configurable, true)
  assert.strictEqual(staticValue?.value, 'static')
  assert.strictEqual(staticValue?.enumerable, true)
  assert.strictEqual(staticValue?.configurable, true)
})

test('deriveObject accessor descriptors can be passed through Solid store updates', () => {
  const object = getters({
    nested: () => ({ value: 'initial' }),
  })
  const [, setStore] = createStore({} as { data?: typeof object })

  assert.doesNotThrow(() => setStore({ data: object }))
})
