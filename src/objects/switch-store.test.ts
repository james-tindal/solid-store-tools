import { assert, test } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { switchStore } from './switch-store'
import { createMutable, createStore } from 'solid-js/store'
import { merge } from './merge'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
const assertType = <T extends true>() => {}

test('switchStore narrows branch data by key', () => createRoot(dispose => {
  const store = switchStore(
    () => Math.random() > 0.5
      ? 'empty' as const
      : ['selected', { value: 100 }] satisfies readonly ['selected', { value: number }],
    {
      empty: { view: 'empty' as const },
      selected: data => {
        assertType<Equal<typeof data, { value: number }>>()
        return { view: 'selected' as const, value: data.value }
      },
    },
  )

  assertType<Equal<typeof store, { view: 'empty' } | { view: 'selected', value: number }>>()
  dispose()
}))

test('switchStore preserves tuple types', () => createRoot(dispose => {
  const store = switchStore(
    () => 'selected' as const,
    {
      selected: () => ({
        pair: [1, 2] as [number, number],
        nested: {
          triple: [1, 2, 3] as [number, number, number],
        },
      }),
    },
  )

  assertType<Equal<typeof store.pair, [number, number]>>()
  assertType<Equal<typeof store.nested.triple, [number, number, number]>>()
  dispose()
}))

test('passing a store object through switchStore preserves reactivity', () => createRoot(dispose => {
  const source = createMutable({ state: 'a' })
  const [store] = createStore(source)

  const result = switchStore(
    () => 'selected' as const,
    {
      selected: () => ({ nestedStore: store }),
    },
  )

  assert.strictEqual(result.nestedStore.state, 'a')
  source.state = 'b'
  assert.strictEqual(result.nestedStore.state, 'b')
  dispose()
}))

test('switchStore passes branch data through by reference instead of reconciling it', () => createRoot(dispose => {
  const [selected, setSelected] = createSignal(false)
  const data = { nested: { count: 1 } }

  const state = switchStore(
    () => selected() ? 'selected' as const : 'empty' as const,
    {
      empty: { view: 'empty' as const },
      selected: { view: 'selected' as const, data },
    },
  )

  setSelected(true)

  assert.strictEqual(state.view, 'selected')
  assert.strictEqual((state as any).data, data)
  assert.strictEqual((state as any).data.nested, data.nested)
  dispose()
}))

test('switchStore passes merged proxy data containing Solid stores without unwrapping it', () => createRoot(dispose => {
  const [selected, setSelected] = createSignal(false)
  const source = createMutable({ value: 'initial' })
  const [nestedStore] = createStore(source)
  const data = merge({ nestedStore })

  const state = switchStore(
    () => selected() ? 'selected' as const : 'empty' as const,
    {
      empty: { view: 'empty' as const },
      selected: { view: 'selected' as const, data },
    },
  )

  setSelected(true)

  assert.strictEqual(state.view, 'selected')
  assert.strictEqual((state as any).data, data)
  assert.strictEqual((state as any).data.nestedStore.value, 'initial')

  source.value = 'updated'

  assert.strictEqual((state as any).data.nestedStore.value, 'updated')
  dispose()
}))

test('switchStore proxies remain compatible with Solid store wrapping', () => createRoot(dispose => {
  const source = createMutable({ value: 'initial' })
  const [nestedStore] = createStore(source)
  const proxy = switchStore(
    () => 'selected' as const,
    {
      selected: { nestedStore },
    },
  )
  const [store, setStore] = createStore({} as { data?: typeof proxy })

  setStore({ data: proxy })

  assert.strictEqual(store.data?.nestedStore.value, 'initial')

  source.value = 'updated'

  assert.strictEqual(store.data?.nestedStore.value, 'updated')
  dispose()
}))

test('branch data functions can update the reactive source used by the picker', () => createRoot(dispose => {
  const toggle = createMutable({
    enabled: false,
    enable() {
      toggle.enabled = true
    },
  })

  const state = switchStore(
    () => toggle.enabled ? 'enabled' as const : 'disabled' as const,
    {
      disabled: {
        view: 'disabled' as const,
        data: toggle,
      },
      enabled: {
        view: 'enabled' as const,
        data: { value: 100 },
      },
    },
  )

  assert.strictEqual(state.view, 'disabled')

  if (state.view !== 'disabled')
    throw Error('Expected disabled branch')

  state.data.enable()

  assert.strictEqual(toggle.enabled, true)
  assert.strictEqual(state.view, 'enabled')
  dispose()
}))

test('switchStore selects a branch by key and passes its data', () => createRoot(dispose => {
  const store = switchStore(
    () => ['selected', { value: 100 }] satisfies readonly ['selected', { value: number }],
    {
      selected: data => ({
        view: 'selected' as const,
        value: data.value,
      }),
    },
  )

  assert.strictEqual(store.view, 'selected')
  assert.strictEqual(store.value, 100)
  dispose()
}))

test('switchStore switches branch when key changes', () => createRoot(dispose => {
  const [selected, setSelected] = createSignal(false)
  const store = switchStore(
    () => selected()
      ? ['selected', { value: 100 }] satisfies readonly ['selected', { value: number }]
      : 'empty' as const,
    {
      empty: { view: 'empty' as const },
      selected: data => ({ view: 'selected' as const, value: data.value }),
    },
  )

  assert.strictEqual(store.view, 'empty')

  setSelected(true)

  assert.strictEqual(store.view, 'selected')
  assert.strictEqual('value' in store ? store.value : undefined, 100)
  dispose()
}))

test('plain branch body dependencies are snapshots', () => createRoot(dispose => {
  const [value, setValue] = createSignal(10_000)
  let picks = 0
  let branchRuns = 0

  const store = switchStore(
    () => {
      picks++
      return 'selected' as const
    },
    {
      selected: () => {
        branchRuns++
        return { value: value() }
      },
    },
  )

  assert.strictEqual(store.value, 10_000)
  assert.strictEqual(picks, 1)
  assert.strictEqual(branchRuns, 1)

  setValue(9_950)

  assert.strictEqual(store.value, 10_000)
  assert.strictEqual(picks, 1)
  assert.strictEqual(branchRuns, 1)
  dispose()
}))
