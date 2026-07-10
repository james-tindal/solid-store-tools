import { createRoot, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { describe, expect, test } from 'vitest'
import { omit } from './omit'


type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

const assertType = <T extends true>() => {}


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

  test('exposes only keys which were not omitted', () => {
    const keptSymbol = Symbol('kept')
    const omittedSymbol = Symbol('omitted')
    const source = {
      name: 'Ada',
      age: 36,
      active: true,
      [keptSymbol]: 'visible',
      [omittedSymbol]: 'hidden',
    } as {
      name: string
      age: number
      active: boolean
      secret: string
      [keptSymbol]: string
      [omittedSymbol]: string
    }
    Object.defineProperty(source, 'secret', {
      value: 'classified',
      enumerable: false,
      configurable: true,
    })

    const result = omit(source, ['age', 'secret', omittedSymbol])

    expect(Object.keys(result)).toEqual(['name', 'active'])
    expect(Object.getOwnPropertyNames(result)).toEqual(['name', 'active'])
    expect(Reflect.ownKeys(result)).toEqual(['name', 'active', keptSymbol])

    expect('name' in result).toBe(true)
    expect('active' in result).toBe(true)
    expect(keptSymbol in result).toBe(true)

    expect('age' in result).toBe(false)
    expect('secret' in result).toBe(false)
    expect(omittedSymbol in result).toBe(false)

    expect((result as any).age).toBeUndefined()
    expect((result as any).secret).toBeUndefined()
    expect((result as any)[omittedSymbol]).toBeUndefined()

    expect(Object.getOwnPropertyDescriptor(result, 'name')).toEqual({
      value: 'Ada',
      writable: true,
      enumerable: true,
      configurable: true,
    })
    expect(Object.getOwnPropertyDescriptor(result, keptSymbol)).toEqual({
      value: 'visible',
      writable: true,
      enumerable: true,
      configurable: true,
    })
    expect(Object.getOwnPropertyDescriptor(result, 'age')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, 'secret')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, omittedSymbol)).toBeUndefined()

    expect(Object.prototype.propertyIsEnumerable.call(result, 'name')).toBe(true)
    expect(Object.prototype.propertyIsEnumerable.call(result, keptSymbol)).toBe(true)
    expect(Object.prototype.propertyIsEnumerable.call(result, 'age')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(result, 'secret')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(result, omittedSymbol)).toBe(false)
  })

  test('filters source own keys while preserving remaining property descriptors', () => {
    const keptSymbol = Symbol('kept')
    const omittedSymbol = Symbol('omitted')
    let accessorValue = 1
    const source = {
      enumerableKept: 'visible',
      enumerableOmitted: 'hidden',
      [keptSymbol]: 'visible symbol',
      [omittedSymbol]: 'hidden symbol',
    } as {
      enumerableKept: string
      enumerableOmitted: string
      nonEnumerableKept: number
      nonEnumerableOmitted: number
      nonWritableKept: number
      nonConfigurableWritableKept?: number
      nonConfigurableFrozenKept?: number
      accessorKept: number
      accessorOmitted: number
      [keptSymbol]: string
      [omittedSymbol]: string
    }
    Object.defineProperties(source, {
      nonEnumerableKept: {
        value: 2,
        enumerable: false,
        configurable: true,
        writable: true,
      },
      nonEnumerableOmitted: {
        value: 3,
        enumerable: false,
        configurable: true,
        writable: true,
      },
      nonWritableKept: {
        value: 4,
        enumerable: true,
        configurable: true,
        writable: false,
      },
      nonConfigurableWritableKept: {
        value: 5,
        enumerable: true,
        configurable: false,
        writable: true,
      },
      nonConfigurableFrozenKept: {
        value: 6,
        enumerable: true,
        configurable: false,
        writable: false,
      },
      accessorKept: {
        get: () => accessorValue,
        set: value => {
          accessorValue = value
        },
        enumerable: true,
        configurable: true,
      },
      accessorOmitted: {
        get: () => 4,
        enumerable: true,
        configurable: true,
      },
    })

    const omittedKeys = new Set<PropertyKey>([
      'enumerableOmitted',
      'nonEnumerableOmitted',
      'accessorOmitted',
      omittedSymbol,
    ])
    const result = omit(source, [
      'enumerableOmitted',
      'nonEnumerableOmitted',
      'accessorOmitted',
      omittedSymbol,
    ])

    expect(Reflect.ownKeys(result)).toEqual(
      Reflect.ownKeys(source).filter(key => !omittedKeys.has(key)),
    )
    expect(Object.getOwnPropertyNames(result)).toEqual([
      'enumerableKept',
      'nonEnumerableKept',
      'nonWritableKept',
      'nonConfigurableWritableKept',
      'nonConfigurableFrozenKept',
      'accessorKept',
    ])
    expect(Object.getOwnPropertySymbols(result)).toEqual([keptSymbol])
    expect(Object.keys(result)).toEqual([
      'enumerableKept',
      'nonWritableKept',
      'nonConfigurableWritableKept',
      'nonConfigurableFrozenKept',
      'accessorKept',
    ])

    expect(Object.getOwnPropertyDescriptor(result, 'enumerableKept')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'enumerableKept'),
    )
    expect(Object.getOwnPropertyDescriptor(result, 'nonEnumerableKept')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonEnumerableKept'),
    )
    expect(Object.getOwnPropertyDescriptor(result, 'nonWritableKept')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonWritableKept'),
    )
    expect(Object.getOwnPropertyDescriptor(result, 'nonConfigurableWritableKept')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonConfigurableWritableKept'),
    )
    expect(Object.getOwnPropertyDescriptor(result, 'nonConfigurableFrozenKept')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'nonConfigurableFrozenKept'),
    )
    expect(Object.getOwnPropertyDescriptor(result, 'accessorKept')).toEqual(
      Object.getOwnPropertyDescriptor(source, 'accessorKept'),
    )
    expect(Object.getOwnPropertyDescriptor(result, keptSymbol)).toEqual(
      Object.getOwnPropertyDescriptor(source, keptSymbol),
    )

    expect(Object.getOwnPropertyDescriptor(result, 'enumerableOmitted')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, 'nonEnumerableOmitted')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, 'accessorOmitted')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, omittedSymbol)).toBeUndefined()

    expect(Object.prototype.propertyIsEnumerable.call(result, 'nonEnumerableKept')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(result, 'accessorKept')).toBe(true)

    expect(result.accessorKept).toBe(1)
    result.accessorKept = 5
    expect(accessorValue).toBe(5)

    expect(() => {
      result.nonWritableKept = 6
    }).toThrow(TypeError)
    expect(source.nonWritableKept).toBe(4)

    Object.defineProperty(result, 'nonConfigurableWritableKept', {
      value: 7,
    })
    expect(source.nonConfigurableWritableKept).toBe(7)

    expect(() => {
      Object.defineProperty(result, 'nonConfigurableWritableKept', {
        configurable: true,
      })
    }).toThrow(TypeError)
    expect(
      Object.getOwnPropertyDescriptor(source, 'nonConfigurableWritableKept')?.configurable,
    ).toBe(false)

    expect(() => {
      result.nonConfigurableFrozenKept = 8
    }).toThrow(TypeError)
    expect(source.nonConfigurableFrozenKept).toBe(6)

    expect(() => {
      Object.defineProperty(result, 'nonConfigurableFrozenKept', {
        value: 8,
      })
    }).toThrow(TypeError)
    expect(source.nonConfigurableFrozenKept).toBe(6)

    expect(() => {
      delete result.nonConfigurableWritableKept
    }).toThrow(TypeError)
    expect('nonConfigurableWritableKept' in source).toBe(true)
  })

  test('routes mutating operations for remaining keys to the source object', () => {
    const keptSymbol = Symbol('kept')
    const omittedSymbol = Symbol('omitted')
    const source = {
      name: 'Ada' as string | undefined,
      age: 36,
      active: true,
      [keptSymbol]: 'visible',
      [omittedSymbol]: 'hidden',
    }

    const result = omit(source, ['age', omittedSymbol])

    result.name = 'Grace'
    expect(source.name).toBe('Grace')

    Object.defineProperty(result, 'active', {
      value: false,
      enumerable: true,
      configurable: true,
      writable: true,
    })
    expect(source.active).toBe(false)

    Object.defineProperty(result, keptSymbol, {
      value: 'changed',
      enumerable: true,
      configurable: true,
      writable: true,
    })
    expect(source[keptSymbol]).toBe('changed')

    expect(delete result.name).toBe(true)
    expect('name' in source).toBe(false)
    expect('name' in result).toBe(false)

    expect(() => {
      ;(result as any).age = 40
    }).toThrow(TypeError)
    expect(source.age).toBe(36)
    expect('age' in result).toBe(false)

    expect(() => {
      ;(result as any)[omittedSymbol] = 'changed anyway'
    }).toThrow(TypeError)
    expect(source[omittedSymbol]).toBe('hidden')
    expect(omittedSymbol in result).toBe(false)

    expect(() => {
      Object.defineProperty(result, 'age', {
        value: 40,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(source.age).toBe(36)
    expect('age' in result).toBe(false)

    expect(() => {
      Object.defineProperty(result, omittedSymbol, {
        value: 'changed anyway',
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(source[omittedSymbol]).toBe('hidden')
    expect(omittedSymbol in result).toBe(false)

    expect(() => {
      delete (result as any).age
    }).toThrow(TypeError)
    expect(source.age).toBe(36)

    expect(() => {
      delete (result as any)[omittedSymbol]
    }).toThrow(TypeError)
    expect(source[omittedSymbol]).toBe('hidden')
  })

  test('delegates prototype access and mutation to the source object', () => {
    class Original {
      name = 'Ada'
      age = 36
    }
    class Next {}

    const source = new Original()
    const result = omit(source, ['age'])

    expect(Object.getPrototypeOf(result)).toBe(Object.getPrototypeOf(source))
    expect(result).toBeInstanceOf(Original)

    expect(Object.setPrototypeOf(result, Next.prototype)).toBe(result)
    expect(Object.getPrototypeOf(source)).toBe(Next.prototype)
    expect(Object.getPrototypeOf(result)).toBe(Next.prototype)
    expect(result).toBeInstanceOf(Next)
    expect(result).not.toBeInstanceOf(Original)
  })

  test('exposes remaining methods as stable functions which call the current source entry', () => {
    const source: {
      count: number
      increment: (step?: number) => number
      readOmitted(): number
    } = {
      count: 1,
      increment(step = 1) {
        this.count += step
        return this.count
      },
      readOmitted() {
        return this.count
      },
    }

    const result = omit(source, ['count', 'readOmitted'])
    const increment = result.increment
    const descriptor = Object.getOwnPropertyDescriptor(result, 'increment')

    expect(increment).toBe(result.increment)
    expect(descriptor).toEqual({
      value: increment,
      writable: true,
      enumerable: true,
      configurable: true,
    })
    expect(increment).not.toBe(source.increment)

    expect(result.increment()).toBe(2)
    expect(source.count).toBe(2)

    expect(increment(3)).toBe(5)
    expect(source.count).toBe(5)

    source.increment = function (step = 1) {
      this.count += step * 10
      return this.count
    }

    expect(result.increment).toBe(increment)
    expect(Object.getOwnPropertyDescriptor(result, 'increment')?.value).toBe(increment)
    expect(increment(2)).toBe(25)
    expect(source.count).toBe(25)

    ;(source as any).increment = 1

    expect(result.increment).toBe(1)
    expect(Object.getOwnPropertyDescriptor(result, 'increment')?.value).toBe(1)

    expect(() => {
      increment()
    }).toThrow(TypeError)

    expect((result as any).readOmitted).toBeUndefined()
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

    const result = omit(source, ['unselected'])

    expect(typeof result).toBe('function')
    expect(result.selected).toBe('visible')
    expect('unselected' in result).toBe(false)

    const callResult = result('input')

    expect(calls).toEqual(['input'])
    expect(callResult).toBe('called input')
  })

  test('treats missing keys according to whether they were omitted', () => {
    const source: {
      present: string
      missing?: number
      omittedExisting: boolean
      omittedMissing?: string
    } = {
      present: 'value',
      omittedExisting: true,
    }

    const result = omit(source, ['omittedExisting', 'omittedMissing'])

    expect(result.missing).toBeUndefined()
    expect('missing' in result).toBe(false)
    expect(Object.keys(result)).toEqual(['present'])
    expect(Object.getOwnPropertyDescriptor(result, 'missing')).toBeUndefined()

    result.missing = 1
    expect(source.missing).toBe(1)
    expect('missing' in result).toBe(true)
    expect(Object.keys(result)).toEqual(['present', 'missing'])

    expect(delete result.missing).toBe(true)
    expect('missing' in source).toBe(false)
    expect('missing' in result).toBe(false)

    Object.defineProperty(result, 'missing', {
      value: 2,
      enumerable: true,
      configurable: true,
      writable: true,
    })
    expect(source.missing).toBe(2)
    expect('missing' in result).toBe(true)

    expect((result as any).omittedExisting).toBeUndefined()
    expect('omittedExisting' in result).toBe(false)

    expect(() => {
      ;(result as any).omittedExisting = false
    }).toThrow(TypeError)
    expect(source.omittedExisting).toBe(true)
    expect('omittedExisting' in result).toBe(false)

    expect(() => {
      Object.defineProperty(result, 'omittedExisting', {
        value: false,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(source.omittedExisting).toBe(true)

    expect((result as any).omittedMissing).toBeUndefined()
    expect('omittedMissing' in result).toBe(false)

    expect(() => {
      ;(result as any).omittedMissing = 'created'
    }).toThrow(TypeError)
    expect('omittedMissing' in source).toBe(false)
    expect('omittedMissing' in result).toBe(false)

    expect(() => {
      Object.defineProperty(result, 'omittedMissing', {
        value: 'created',
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect('omittedMissing' in source).toBe(false)

    expect(() => {
      delete (result as any).omittedExisting
    }).toThrow(TypeError)
    expect(source.omittedExisting).toBe(true)

    expect(() => {
      delete (result as any).omittedMissing
    }).toThrow(TypeError)
    expect('omittedMissing' in source).toBe(false)
  })
  test('remaining accessor descriptors can be passed through Solid store updates', () => {
    const [nestedStore] = createStore({ value: 'initial' })
    const source = {
      get nestedStore() {
        return nestedStore
      },
      skipped: true,
    }
    const result = omit(source, ['skipped'])
    const [, setStore] = createStore({} as { data?: typeof result })

    expect(Object.getOwnPropertyDescriptor(result, 'nestedStore')?.get).toBeTypeOf('function')
    expect(() => setStore({ data: result })).not.toThrow()
  })
})

describe('omit() with signal source', () => {
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
    const result = omit(source, ['hidden'])

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
    const result = omit(source, ['hidden'])

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
    const result = omit(source, ['count', 'hidden'])
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
    const result = omit(source, ['hidden'])

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
    const result = omit(source, ['hidden'])

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
