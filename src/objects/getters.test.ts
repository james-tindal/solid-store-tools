import { assert, test } from 'vitest'
import { createComputed, createRoot, createSignal } from 'solid-js'
import { getters } from './getters'
import { omit } from './omit'
import { pick } from './pick'
import { merge } from './merge'

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

test('pick exposes picked entries as live getters', () => {
  const player = { name: 'Player', money: 10_000, contribution: 0 }
  const picked = pick(player, ['money', 'contribution'] as const)

  assert.deepStrictEqual(Object.keys(picked), ['money', 'contribution'])
  assert.strictEqual(picked.money, 10_000)

  player.money = 9_950

  assert.strictEqual(picked.money, 9_950)
})

test('omit exposes remaining entries as live getters', () => {
  const player = { name: 'Player', money: 10_000, contribution: 0 }
  const omitted = omit(player, ['name'] as const)

  assert.deepStrictEqual(Object.keys(omitted), ['money', 'contribution'])
  assert.strictEqual(omitted.money, 10_000)

  player.money = 9_950

  assert.strictEqual(omitted.money, 9_950)
})

test('merge exposes merged entries as live getters with later values winning', () => {
  const player = { name: 'Player', money: 10_000 }
  const extra = { money: 9_000, contribution: 100 }
  const merged = merge(player, extra)

  assert.deepStrictEqual(Object.keys(merged), ['name', 'money', 'contribution'])
  assert.strictEqual(merged.name, 'Player')
  assert.strictEqual(merged.money, 9_000)
  assert.strictEqual(merged.contribution, 100)

  player.name = 'Updated'
  player.money = 8_000
  extra.money = 7_500
  extra.contribution = 150

  assert.strictEqual(merged.name, 'Updated')
  assert.strictEqual(merged.money, 7_500)
  assert.strictEqual(merged.contribution, 150)
})
