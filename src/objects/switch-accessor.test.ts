import { createComputed, createSignal, onCleanup } from 'solid-js'
import { afterEach, assert, test } from 'vitest'
import { switchAccessor } from './switch-store'
import { createMutable, createStore } from 'solid-js/store'
import { merge } from './merge'
import { testRoot } from '../solid-root'

afterEach(() => testRoot.dispose())

/* eslint-disable @typescript-eslint/no-unused-vars */

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
const assertType = <T extends true>() => {}

test('switchAccessor narrows branch data by key', () => testRoot(() => {
  const current = switchAccessor(
    () => Math.random() > 0.5
      ? 'empty' as const
      : ['selected', { value: 100 }] satisfies ['selected', { value: number }],
    {
      empty: { view: 'empty' as const },
      selected: data => {
        assertType<Equal<typeof data, { value: number }>>()
        return { view: 'selected' as const, value: data.value }
      },
    },
  )

  assertType<Equal<ReturnType<typeof current>, { view: 'empty' } | { view: 'selected', value: number }>>()
}))

test('switchAccessor preserves tuple types', () => testRoot(() => {
  const current = switchAccessor(
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

  assertType<Equal<ReturnType<typeof current>['pair'], [number, number]>>()
  assertType<Equal<ReturnType<typeof current>['nested']['triple'], [number, number, number]>>()
}))

test('switchAccessor selects a branch by key and passes its data', () => testRoot(() => {
  const current = switchAccessor(
    () => ['selected', { value: 100 }] satisfies ['selected', { value: number }],
    {
      selected: data => ({
        view: 'selected' as const,
        value: data.value,
      }),
    },
  )

  assert.strictEqual(current().view, 'selected')
  assert.strictEqual(current().value, 100)
}))

test('switchAccessor switches branch when key changes', () => testRoot(() => {
  const [selected, setSelected] = createSignal(false)
  const current = switchAccessor(
    () => selected()
      ? ['selected', { value: 100 }] satisfies ['selected', { value: number }]
      : 'empty' as const,
    {
      empty: { view: 'empty' as const },
      selected: data => ({ view: 'selected' as const, value: data.value }),
    },
  )

  assert.strictEqual(current().view, 'empty')

  setSelected(true)

  assert.strictEqual(current().view, 'selected')
  assert.strictEqual('value' in current() ? (current() as any).value : undefined, 100)
}))

test('switchAccessor passes branch data through by reference instead of reconciling it', () => testRoot(() => {
  const [selected, setSelected] = createSignal(false)
  const data = { nested: { count: 1 }}

  const current = switchAccessor(
    () => selected() ? 'selected' as const : 'empty' as const,
    {
      empty: { view: 'empty' as const },
      selected: { view: 'selected' as const, data },
    },
  )

  setSelected(true)

  assert.strictEqual(current().view, 'selected')
  assert.strictEqual((current() as any).data, data)
  assert.strictEqual((current() as any).data.nested, data.nested)
}))

test('switchAccessor passes merged proxy data containing Solid stores without unwrapping it', () => testRoot(() => {
  const [selected, setSelected] = createSignal(false)
  const source = createMutable({ value: 'initial' })
  const [nestedStore] = createStore(source)
  const data = merge({ nestedStore })

  const current = switchAccessor(
    () => selected() ? 'selected' as const : 'empty' as const,
    {
      empty: { view: 'empty' as const },
      selected: { view: 'selected' as const, data },
    },
  )

  setSelected(true)

  assert.strictEqual(current().view, 'selected')
  assert.strictEqual((current() as any).data, data)
  assert.strictEqual((current() as any).data.nestedStore.value, 'initial')

  source.value = 'updated'

  assert.strictEqual((current() as any).data.nestedStore.value, 'updated')
}))

test('branch data functions can update the reactive source used by the picker', () => testRoot(() => {
  const toggle = createMutable({
    enabled: false,
    enable() {
      toggle.enabled = true
    },
  })

  const current = switchAccessor(
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

  assert.strictEqual(current().view, 'disabled')

  if (current().view !== 'disabled')
    throw Error('Expected disabled branch')

  ;(current().data as any).enable()

  assert.strictEqual(toggle.enabled, true)
  assert.strictEqual(current().view, 'enabled')
}))

test('plain branch body dependencies are snapshots', () => testRoot(() => {
  const [value, setValue] = createSignal(10_000)
  let picks = 0
  let branchRuns = 0

  const current = switchAccessor(
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

  assert.strictEqual(current().value, 10_000)
  assert.strictEqual(picks, 1)
  assert.strictEqual(branchRuns, 1)

  setValue(9_950)

  assert.strictEqual(current().value, 10_000)
  assert.strictEqual(picks, 1)
  assert.strictEqual(branchRuns, 1)
}))

test('switchAccessor eagerly disposes the previous branch when selection changes without another read', () => testRoot(() => {
  const [selection, setSelection] = createSignal<'a' | 'b'>('a')
  let aCleanups = 0
  let bRuns = 0

  switchAccessor(selection, {
    a: () => {
      onCleanup(() => aCleanups++)
      return { value: 'a' }
    },
    b: () => {
      bRuns++
      return { value: 'b' }
    },
  })

  assert.strictEqual(aCleanups, 0)
  assert.strictEqual(bRuns, 0)

  setSelection('b')

  assert.strictEqual(aCleanups, 1)
  assert.strictEqual(bRuns, 1)
}))

test('switchAccessor eagerly creates the selected branch before it is read', () => testRoot(() => {
  const [selection, setSelection] = createSignal<'a' | 'b'>('a')
  let bRuns = 0

  switchAccessor(selection, {
    a: () => ({ value: 'a' }),
    b: () => {
      bRuns++
      return { value: 'b' }
    },
  })

  assert.strictEqual(bRuns, 0)

  setSelection('b')

  assert.strictEqual(bRuns, 1)
}))

test('switchAccessor does not recreate the branch when only selection data changes', () => testRoot(() => {
  const [value, setValue] = createSignal(1)
  let runs = 0

  const current = switchAccessor(
    () => ['selected', value()] as const,
    {
      selected: data => {
        runs++
        return { value: data }
      },
    },
  )

  assert.strictEqual(runs, 1)
  assert.strictEqual(current().value, 1)

  setValue(2)

  assert.strictEqual(runs, 1)
  assert.strictEqual(current().value, 1)
}))

test('switchAccessor disposes the active branch when the parent root is disposed', () => {
  let cleanups = 0

  testRoot(() => {
    switchAccessor(
      () => 'selected' as const,
      {
        selected: () => {
          onCleanup(() => cleanups++)
          return { value: 'selected' }
        },
      },
    )
  })

  assert.strictEqual(cleanups, 0)

  testRoot.dispose()

  assert.strictEqual(cleanups, 1)
}
)

test('switchAccessor returns an accessor to the current branch', () => testRoot(() => {
  const [selection, setSelection] = createSignal<'a' | 'b'>('a')
  const current = switchAccessor(selection, {
    a: { value: 'a' },
    b: { value: 'b' },
  })

  assert.strictEqual(current().value, 'a')

  setSelection('b')

  assert.strictEqual(current().value, 'b')
}))

test('switchAccessor returns a reactive accessor', () => testRoot(() => {
  const [selection, setSelection] = createSignal<'a' | 'b'>('a')
  const values: string[] = []
  const current = switchAccessor(selection, {
    a: { value: 'a' },
    b: { value: 'b' },
  })

  createComputed(() => {
    values.push(current().value)
  })

  assert.deepStrictEqual(values, ['a'])

  setSelection('b')

  assert.deepStrictEqual(values, ['a', 'b'])
}))
