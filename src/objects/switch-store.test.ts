import { assert, test } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { switchStore } from './switch-store'
import { createMutable, createStore } from 'solid-js/store'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
const assertType = <T extends true>() => {}

test('switchStore narrows branch data by key', () => {
  const store = switchStore(
    () => Math.random() > 0.5
      ? 'loading' as const
      : ['game', { pot: 100 }] satisfies readonly ['game', { pot: number }],
    {
      loading: { view: 'loading' as const },
      game: data => {
        assertType<Equal<typeof data, { pot: number }>>()
        return { view: 'game' as const, pot: data.pot }
      },
    },
  )

  assertType<Equal<typeof store, { view: 'loading' } | { view: 'game', pot: number }>>()
})

test('switchStore preserves tuple types', () => {
  const store = switchStore(
    () => 'game' as const,
    {
      game: () => ({
        pair: [1, 2] as [number, number],
        nested: {
          triple: [1, 2, 3] as [number, number, number],
        },
      }),
    },
  )

  assertType<Equal<typeof store.pair, [number, number]>>()
  assertType<Equal<typeof store.nested.triple, [number, number, number]>>()
})

test('passing a store object through switchStore preserves reactivity', () => createRoot(dispose => {
  const source = createMutable({ state: 'a' })
  const [store] = createStore(source)

  const result = switchStore(
    () => 'game' as const,
    {
      game: () => ({ anim: store }),
    },
  )

  assert.strictEqual(result.anim.state, 'a')
  source.state = 'b'
  assert.strictEqual(result.anim.state, 'b')
  dispose()
}))

test('branch data functions can update the reactive source used by the picker', () => createRoot(dispose => {
  const betaDialog = createMutable({
    dismissed: false,
    dismiss() {
      betaDialog.dismissed = true
    },
  })

  const state = switchStore(
    () => betaDialog.dismissed ? 'game' as const : 'beta-dialog' as const,
    {
      'beta-dialog': {
        view: 'beta-dialog' as const,
        data: betaDialog,
      },
      game: {
        view: 'game' as const,
        data: { pot: 100 },
      },
    },
  )

  assert.strictEqual(state.view, 'beta-dialog')

  if (state.view !== 'beta-dialog')
    throw Error('Expected beta dialog branch')

  state.data.dismiss()

  assert.strictEqual(betaDialog.dismissed, true)
  assert.strictEqual(state.view, 'game')
  dispose()
}))

test('switchStore selects a branch by key and passes its data', () => createRoot(dispose => {
  const store = switchStore(
    () => ['game', { pot: 100 }] satisfies readonly ['game', { pot: number }],
    {
      game: data => ({
        view: 'game' as const,
        pot: data.pot,
      }),
    },
  )

  assert.strictEqual(store.view, 'game')
  assert.strictEqual(store.pot, 100)
  dispose()
}))

test('switchStore switches branch when key changes', () => createRoot(dispose => {
  const [game, setGame] = createSignal(false)
  const store = switchStore(
    () => game()
      ? ['game', { pot: 100 }] satisfies readonly ['game', { pot: number }]
      : 'loading' as const,
    {
      loading: { view: 'loading' as const },
      game: data => ({ view: 'game' as const, pot: data.pot }),
    },
  )

  assert.strictEqual(store.view, 'loading')

  setGame(true)

  assert.strictEqual(store.view, 'game')
  assert.strictEqual('pot' in store ? store.pot : undefined, 100)
  dispose()
}))

test('plain branch body dependencies are snapshots', () => createRoot(dispose => {
  const [money, setMoney] = createSignal(10_000)
  let picks = 0
  let branchRuns = 0

  const store = switchStore(
    () => {
      picks++
      return 'game' as const
    },
    {
      game: () => {
        branchRuns++
        return { money: money() }
      },
    },
  )

  assert.strictEqual(store.money, 10_000)
  assert.strictEqual(picks, 1)
  assert.strictEqual(branchRuns, 1)

  setMoney(9_950)

  assert.strictEqual(store.money, 10_000)
  assert.strictEqual(picks, 1)
  assert.strictEqual(branchRuns, 1)
  dispose()
}))
