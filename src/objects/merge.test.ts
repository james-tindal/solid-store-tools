import { assert, test } from 'vitest'
import { createComputed, createRoot, createSignal } from 'solid-js'
import { merge } from './merge'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <T extends true>() => {}

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

test('merge tracks source dependencies from the read site', () => createRoot(dispose => {
  const [money, setMoney] = createSignal(10_000)
  const source = {
    get money() { return money() },
  }
  const merged = merge(source)
  const seen: number[] = []

  createComputed(() => {
    seen.push(merged.money)
  })

  assert.deepStrictEqual(seen, [10_000])

  setMoney(9_950)

  assert.deepStrictEqual(seen, [10_000, 9_950])
  dispose()
}))

test('merge exposes own values, getters, and methods', () => {
  const source = {
    money: 10_000,

    get status() {
      if (this.money === 0)
        return 'all-in'
    },

    contribute(amount: number) {
      this.money -= amount
    },
  }

  const merged = merge(source)
  const contribute = merged.contribute

  assert.deepStrictEqual(Object.keys(merged), ['money', 'status', 'contribute'])
  assert.strictEqual(merged.money, 10_000)
  assert.isUndefined(merged.status)

  contribute(10_000)

  assert.strictEqual(merged.money, 0)
  assert.strictEqual(merged.status, 'all-in')
})

test('merge exposes prototype getters as live getters', () => {
  const player = { money: 100, contribution: 0 }

  class PlayerView {
    get status() {
      if (player.money === 0 && player.contribution === 0)
        return 'out-of-match'
      if (player.money === 0)
        return 'all-in'
    }
  }

  const merged = merge(new PlayerView)

  assert.deepStrictEqual(Object.keys(merged), ['status'])
  assert.isUndefined(merged.status)

  player.money = 0
  player.contribution = 100

  assert.strictEqual(merged.status, 'all-in')
})

test('merge exposes prototype methods bound to the source object', () => {
  const player = { money: 10_000, contribution: 0 }

  class PlayerActions {
    contribute(amount: number) {
      player.money -= amount
      player.contribution += amount
    }
  }

  const merged = merge(new PlayerActions)
  const contribute = merged.contribute

  assert.deepStrictEqual(Object.keys(merged), ['contribute'])

  contribute(100)

  assert.strictEqual(player.money, 9_900)
  assert.strictEqual(player.contribution, 100)
})

test('merge lets later prototype entries override earlier object entries', () => {
  class Override {
    get money() { return 7_500 }
  }

  const merged = merge({ money: 10_000 }, new Override)

  assert.deepStrictEqual(Object.keys(merged), ['money'])
  assert.strictEqual(merged.money, 7_500)
})

test('merge reflects keys added to and deleted from sources after creation', () => {
  const source = { money: 10_000 } as { money: number, status?: string }
  const merged = merge(source)

  assert.deepStrictEqual(Object.keys(merged), ['money'])
  assert.isFalse('status' in merged)

  source.status = 'all-in'

  assert.deepStrictEqual(Object.keys(merged), ['money', 'status'])
  assert.isTrue('status' in merged)
  assert.strictEqual(merged.status, 'all-in')

  delete source.status

  assert.deepStrictEqual(Object.keys(merged), ['money'])
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
  class PlayerActions {
    #money = 10_000

    contribute(amount: number) {
      this.#money -= amount
    }

    get money() {
      return this.#money
    }
  }

  const merged = merge(new PlayerActions)
  const contribute = merged.contribute

  assert.strictEqual(merged.money, 10_000)

  contribute(100)

  assert.strictEqual(merged.money, 9_900)
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
