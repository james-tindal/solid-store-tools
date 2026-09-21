import { createSignal } from 'solid-js'
import { testRoot } from '../solid-root'
import { assert, test } from 'vitest'
import { switchStore } from './switch-store'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
const assertType = <_T extends true>() => {}

test('switchStore exposes the current branch through an object proxy', () => testRoot(dispose => {
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

  assertType<Equal<typeof store, { view: 'empty' } | { view: 'selected', value: number }>>()
  assert.strictEqual(store.view, 'empty')

  setSelected(true)

  assert.strictEqual(store.view, 'selected')
  assert.strictEqual('value' in store ? store.value : undefined, 100)
  dispose()
}))

test('switchStore uses objectFromAccessor view semantics', () => testRoot(dispose => {
  const [selected, setSelected] = createSignal(false)
  const selectedData = { nested: { count: 1 }}
  const store = switchStore(
    () => selected() ? 'selected' as const : 'empty' as const,
    {
      empty: { view: 'empty' as const },
      selected: { view: 'selected' as const, data: selectedData },
    },
  )

  assert.deepStrictEqual(Reflect.ownKeys(store), ['view'])

  setSelected(true)

  assert.strictEqual(store.view, 'selected')
  assert.strictEqual((store as any).data, selectedData)
  assert.strictEqual((store as any).data.nested, selectedData.nested)
  assert.deepStrictEqual(Reflect.ownKeys(store), ['view', 'data'])
  dispose()
}))
