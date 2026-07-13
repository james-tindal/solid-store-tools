import { describe, expect, test } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { pick } from './pick'


type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <T extends true>() => {}


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

  test('exposes only the selected keys', () => {
    const selectedSymbol = Symbol('selected')
    const unselectedSymbol = Symbol('unselected')
    const source = {
      name: 'Ada',
      age: 36,
      active: true,
      [selectedSymbol]: 'visible',
      [unselectedSymbol]: 'hidden',
    }
    Object.defineProperty(source, 'secret', {
      value: 'classified',
      enumerable: false,
      configurable: true,
    })

    const picked = pick(source, ['name', 'active', selectedSymbol])

    expect(Object.keys(picked)).toEqual(['name', 'active'])
    expect(Object.getOwnPropertyNames(picked)).toEqual(['name', 'active'])
    expect(Reflect.ownKeys(picked)).toEqual(['name', 'active', selectedSymbol])

    expect('name' in picked).toBe(true)
    expect('active' in picked).toBe(true)
    expect(selectedSymbol in picked).toBe(true)

    expect('age' in picked).toBe(false)
    expect('secret' in picked).toBe(false)
    expect(unselectedSymbol in picked).toBe(false)

    expect((picked as any).age).toBeUndefined()
    expect((picked as any).secret).toBeUndefined()
    expect((picked as any)[unselectedSymbol]).toBeUndefined()

    expect(Object.getOwnPropertyDescriptor(picked, 'name')).toEqual({
      value: 'Ada',
      writable: true,
      enumerable: true,
      configurable: true,
    })
    expect(Object.getOwnPropertyDescriptor(picked, selectedSymbol)).toEqual({
      value: 'visible',
      writable: true,
      enumerable: true,
      configurable: true,
    })
    expect(Object.getOwnPropertyDescriptor(picked, 'age')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(picked, 'secret')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(picked, unselectedSymbol)).toBeUndefined()

    expect(Object.prototype.propertyIsEnumerable.call(picked, 'name')).toBe(true)
    expect(Object.prototype.propertyIsEnumerable.call(picked, selectedSymbol)).toBe(true)
    expect(Object.prototype.propertyIsEnumerable.call(picked, 'age')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(picked, 'secret')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(picked, unselectedSymbol)).toBe(false)
  })

  test('filters source own keys while preserving selected property descriptors', () => {
    const selectedSymbol = Symbol('selected')
    const unselectedSymbol = Symbol('unselected')
    let accessorValue = 1
    const source = {
      enumerableSelected: 'visible',
      enumerableUnselected: 'hidden',
      [selectedSymbol]: 'visible symbol',
      [unselectedSymbol]: 'hidden symbol',
    } as {
      enumerableSelected: string
      enumerableUnselected: string
      nonEnumerableSelected: number
      nonEnumerableUnselected: number
      nonWritableSelected: number
      nonConfigurableWritableSelected?: number
      nonConfigurableFrozenSelected?: number
      accessorSelected: number
      accessorUnselected: number
      [selectedSymbol]: string
      [unselectedSymbol]: string
    }
    Object.defineProperties(source, {
      nonEnumerableSelected: {
        value: 2,
        enumerable: false,
        configurable: true,
        writable: true,
      },
      nonEnumerableUnselected: {
        value: 3,
        enumerable: false,
        configurable: true,
        writable: true,
      },
      nonWritableSelected: {
        value: 4,
        enumerable: true,
        configurable: true,
        writable: false,
      },
      nonConfigurableWritableSelected: {
        value: 5,
        enumerable: true,
        configurable: false,
        writable: true,
      },
      nonConfigurableFrozenSelected: {
        value: 6,
        enumerable: true,
        configurable: false,
        writable: false,
      },
      accessorSelected: {
        get: () => accessorValue,
        set: value => {
          accessorValue = value
        },
        enumerable: true,
        configurable: true,
      },
      accessorUnselected: {
        get: () => 4,
        enumerable: true,
        configurable: true,
      },
    })

    const selectedKeys = new Set<PropertyKey>([
      'enumerableSelected',
      'nonEnumerableSelected',
      'nonWritableSelected',
      'nonConfigurableWritableSelected',
      'nonConfigurableFrozenSelected',
      'accessorSelected',
      selectedSymbol,
    ])
    const picked = pick(source, [
      'enumerableSelected',
      'nonEnumerableSelected',
      'nonWritableSelected',
      'nonConfigurableWritableSelected',
      'nonConfigurableFrozenSelected',
      'accessorSelected',
      selectedSymbol,
    ])

    expect(Reflect.ownKeys(picked)).toEqual(
      Reflect.ownKeys(source).filter(key => selectedKeys.has(key)),
    )
    expect(Object.getOwnPropertyNames(picked)).toEqual([
      'enumerableSelected',
      'nonEnumerableSelected',
      'nonWritableSelected',
      'nonConfigurableWritableSelected',
      'nonConfigurableFrozenSelected',
      'accessorSelected',
    ])
    expect(Object.getOwnPropertySymbols(picked)).toEqual([selectedSymbol])
    expect(Object.keys(picked)).toEqual([
      'enumerableSelected',
      'nonWritableSelected',
      'nonConfigurableWritableSelected',
      'nonConfigurableFrozenSelected',
      'accessorSelected',
    ])

    expect(Object.getOwnPropertyDescriptor(picked, 'enumerableSelected')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'enumerableSelected'),
    )
    expect(Object.getOwnPropertyDescriptor(picked, 'nonEnumerableSelected')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonEnumerableSelected'),
    )
    expect(Object.getOwnPropertyDescriptor(picked, 'nonWritableSelected')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonWritableSelected'),
    )
    expect(Object.getOwnPropertyDescriptor(picked, 'nonConfigurableWritableSelected')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonConfigurableWritableSelected'),
    )
    expect(Object.getOwnPropertyDescriptor(picked, 'nonConfigurableFrozenSelected')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonConfigurableFrozenSelected'),
    )
    expect(Object.getOwnPropertyDescriptor(picked, 'accessorSelected')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'accessorSelected'),
    )
    expect(Object.getOwnPropertyDescriptor(picked, selectedSymbol)).toEqual(
      Object.getOwnPropertyDescriptor(source, selectedSymbol),
    )

    expect(Object.getOwnPropertyDescriptor(picked, 'enumerableUnselected')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(picked, 'nonEnumerableUnselected')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(picked, 'accessorUnselected')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(picked, unselectedSymbol)).toBeUndefined()

    expect(Object.prototype.propertyIsEnumerable.call(picked, 'nonEnumerableSelected')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(picked, 'accessorSelected')).toBe(true)

    expect(picked.accessorSelected).toBe(1)
    picked.accessorSelected = 5
    expect(accessorValue).toBe(5)

    expect(() => {
      picked.nonWritableSelected = 6
    }).toThrow(TypeError)
    expect(source.nonWritableSelected).toBe(4)

    Object.defineProperty(picked, 'nonConfigurableWritableSelected', {
      value: 7,
    })
    expect(source.nonConfigurableWritableSelected).toBe(7)

    expect(() => {
      Object.defineProperty(picked, 'nonConfigurableWritableSelected', {
        configurable: true,
      })
    }).toThrow(TypeError)
    expect(
      Object.getOwnPropertyDescriptor(source, 'nonConfigurableWritableSelected')?.configurable,
    ).toBe(false)

    expect(() => {
      picked.nonConfigurableFrozenSelected = 8
    }).toThrow(TypeError)
    expect(source.nonConfigurableFrozenSelected).toBe(6)

    expect(() => {
      Object.defineProperty(picked, 'nonConfigurableFrozenSelected', {
        value: 8,
      })
    }).toThrow(TypeError)
    expect(source.nonConfigurableFrozenSelected).toBe(6)

    expect(() => {
      delete picked.nonConfigurableWritableSelected
    }).toThrow(TypeError)
    expect('nonConfigurableWritableSelected' in source).toBe(true)
  })

  test('routes mutating operations for selected keys to the source object', () => {
    const selectedSymbol = Symbol('selected')
    const unselectedSymbol = Symbol('unselected')
    const source = {
      name: 'Ada' as string | undefined,
      age: 36,
      active: true,
      [selectedSymbol]: 'visible',
      [unselectedSymbol]: 'hidden',
    }

    const picked = pick(source, ['name', 'active', selectedSymbol])

    picked.name = 'Grace'
    expect(source.name).toBe('Grace')

    Object.defineProperty(picked, 'active', {
      value: false,
      enumerable: true,
      configurable: true,
      writable: true,
    })
    expect(source.active).toBe(false)

    Object.defineProperty(picked, selectedSymbol, {
      value: 'changed',
      enumerable: true,
      configurable: true,
      writable: true,
    })
    expect(source[selectedSymbol]).toBe('changed')

    expect(delete picked.name).toBe(true)
    expect('name' in source).toBe(false)
    expect('name' in picked).toBe(false)

    expect(() => {
      ;(picked as any).age = 40
    }).toThrow(TypeError)
    expect(source.age).toBe(36)
    expect('age' in picked).toBe(false)

    expect(() => {
      ;(picked as any)[unselectedSymbol] = 'changed anyway'
    }).toThrow(TypeError)
    expect(source[unselectedSymbol]).toBe('hidden')
    expect(unselectedSymbol in picked).toBe(false)

    expect(() => {
      Object.defineProperty(picked, 'age', {
        value: 40,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(source.age).toBe(36)
    expect('age' in picked).toBe(false)

    expect(() => {
      Object.defineProperty(picked, unselectedSymbol, {
        value: 'changed anyway',
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(source[unselectedSymbol]).toBe('hidden')
    expect(unselectedSymbol in picked).toBe(false)

    expect(() => {
      delete (picked as any).age
    }).toThrow(TypeError)
    expect(source.age).toBe(36)

    expect(() => {
      delete (picked as any)[unselectedSymbol]
    }).toThrow(TypeError)
    expect(source[unselectedSymbol]).toBe('hidden')
  })

  test('delegates prototype access and mutation to the source object', () => {
    class Original {
      name = 'Ada'
    }
    class Next {}

    const source = new Original()
    const picked = pick(source, ['name'])

    expect(Object.getPrototypeOf(picked)).toBe(Object.getPrototypeOf(source))
    expect(picked).toBeInstanceOf(Original)

    expect(Object.setPrototypeOf(picked, Next.prototype)).toBe(picked)
    expect(Object.getPrototypeOf(source)).toBe(Next.prototype)
    expect(Object.getPrototypeOf(picked)).toBe(Next.prototype)
    expect(picked).toBeInstanceOf(Next)
    expect(picked).not.toBeInstanceOf(Original)
  })

  test('exposes selected methods as stable functions which call the current source entry', () => {
    const source: {
      count: number
      increment: (step?: number) => number
      readUnselected(): number
    } = {
      count: 1,
      increment(step = 1) {
        this.count += step
        return this.count
      },
      readUnselected() {
        return this.count
      },
    }

    const picked = pick(source, ['increment'])
    const pickedIncrement = picked.increment
    const descriptor = Object.getOwnPropertyDescriptor(picked, 'increment')

    expect(pickedIncrement).toBe(picked.increment)
    expect(descriptor).toEqual({
      value: pickedIncrement,
      writable: true,
      enumerable: true,
      configurable: true,
    })
    expect(pickedIncrement).not.toBe(source.increment)

    expect(picked.increment()).toBe(2)
    expect(source.count).toBe(2)

    expect(pickedIncrement(3)).toBe(5)
    expect(source.count).toBe(5)

    source.increment = function (step = 1) {
      this.count += step * 10
      return this.count
    }

    expect(picked.increment).toBe(pickedIncrement)
    expect(Object.getOwnPropertyDescriptor(picked, 'increment')?.value).toBe(pickedIncrement)
    expect(pickedIncrement(2)).toBe(25)
    expect(source.count).toBe(25)

    ;(source as any).increment = 1

    expect(picked.increment).toBe(1)
    expect(Object.getOwnPropertyDescriptor(picked, 'increment')?.value).toBe(1)

    expect(() => {
      pickedIncrement()
    }).toThrow(TypeError)

    expect((picked as any).readUnselected).toBeUndefined()
  })

  test('preserves callability for function sources and calls the source function', () => {
    const calls: string[] = []
    const source = Object.assign(function source(value: string) {
      calls.push(value)
      return `called ${value}`
    }, {
      selected: 'visible',
      unselected: 'hidden',
    })

    const picked = pick(source, ['selected'])

    expect(typeof picked).toBe('function')
    expect(picked.selected).toBe('visible')
    expect('unselected' in picked).toBe(false)

    const result = picked('input')

    expect(calls).toEqual(['input'])
    expect(result).toBe('called input')
  })

  test('treats missing keys according to whether they were selected', () => {
    const source: {
      present: string
      missing?: number
      unselectedExisting: boolean
      unselectedMissing?: string
    } = {
      present: 'value',
      unselectedExisting: true,
    }

    const picked = pick(source, ['present', 'missing'])

    expect(picked.missing).toBeUndefined()
    expect('missing' in picked).toBe(false)
    expect(Object.keys(picked)).toEqual(['present'])
    expect(Object.getOwnPropertyDescriptor(picked, 'missing')).toBeUndefined()

    picked.missing = 1
    expect(source.missing).toBe(1)
    expect('missing' in picked).toBe(true)
    expect(Object.keys(picked)).toEqual(['present', 'missing'])

    expect(delete picked.missing).toBe(true)
    expect('missing' in source).toBe(false)
    expect('missing' in picked).toBe(false)

    Object.defineProperty(picked, 'missing', {
      value: 2,
      enumerable: true,
      configurable: true,
      writable: true,
    })
    expect(source.missing).toBe(2)
    expect('missing' in picked).toBe(true)

    expect((picked as any).unselectedExisting).toBeUndefined()
    expect('unselectedExisting' in picked).toBe(false)

    expect(() => {
      ;(picked as any).unselectedExisting = false
    }).toThrow(TypeError)
    expect(source.unselectedExisting).toBe(true)
    expect('unselectedExisting' in picked).toBe(false)

    expect(() => {
      Object.defineProperty(picked, 'unselectedExisting', {
        value: false,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(source.unselectedExisting).toBe(true)

    expect((picked as any).unselectedMissing).toBeUndefined()
    expect('unselectedMissing' in picked).toBe(false)

    expect(() => {
      ;(picked as any).unselectedMissing = 'created'
    }).toThrow(TypeError)
    expect('unselectedMissing' in source).toBe(false)
    expect('unselectedMissing' in picked).toBe(false)

    expect(() => {
      Object.defineProperty(picked, 'unselectedMissing', {
        value: 'created',
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect('unselectedMissing' in source).toBe(false)

    expect(() => {
      delete (picked as any).unselectedExisting
    }).toThrow(TypeError)
    expect(source.unselectedExisting).toBe(true)

    expect(() => {
      delete (picked as any).unselectedMissing
    }).toThrow(TypeError)
    expect('unselectedMissing' in source).toBe(false)
  })
  test('selected accessor descriptors can be passed through Solid store updates', () => {
    const [nestedStore] = createStore({ value: 'initial' })
    const source = {
      get nestedStore() {
        return nestedStore
      },
      skipped: true,
    }
    const picked = pick(source, ['nestedStore'])
    const [, setStore] = createStore({} as { data?: typeof picked })

    expect(Object.getOwnPropertyDescriptor(picked, 'nestedStore')?.get).toBeTypeOf('function')
    expect(() => setStore({ data: picked })).not.toThrow()
  })
})

describe('pick() with signal source', () => {
  test('reads and writes use the current signal value', () => createRoot(dispose => {
    const first = {
      name: 'Ada',
      hidden: 'first hidden',
    }
    const second = {
      name: 'Grace',
      hidden: 'second hidden',
    }
    const [source, setSource] = createSignal(first)
    const result = pick(source, ['name'])

    expect(result.name).toBe('Ada')

    setSource(second)

    expect(result.name).toBe('Grace')

    result.name = 'Katherine'

    expect(first.name).toBe('Ada')
    expect(second.name).toBe('Katherine')
    expect((result as any).hidden).toBeUndefined()

    dispose()
  }))

  test('keys and descriptors use the current signal value', () => createRoot(dispose => {
    const first = {
      name: 'Ada',
      hidden: 'first hidden',
    } as {
      name?: string
      hidden: string
    }
    const second = {
      hidden: 'second hidden',
    } as {
      name?: string
      hidden: string
    }
    Object.defineProperty(second, 'name', {
      value: 'Grace',
      enumerable: false,
      configurable: true,
      writable: true,
    })
    const [source, setSource] = createSignal(first)
    const result = pick(source, ['name'])

    expect(Object.keys(result)).toEqual(['name'])
    expect(Object.getOwnPropertyDescriptor(result, 'name')).toEqual({
      value: 'Ada',
      writable: true,
      enumerable: true,
      configurable: true,
    })

    setSource(second)

    expect(Object.keys(result)).toEqual([])
    expect(Object.getOwnPropertyNames(result)).toEqual(['name'])
    expect(Object.getOwnPropertyDescriptor(result, 'name')).toEqual({
      value: 'Grace',
      writable: true,
      enumerable: false,
      configurable: true,
    })

    dispose()
  }))

  test('previously read methods call the current signal value', () => createRoot(dispose => {
    const first = {
      count: 1,
      increment(step = 1) {
        this.count += step
        return this.count
      },
      hidden: true,
    }
    const second = {
      count: 10,
      increment(step = 1) {
        this.count += step * 10
        return this.count
      },
      hidden: true,
    }
    const [source, setSource] = createSignal(first)
    const result = pick(source, ['increment'])
    const increment = result.increment

    expect(increment()).toBe(2)
    expect(first.count).toBe(2)

    setSource(second)

    expect(result.increment).toBe(increment)
    expect(Object.getOwnPropertyDescriptor(result, 'increment')?.value).toBe(increment)
    expect(increment(2)).toBe(30)
    expect(second.count).toBe(30)

    dispose()
  }))

  test('function calls use the current signal value', () => createRoot(dispose => {
    const first = Object.assign(function first(value: string) {
      return `first ${value}`
    }, {
      label: 'first',
      hidden: true,
    })
    const second = Object.assign(function second(value: string) {
      return `second ${value}`
    }, {
      label: 'second',
      hidden: true,
    })
    const [source, setSource] = createSignal(first)
    const result = pick(source, ['label'])

    expect(result('input')).toBe('first input')
    expect(result.label).toBe('first')

    setSource(() => second)

    expect(result('input')).toBe('second input')
    expect(result.label).toBe('second')

    dispose()
  }))

  test('prototype access and mutation use the current signal value', () => createRoot(dispose => {
    class First {
      name = 'Ada'
      hidden = true
    }
    class Second {
      name = 'Grace'
      hidden = true
    }
    class Next {}

    const first = new First()
    const second = new Second()
    const [source, setSource] = createSignal<First | Second>(first)
    const result = pick(source, ['name'])

    expect(Object.getPrototypeOf(result)).toBe(First.prototype)
    expect(result).toBeInstanceOf(First)

    setSource(second)

    expect(Object.getPrototypeOf(result)).toBe(Second.prototype)
    expect(result).toBeInstanceOf(Second)

    expect(Object.setPrototypeOf(result, Next.prototype)).toBe(result)
    expect(Object.getPrototypeOf(first)).toBe(First.prototype)
    expect(Object.getPrototypeOf(second)).toBe(Next.prototype)
    expect(Object.getPrototypeOf(result)).toBe(Next.prototype)

    dispose()
  }))
})
