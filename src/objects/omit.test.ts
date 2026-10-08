import { describe, expect, test } from 'vitest'
import { omit } from './omit'
import { pick } from './pick'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <_T extends true>() => {}

describe('omit()', () => {
  test('omits known keys inside constrained generic functions', () => {
    const exclude = <T extends { value: number, hidden: boolean }>(source: T): Omit<T, 'hidden'> =>
      omit(source, ['hidden'])

    const selected = exclude({ value: 1 as const, hidden: true, extra: 'kept' })
    assertType<Equal<typeof selected.value, 1>>()
    expect(selected.extra).toBe('kept')
    if (false) {
      // @ts-expect-error omitted keys are not exposed
      selected.hidden
    }
  })

  test('omits known fields from polymorphic this and generic subclasses', () => {
    class Box<T> {
      hidden = true
      constructor(readonly value: T) {}

      get state(): { readonly value: T } {
        return omit(this, ['hidden'])
      }
    }
    class NamedBox<T> extends Box<T> {
      name = 'box'

      get namedState(): { readonly value: T, name: string } {
        return omit(this, ['hidden'])
      }
    }

    const selected = new NamedBox('contents' as const).namedState
    assertType<Equal<typeof selected.value, 'contents'>>()
    expect(selected.name).toBe('box')
    if (false) {
      // @ts-expect-error remaining readonly fields stay readonly
      selected.value = 'contents'
    }
  })

  test('preserves numeric keys and optional modifiers', () => {
    const source: { readonly 0: string, 1?: number, hidden: boolean } = { 0: 'zero', hidden: true }
    const selected = omit(source, ['hidden'])
    assertType<Equal<typeof selected, { readonly 0: string, 1?: number }>>()
    expect(selected[0]).toBe('zero')
    if (false) {
      // @ts-expect-error remaining numeric readonly keys stay readonly
      selected[0] = 'changed'
      // @ts-expect-error unknown numeric keys are rejected
      omit(source, [2])
    }
  })

  test('preserves callable arguments, results, and remaining properties', () => {
    type Callable = ((value: number, suffix?: string) => string) & {
      readonly label: string
      hidden: boolean
    }
    const source: Callable = Object.assign(
      (value: number, suffix = '') => `${value}${suffix}`,
      { label: 'format', hidden: true },
    )
    const selected = omit(source, ['hidden'])
    assertType<Equal<Parameters<typeof selected>, [value: number, suffix?: string]>>()
    assertType<Equal<ReturnType<typeof selected>, string>>()
    expect(selected(2, '!')).toBe('2!')
    if (false) {
      // @ts-expect-error callable arguments remain checked
      selected('wrong')
      // @ts-expect-error remaining readonly properties stay readonly
      selected.label = 'changed'
      // @ts-expect-error omitted callable properties are absent
      selected.hidden
    }
  })

  test('preserves discriminant narrowing after pick composition', () => {
    type Source =
      | { kind: 'text', value: string, hidden: boolean }
      | { kind: 'number', value: number, hidden: boolean }
    const select = (source: Source) => omit(pick(source, ['kind', 'value', 'hidden']), ['hidden'])
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

  test('returns the remaining key types', () => {
    const keptSymbol = Symbol('kept')
    const omittedSymbol = Symbol('omitted')
    type Source = {
      readonly id: string
      name: string
      active: boolean
      missing?: number
      nullable: number | undefined
      age: number
      [keptSymbol]: Date
      [omittedSymbol]: string
    }
    const source: Source = {
      id: '1',
      name: 'Ada',
      active: true,
      nullable: undefined,
      age: 36,
      [keptSymbol]: new Date(),
      [omittedSymbol]: 'hidden',
    }

    const omitted = omit(source, ['name', 'active', omittedSymbol])

    type Actual = typeof omitted
    type Expected = Omit<Source, 'name' | 'active' | typeof omittedSymbol>

    assertType<Equal<Actual, Expected>>()

    if (false) {
      // @ts-expect-error remaining readonly entries stay readonly
      omitted.id = '2'

      // @ts-expect-error keys must exist on the source type
      omit(source, ['unknown'])
    }
  })

  test('returns distributive remaining key types for union sources', () => {
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
    const omitted = omit(source, ['personOnly', 'countOnly'])

    type Actual = typeof omitted
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
      if (omitted.kind === 'person') {
        assertType<Equal<typeof omitted.id, string>>()
        assertType<Equal<typeof omitted.value, string>>()
      } else {
        assertType<Equal<typeof omitted.id, number>>()
        assertType<Equal<typeof omitted.value, number>>()
      }
    }
    void checkNarrowing
  })

  test('infers omittable keys from every union source member', () => {
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

    omit(source, ['kind', 'id', 'shared', 'personOnly'])
    omit(source, ['kind', 'id', 'shared', 'countOnly'])
    omit(source, ['personOnly', 'countOnly'])

    if (false) {
      // @ts-expect-error keys must exist on at least one union member
      omit(source, ['unknown'])
    }
  })

  test('exposes only non-omitted keys', () => {
    const keptSymbol = Symbol('kept')
    const omittedSymbol = Symbol('omitted')
    const source = {
      name: 'Ada',
      age: 36,
      active: true,
      [keptSymbol]: 'visible',
      [omittedSymbol]: 'hidden',
    }

    const result = omit(source, ['age', omittedSymbol])

    expect(Object.keys(result)).toEqual(['name', 'active'])
    expect(Reflect.ownKeys(result)).toEqual(['name', 'active', keptSymbol])
    expect(result.name).toBe('Ada')
    expect(result.active).toBe(true)
    expect(result[keptSymbol]).toBe('visible')
    expect('age' in result).toBe(false)
    expect(omittedSymbol in result).toBe(false)
    expect((result as any).age).toBeUndefined()
    expect((result as any)[omittedSymbol]).toBeUndefined()
  })
})
