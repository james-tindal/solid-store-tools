import { describe, expect, test } from 'vitest'
import { pick } from './pick'

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <_T extends true>() => {}

describe('pick()', () => {
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
