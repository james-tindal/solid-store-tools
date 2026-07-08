import { assert, test } from 'vitest'
import { createComputed, createRoot, createSignal } from 'solid-js'
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
  const [money, setMoney] = createSignal(10_000)
  const object = getters({
    player: {
      name: 'Player',
      money,
    },
    players: [
      { money },
    ],
  })

  assert.strictEqual(object.player.name, 'Player')
  assert.strictEqual(object.player.money, 10_000)
  assert.strictEqual(object.players[0]!.money, 10_000)

  setMoney(9_900)

  assert.strictEqual(object.player.money, 9_900)
  assert.strictEqual(object.players[0]!.money, 9_900)
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
