import { createComputed } from 'solid-js'
import { createStore } from 'solid-js/store'
import { afterEach, assert, test } from 'vitest'
import { testRoot } from '../solid-root'
import { pick } from './pick'
import { storeFromAccessor } from './store-from-accessor'

afterEach(() => testRoot.dispose())

test('storeFromAccessor updates projected values when the source changes', () => {
  testRoot(() => {
    const [source, setSource] = createStore({ items: [{ value: 'before' }] })
    const derived = storeFromAccessor(() =>
      source.items.map(item => pick(item, ['value'])))
    let observed: string | undefined

    createComputed(() => {
      observed = derived[0]!.value
    })

    assert.strictEqual(observed, 'before')

    setSource('items', 0, 'value', 'after')

    assert.strictEqual(observed, 'after')
  })
})
