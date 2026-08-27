import { createComputed, createSignal } from 'solid-js'
import { testRoot } from '../solid-root'
import { createMutable } from 'solid-js/store'
import { assert, describe, test } from 'vitest'
import { merge } from './merge'
import { objectFromAccessor } from './object-from-accessor'
import { omit } from './omit'
import { pick } from './pick'
import { switchStore } from './switch-store'
import { dedupeStore } from './dedupe-store'


const visibleKeys = (object: object) =>
  Reflect.ownKeys(object).filter(key => typeof key === 'string')

function track<T>(read: () => T) {
  const state = {
    runs: 0,
    value: undefined as T | undefined,
  }

  createComputed(() => {
    state.runs++
    state.value = read()
  })

  return state
}

describe('dedupeStore proxy integration', () => {
  test('dedupes pick ownKeys subscriptions to selected entries', () => testRoot(() => {
    const source = createMutable({
      name: 'Ada' as string | undefined,
      hidden: 'secret' as string | undefined,
    })
    const store = dedupeStore(pick(source, ['name']))
    let runs = 0
    let keys: PropertyKey[] = []

    createComputed(() => {
      runs++
      keys = visibleKeys(store)
    })

    assert.deepStrictEqual(keys, ['name'])
    assert.strictEqual(runs, 1)

    source.hidden = 'classified'
    delete source.hidden

    assert.deepStrictEqual(keys, ['name'])
    assert.strictEqual(runs, 1)

    source.name = 'Grace'

    assert.deepStrictEqual(keys, ['name'])
    assert.strictEqual(runs, 2)

    delete source.name

    assert.deepStrictEqual(keys, [])
    assert.strictEqual(runs, 3)
  }))

  test('dedupes omit ownKeys subscriptions to remaining entries', () => testRoot(() => {
    const source = createMutable({
      name: 'Ada' as string | undefined,
      hidden: 'secret' as string | undefined,
    })
    const store = dedupeStore(omit(source, ['hidden']))
    let runs = 0
    let keys: PropertyKey[] = []

    createComputed(() => {
      runs++
      keys = visibleKeys(store)
    })

    assert.deepStrictEqual(keys, ['name'])
    assert.strictEqual(runs, 1)

    source.hidden = 'classified'
    delete source.hidden

    assert.deepStrictEqual(keys, ['name'])
    assert.strictEqual(runs, 1)

    source.name = 'Grace'

    assert.deepStrictEqual(keys, ['name'])
    assert.strictEqual(runs, 2)

    delete source.name

    assert.deepStrictEqual(keys, [])
    assert.strictEqual(runs, 3)
  }))

  test('dedupes merge ownKeys subscriptions to the winning merged surface', () => testRoot(() => {
    const base = createMutable({
      hidden: 'base' as string | undefined,
      value: 'base' as string | undefined,
    })
    const override = createMutable({
      value: 'override' as string | undefined,
    })
    const store = dedupeStore(merge(base, override))
    let runs = 0
    let keys: PropertyKey[] = []

    createComputed(() => {
      runs++
      keys = visibleKeys(store)
    })

    assert.deepStrictEqual(keys, ['hidden', 'value'])
    assert.strictEqual(runs, 1)

    delete base.value

    assert.deepStrictEqual(keys, ['hidden', 'value'])
    assert.strictEqual(runs, 1)

    override.value = 'next'

    assert.deepStrictEqual(keys, ['hidden', 'value'])
    assert.strictEqual(runs, 2)

    delete override.value

    assert.deepStrictEqual(keys, ['hidden'])
    assert.strictEqual(runs, 3)
  }))

  test('dedupes objectFromAccessor ownKeys subscriptions to the current accessed store', () => testRoot(() => {
    const storeSource = createMutable({
      name: 'Ada' as string | undefined,
      active: true as boolean | undefined,
    })
    const store = dedupeStore(objectFromAccessor(() => storeSource))
    let runs = 0
    let keys: PropertyKey[] = []

    createComputed(() => {
      runs++
      keys = visibleKeys(store)
    })

    assert.deepStrictEqual(keys, ['name', 'active'])
    assert.strictEqual(runs, 1)

    storeSource.name = 'Grace'

    assert.deepStrictEqual(keys, ['name', 'active'])
    assert.strictEqual(runs, 2)

    delete storeSource.active

    assert.deepStrictEqual(keys, ['name'])
    assert.strictEqual(runs, 3)
  }))

  test('dedupes switchStore ownKeys subscriptions to the selected branch surface', () => testRoot(() => {
    const selection = createMutable({
      selected: false,
    })
    const store = dedupeStore(switchStore(
      () => selection.selected ? 'selected' as const : 'empty' as const,
      {
        empty: { view: 'empty' as const },
        selected: { view: 'selected' as const, value: 100 },
      },
    ))
    let runs = 0
    let keys: PropertyKey[] = []

    createComputed(() => {
      runs++
      keys = visibleKeys(store)
    })

    assert.deepStrictEqual(keys, ['view'])
    assert.strictEqual(runs, 1)

    selection.selected = true

    assert.deepStrictEqual(keys, ['view', 'value'])
    assert.strictEqual(runs, 2)
  }))

  test('tracks only the queried key for in subscribers', () => testRoot(() => {
    const source = createMutable({
      name: 'Ada' as string | undefined,
      active: true as boolean | undefined,
      hidden: 'secret' as string | undefined,
    })
    const store = dedupeStore(pick(source, ['name', 'active']))
    let runs = 0
    let hasName = false

    createComputed(() => {
      runs++
      hasName = 'name' in store
    })

    assert.isTrue(hasName)
    assert.strictEqual(runs, 1)

    source.active = false
    delete source.active
    source.hidden = 'classified'
    delete source.hidden

    assert.isTrue(hasName)
    assert.strictEqual(runs, 1)

    delete source.name

    assert.isFalse(hasName)
    assert.strictEqual(runs, 2)
  }))

  test('dedupes pick subscriptions across reads, in checks, and ownKeys', () => testRoot(() => {
    const source = createMutable({
      name: 'Ada' as string | undefined,
      hidden: 'secret' as string | undefined,
      other: true as boolean | undefined,
      missing: undefined as string | undefined,
    })
    delete source.missing

    const store = dedupeStore(pick(source, ['name', 'missing']))
    const name = track(() => store.name)
    const hasName = track(() => 'name' in store)
    const hasMissing = track(() => 'missing' in store)
    const keys = track(() => visibleKeys(store))

    assert.strictEqual(name.value, 'Ada')
    assert.strictEqual(hasName.value, true)
    assert.strictEqual(hasMissing.value, false)
    assert.deepStrictEqual(keys.value, ['name'])

    source.hidden = 'classified'
    delete source.hidden
    source.other = false
    delete source.other

    assert.strictEqual(name.runs, 1)
    assert.strictEqual(hasName.runs, 1)
    assert.strictEqual(hasMissing.runs, 1)
    assert.strictEqual(keys.runs, 1)

    source.name = 'Grace'

    assert.strictEqual(name.value, 'Grace')
    assert.strictEqual(name.runs, 2)
    assert.strictEqual(hasName.runs, 1)
    assert.strictEqual(keys.runs, 2)

    source.missing = 'present'

    assert.strictEqual(hasMissing.value, true)
    assert.deepStrictEqual(keys.value, ['name', 'missing'])
    assert.strictEqual(hasMissing.runs, 2)
    assert.strictEqual(keys.runs, 3)

    delete source.name

    assert.strictEqual(name.value, undefined)
    assert.strictEqual(hasName.value, false)
    assert.deepStrictEqual(keys.value, ['missing'])
    assert.strictEqual(name.runs, 3)
    assert.strictEqual(hasName.runs, 2)
    assert.strictEqual(keys.runs, 4)
  }))

  test('dedupes omit subscriptions across reads, in checks, and ownKeys', () => testRoot(() => {
    const source = createMutable({
      name: 'Ada' as string | undefined,
      hidden: 'secret' as string | undefined,
      other: true as boolean | undefined,
    })
    const store = dedupeStore(omit(source, ['hidden']))
    const name = track(() => store.name)
    const hasName = track(() => 'name' in store)
    const keys = track(() => visibleKeys(store))

    assert.strictEqual(name.value, 'Ada')
    assert.strictEqual(hasName.value, true)
    assert.deepStrictEqual(keys.value, ['name', 'other'])

    source.hidden = 'classified'
    delete source.hidden

    assert.strictEqual(name.runs, 1)
    assert.strictEqual(hasName.runs, 1)
    assert.strictEqual(keys.runs, 1)

    source.other = false

    assert.deepStrictEqual(keys.value, ['name', 'other'])
    assert.strictEqual(name.runs, 1)
    assert.strictEqual(hasName.runs, 1)
    assert.strictEqual(keys.runs, 2)

    delete source.name

    assert.strictEqual(name.value, undefined)
    assert.strictEqual(hasName.value, false)
    assert.deepStrictEqual(keys.value, ['other'])
    assert.strictEqual(name.runs, 2)
    assert.strictEqual(hasName.runs, 2)
    assert.strictEqual(keys.runs, 3)
  }))

  test('dedupes merge subscriptions for shadowed, winning, and fallback entries', () => testRoot(() => {
    const base = createMutable({
      value: 'base' as string | undefined,
      baseOnly: 'base only' as string | undefined,
      hidden: 'base hidden' as string | undefined,
    })
    const override = createMutable({
      value: 'override' as string | undefined,
    })
    const store = dedupeStore(merge(base, override))
    const value = track(() => store.value)
    const hasValue = track(() => 'value' in store)
    const keys = track(() => visibleKeys(store))

    assert.strictEqual(value.value, 'override')
    assert.strictEqual(hasValue.value, true)
    assert.deepStrictEqual(keys.value, ['value', 'baseOnly', 'hidden'])

    base.value = 'shadow changed'
    delete base.hidden

    assert.strictEqual(value.value, 'override')
    assert.strictEqual(value.runs, 1)
    assert.strictEqual(hasValue.runs, 1)
    assert.strictEqual(keys.runs, 2)
    assert.deepStrictEqual(keys.value, ['value', 'baseOnly'])

    override.value = 'next'

    assert.strictEqual(value.value, 'next')
    assert.strictEqual(hasValue.value, true)
    assert.strictEqual(value.runs, 2)
    assert.strictEqual(hasValue.runs, 1)
    assert.strictEqual(keys.runs, 3)

    delete override.value

    assert.strictEqual(value.value, 'shadow changed')
    assert.strictEqual(hasValue.value, true)
    assert.deepStrictEqual(keys.value, ['value', 'baseOnly'])
    assert.strictEqual(value.runs, 3)
    assert.strictEqual(hasValue.runs, 1)
    assert.strictEqual(keys.runs, 4)
  }))

  test('dedupes accessor source replacement for picked views', () => testRoot(() => {
    const first = createMutable({
      name: 'Ada' as string | undefined,
      hidden: 'first hidden' as string | undefined,
    })
    const second = createMutable({
      name: 'Grace' as string | undefined,
      hidden: 'second hidden' as string | undefined,
    })
    const [source, setSource] = createSignal(first)
    const store = dedupeStore(pick(objectFromAccessor(source), ['name']))
    const name = track(() => store.name)
    const hasName = track(() => 'name' in store)
    const keys = track(() => visibleKeys(store))

    assert.strictEqual(name.value, 'Ada')
    assert.strictEqual(hasName.value, true)
    assert.deepStrictEqual(keys.value, ['name'])

    first.hidden = 'changed'

    assert.strictEqual(name.runs, 1)
    assert.strictEqual(hasName.runs, 1)
    assert.strictEqual(keys.runs, 1)

    setSource(second)

    assert.strictEqual(name.value, 'Grace')
    assert.strictEqual(hasName.value, true)
    assert.deepStrictEqual(keys.value, ['name'])
    assert.strictEqual(name.runs, 2)
    assert.strictEqual(hasName.runs, 1)
    assert.strictEqual(keys.runs, 2)

    first.name = 'ignored'

    assert.strictEqual(name.value, 'Grace')
    assert.strictEqual(name.runs, 2)
    assert.strictEqual(keys.runs, 2)

    delete second.name

    assert.strictEqual(name.value, undefined)
    assert.strictEqual(hasName.value, false)
    assert.deepStrictEqual(keys.value, [])
    assert.strictEqual(name.runs, 3)
    assert.strictEqual(hasName.runs, 2)
    assert.strictEqual(keys.runs, 3)
  }))

  test('dedupes replacement of exposed objects inside a store', () => testRoot(() => {
    const source = createMutable({
      user: { name: 'Ada' } as { name: string, active?: boolean },
      hiddenUser: { name: 'Hidden' },
    })
    const store = dedupeStore(pick(source, ['user']))
    const user = track(() => store.user)
    const userName = track(() => store.user.name)
    const keys = track(() => visibleKeys(store))
    const userKeys = track(() => visibleKeys(store.user))

    assert.strictEqual(userName.value, 'Ada')
    assert.deepStrictEqual(keys.value, ['user'])
    assert.deepStrictEqual(userKeys.value, ['name'])

    source.hiddenUser = { name: 'Still hidden' }

    assert.strictEqual(user.runs, 1)
    assert.strictEqual(userName.runs, 1)
    assert.strictEqual(keys.runs, 1)
    assert.strictEqual(userKeys.runs, 1)

    source.user = { name: 'Grace', active: true }

    assert.strictEqual(userName.value, 'Grace')
    assert.deepStrictEqual(userKeys.value, ['name', 'active'])
    assert.strictEqual(user.runs, 1)
    assert.strictEqual(userName.runs, 2)
    assert.strictEqual(keys.runs, 1)
    assert.strictEqual(userKeys.runs, 2)
  }))

  test('dedupes objectFromAccessor source replacement and hidden object changes', () => testRoot(() => {
    const first = createMutable({
      name: 'Ada' as string | undefined,
      hidden: 'first hidden' as string | undefined,
    })
    const second = createMutable({
      name: 'Grace' as string | undefined,
      active: true as boolean | undefined,
    })
    const [source, setSource] = createSignal<typeof first | typeof second>(first)
    const store = dedupeStore(objectFromAccessor(source))
    const name = track(() => store.name)
    const keys = track(() => visibleKeys(store))

    assert.strictEqual(name.value, 'Ada')
    assert.deepStrictEqual(keys.value, ['name', 'hidden'])

    first.hidden = 'changed'

    assert.strictEqual(name.runs, 1)
    assert.strictEqual(keys.runs, 2)

    setSource(second)

    assert.strictEqual(name.value, 'Grace')
    assert.deepStrictEqual(keys.value, ['name', 'active'])
    assert.strictEqual(name.runs, 2)
    assert.strictEqual(keys.runs, 3)

    first.name = 'ignored'

    assert.strictEqual(name.value, 'Grace')
    assert.strictEqual(name.runs, 2)
    assert.strictEqual(keys.runs, 3)
  }))

  test('dedupes switchStore path, in, and ownKeys subscriptions across branches', () => testRoot(() => {
    const [selected, setSelected] = createSignal(false)
    const branch = createMutable({
      value: 100 as number | undefined,
      other: true as boolean | undefined,
    })
    const store = dedupeStore(switchStore(
      () => selected() ? 'selected' as const : 'empty' as const,
      {
        empty: { view: 'empty' as const },
        selected: branch,
      },
    ))
    const value = track(() => (store as any).value)
    const hasValue = track(() => 'value' in store)
    const keys = track(() => visibleKeys(store))

    assert.strictEqual(value.value, undefined)
    assert.strictEqual(hasValue.value, false)
    assert.deepStrictEqual(keys.value, ['view'])

    branch.value = 101
    delete branch.other

    assert.strictEqual(value.runs, 1)
    assert.strictEqual(hasValue.runs, 1)
    assert.strictEqual(keys.runs, 1)

    setSelected(true)

    assert.strictEqual(value.value, 101)
    assert.strictEqual(hasValue.value, true)
    assert.deepStrictEqual(keys.value, ['value'])
    assert.strictEqual(value.runs, 2)
    assert.strictEqual(hasValue.runs, 2)
    assert.strictEqual(keys.runs, 2)

    branch.value = 102

    assert.strictEqual(value.value, 102)
    assert.strictEqual(value.runs, 3)
    assert.strictEqual(hasValue.runs, 2)
    assert.strictEqual(keys.runs, 3)

    delete branch.value

    assert.strictEqual(value.value, undefined)
    assert.strictEqual(hasValue.value, false)
    assert.deepStrictEqual(keys.value, [])
    assert.strictEqual(value.runs, 4)
    assert.strictEqual(hasValue.runs, 3)
    assert.strictEqual(keys.runs, 4)
  }))
})
