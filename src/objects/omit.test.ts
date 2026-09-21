import { describe, expect, test } from 'vitest'
import { omit } from './omit'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <_T extends true>() => {}

describe('omit()', () => {
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
