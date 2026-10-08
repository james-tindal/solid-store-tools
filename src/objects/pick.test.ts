import { describe, expect, test } from 'vitest'
import { pick } from './pick'
import { omit } from './omit'
import { merge } from './merge'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <_T extends true>() => {}

describe('pick()', () => {
  test('selects known keys inside constrained generic functions', () => {
    const select = <T extends { value: number, extra: string }>(source: T): Pick<T, 'value'> =>
      pick(source, ['value'])

    const source = { value: 1 as const, extra: 'hidden', another: true }
    const selected = select(source)
    assertType<Equal<typeof selected, { value: 1 }>>()
    expect(selected.value).toBe(1)
    if (false) {
      // @ts-expect-error unselected keys are not exposed
      selected.extra
    }
  })

  test('preserves generic class fields and inherited fields', () => {
    class Box<T> {
      constructor(readonly value: T) {}

      get state(): { readonly value: T } {
        return pick(this, ['value'])
      }
    }
    class NamedBox<T> extends Box<T> {
      name = 'box'

      get namedState(): { readonly value: T, name: string } {
        return pick(this, ['value', 'name'])
      }
    }

    const box = new NamedBox('contents' as const)
    const selected = box.namedState
    assertType<Equal<typeof selected.value, 'contents'>>()
    expect(selected.name).toBe('box')
    if (false) {
      // @ts-expect-error inherited readonly fields stay readonly
      selected.value = 'contents'
    }
  })

  test('preserves numeric keys and optional modifiers', () => {
    const source: { readonly 0: string, 1?: number, other: boolean } = { 0: 'zero', other: true }
    const selected = pick(source, [0, 1])
    assertType<Equal<typeof selected, { readonly 0: string, 1?: number }>>()
    expect(selected[0]).toBe('zero')
    if (false) {
      // @ts-expect-error numeric readonly keys stay readonly
      selected[0] = 'changed'
      // @ts-expect-error unknown numeric keys are rejected
      pick(source, [2])
    }
  })

  test('preserves callable arguments, results, and selected properties', () => {
    type Callable = ((value: number, suffix?: string) => string) & {
      readonly label: string
      hidden: boolean
    }
    const source: Callable = Object.assign(
      (value: number, suffix = '') => `${value}${suffix}`,
      { label: 'format', hidden: true },
    )
    const selected = pick(source, ['label'])
    assertType<Equal<Parameters<typeof selected>, [value: number, suffix?: string]>>()
    assertType<Equal<ReturnType<typeof selected>, string>>()
    expect(selected(2, '!')).toBe('2!')
    if (false) {
      // @ts-expect-error callable arguments remain checked
      selected('wrong')
      // @ts-expect-error selected readonly properties stay readonly
      selected.label = 'changed'
      // @ts-expect-error unselected callable properties are absent
      selected.hidden
    }
  })

  test('preserves discriminant narrowing through merge and omit composition', () => {
    type Source =
      | { kind: 'text', value: string, hidden: boolean }
      | { kind: 'number', value: number, hidden: boolean }
    const select = (source: Source) => pick(omit(merge(source, { extra: true }), ['hidden']), ['kind', 'value'])
    const selected = select({ kind: 'text', value: 'hello', hidden: false })
    assertType<Equal<typeof selected, { kind: 'text', value: string } | { kind: 'number', value: number }>>()
    if (selected.kind === 'text') {
      const value: string = selected.value
      expect(value).toBe('hello')
    } else {
      const value: number = selected.value
      expect(value).toBeTypeOf('number')
    }
  })

  test('selects a known field from polymorphic this', () => {
    class Counter {
      value = 0

      get state(): { value: number } {
        return pick(this, ['value'])
      }
    }

    const counter = new Counter()
    const state = counter.state
    expect(state.value).toBe(0)
    counter.value = 1
    expect(state.value).toBe(1)
  })

  test('returns the selected key types', () => {
    const selectedSymbol = Symbol('selected')
    type Source = {
      readonly id: string
      name: string
      active: boolean
      missing?: number
      nullable: number | undefined
      age: number
      [selectedSymbol]: Date
    }
    const source: Source = {
      id: '1',
      name: 'Ada',
      active: true,
      nullable: undefined,
      age: 36,
      [selectedSymbol]: new Date(),
    }

    const picked = pick(source, ['id', 'missing', 'nullable', selectedSymbol])

    type Actual = typeof picked
    type Expected = Pick<Source, 'id' | 'missing' | 'nullable' | typeof selectedSymbol>

    assertType<Equal<Actual, Expected>>()

    if (false) {
      // @ts-expect-error selected readonly entries stay readonly
      picked.id = '2'

      // @ts-expect-error keys must exist on the source type
      pick(source, ['unknown'])
    }
  })

  test('returns distributive selected key types for union sources', () => {
    type Source =
      | {
        kind: 'person'
        id: string
        value: string
        personOnly: boolean
      }
      | {
        kind: 'count'
        id: number
        value: number
        countOnly: Date
      }

    const source = {} as Source
    const picked = pick(source, ['kind', 'id', 'value'])

    type Actual = typeof picked
    type Expected =
      | {
        kind: 'person'
        id: string
        value: string
      }
      | {
        kind: 'count'
        id: number
        value: number
      }

    assertType<Equal<Actual, Expected>>()

    const checkNarrowing = () => {
      if (picked.kind === 'person') {
        assertType<Equal<typeof picked.id, string>>()
        assertType<Equal<typeof picked.value, string>>()
      } else {
        assertType<Equal<typeof picked.id, number>>()
        assertType<Equal<typeof picked.value, number>>()
      }
    }
    void checkNarrowing
  })

  test('infers selectable keys from every union source member', () => {
    type Source =
      | {
        kind: 'person'
        id: string
        shared: boolean
        personOnly: Date
      }
      | {
        kind: 'count'
        id: number
        shared: boolean
        countOnly: number
      }

    const source = {} as Source

    pick(source, ['kind', 'id', 'shared', 'personOnly'])
    pick(source, ['kind', 'id', 'shared', 'countOnly'])
    pick(source, ['personOnly', 'countOnly'])

    if (false) {
      // @ts-expect-error keys must exist on at least one union member
      pick(source, ['unknown'])
    }
  })

  test('exposes only selected keys', () => {
    const selectedSymbol = Symbol('selected')
    const unselectedSymbol = Symbol('unselected')
    const source = {
      name: 'Ada',
      age: 36,
      active: true,
      [selectedSymbol]: 'visible',
      [unselectedSymbol]: 'hidden',
    }

    const picked = pick(source, ['name', 'active', selectedSymbol])

    expect(Object.keys(picked)).toEqual(['name', 'active'])
    expect(Reflect.ownKeys(picked)).toEqual(['name', 'active', selectedSymbol])
    expect(picked.name).toBe('Ada')
    expect(picked.active).toBe(true)
    expect(picked[selectedSymbol]).toBe('visible')
    expect('age' in picked).toBe(false)
    expect(unselectedSymbol in picked).toBe(false)
    expect((picked as any).age).toBeUndefined()
    expect((picked as any)[unselectedSymbol]).toBeUndefined()
  })
})
