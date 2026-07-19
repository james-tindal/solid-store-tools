import { describe, expect, test } from 'vitest'
import { filterKeys } from './filterKeys'

describe('filterKeys()', () => {
  test('exposes only allowed keys', () => {
    const keptSymbol = Symbol('kept')
    const filteredSymbol = Symbol('filtered')
    const source = {
      name: 'Ada',
      age: 36,
      active: true,
      [keptSymbol]: 'visible',
      [filteredSymbol]: 'hidden',
    } as {
      name: string
      age: number
      active: boolean
      secret: string
      [keptSymbol]: string
      [filteredSymbol]: string
    }
    Object.defineProperty(source, 'secret', {
      value: 'classified',
      enumerable: false,
      configurable: true,
    })

    const allowed = new Set<PropertyKey>(['name', 'active', keptSymbol])
    const result = filterKeys(source, key => allowed.has(key))

    expect(Object.keys(result)).toEqual(['name', 'active'])
    expect(Object.getOwnPropertyNames(result)).toEqual(['name', 'active'])
    expect(Reflect.ownKeys(result)).toEqual(['name', 'active', keptSymbol])

    expect('name' in result).toBe(true)
    expect('active' in result).toBe(true)
    expect(keptSymbol in result).toBe(true)

    expect('age' in result).toBe(false)
    expect('secret' in result).toBe(false)
    expect(filteredSymbol in result).toBe(false)

    expect((result as any).age).toBeUndefined()
    expect((result as any).secret).toBeUndefined()
    expect((result as any)[filteredSymbol]).toBeUndefined()

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
    expect(Object.getOwnPropertyDescriptor(result, filteredSymbol)).toBeUndefined()

    expect(Object.prototype.propertyIsEnumerable.call(result, 'name')).toBe(true)
    expect(Object.prototype.propertyIsEnumerable.call(result, keptSymbol)).toBe(true)
    expect(Object.prototype.propertyIsEnumerable.call(result, 'age')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(result, 'secret')).toBe(false)
    expect(Object.prototype.propertyIsEnumerable.call(result, filteredSymbol)).toBe(false)
  })

  test('filters source own keys while reporting allowed properties as source-writable data descriptors', () => {
    const keptSymbol = Symbol('kept')
    const filteredSymbol = Symbol('filtered')
    let accessorValue = 1
    const source = {
      enumerableKept: 'visible',
      enumerableFiltered: 'hidden',
      [keptSymbol]: 'visible symbol',
      [filteredSymbol]: 'hidden symbol',
    } as {
      enumerableKept: string
      enumerableFiltered: string
      nonEnumerableKept: number
      nonEnumerableFiltered: number
      nonWritableKept: number
      nonConfigurableWritableKept?: number
      nonConfigurableFrozenKept?: number
      accessorKept: number
      accessorFiltered: number
      [keptSymbol]: string
      [filteredSymbol]: string
    }
    Object.defineProperties(source, {
      nonEnumerableKept: {
        value: 2,
        enumerable: false,
        configurable: true,
        writable: true,
      },
      nonEnumerableFiltered: {
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
      accessorFiltered: {
        get: () => 4,
        enumerable: true,
        configurable: true,
      },
    })

    const allowed = new Set<PropertyKey>([
      'enumerableKept',
      'nonEnumerableKept',
      'nonWritableKept',
      'nonConfigurableWritableKept',
      'nonConfigurableFrozenKept',
      'accessorKept',
      keptSymbol,
    ])
    const result = filterKeys(source, key => allowed.has(key))

    expect(Reflect.ownKeys(result)).toEqual(
      Reflect.ownKeys(source).filter(key => allowed.has(key)),
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

    expect(Object.getOwnPropertyDescriptor(result, 'enumerableKept')?.value).toBe('visible')
    expect(Object.getOwnPropertyDescriptor(result, 'nonEnumerableKept')?.value).toBe(2)
    expect(Object.getOwnPropertyDescriptor(result, 'nonWritableKept')?.value).toBe(4)
    expect(Object.getOwnPropertyDescriptor(result, 'nonConfigurableWritableKept')?.value).toBe(5)
    expect(Object.getOwnPropertyDescriptor(result, 'nonConfigurableFrozenKept')?.value).toBe(6)
    expect(Object.getOwnPropertyDescriptor(result, 'accessorKept')?.value).toBe(1)
    expect(Object.getOwnPropertyDescriptor(result, keptSymbol)?.value).toBe('visible symbol')

    expect(Object.getOwnPropertyDescriptor(result, 'enumerableFiltered')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, 'nonEnumerableFiltered')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, 'accessorFiltered')).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(result, filteredSymbol)).toBeUndefined()

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

  test('routes mutating operations for allowed keys to the source object', () => {
    const keptSymbol = Symbol('kept')
    const filteredSymbol = Symbol('filtered')
    const source = {
      name: 'Ada' as string | undefined,
      age: 36,
      active: true,
      [keptSymbol]: 'visible',
      [filteredSymbol]: 'hidden',
    }
    const allowed = new Set<PropertyKey>(['name', 'active', keptSymbol])
    const result = filterKeys(source, key => allowed.has(key))

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
      ;(result as any)[filteredSymbol] = 'changed anyway'
    }).toThrow(TypeError)
    expect(source[filteredSymbol]).toBe('hidden')
    expect(filteredSymbol in result).toBe(false)

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
      Object.defineProperty(result, filteredSymbol, {
        value: 'changed anyway',
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }).toThrow(TypeError)
    expect(source[filteredSymbol]).toBe('hidden')
    expect(filteredSymbol in result).toBe(false)

    expect(() => {
      delete (result as any).age
    }).toThrow(TypeError)
    expect(source.age).toBe(36)

    expect(() => {
      delete (result as any)[filteredSymbol]
    }).toThrow(TypeError)
    expect(source[filteredSymbol]).toBe('hidden')
  })

  test('delegates prototype access and mutation to the source object', () => {
    class Original {
      name = 'Ada'
      age = 36
    }
    class Next {}

    const source = new Original()
    const result = filterKeys(source, key => key === 'name')

    expect(Object.getPrototypeOf(result)).toBe(Object.getPrototypeOf(source))
    expect(result).toBeInstanceOf(Original)

    expect(Object.setPrototypeOf(result, Next.prototype)).toBe(result)
    expect(Object.getPrototypeOf(source)).toBe(Next.prototype)
    expect(Object.getPrototypeOf(result)).toBe(Next.prototype)
    expect(result).toBeInstanceOf(Next)
    expect(result).not.toBeInstanceOf(Original)
  })

  test('preserves callability for function sources and calls the source function', () => {
    const calls: string[] = []
    const source = Object.assign(function source(value: string) {
      calls.push(value)
      return `called ${value}`
    }, {
      selected: 'visible',
      filtered: 'hidden',
    })
    const result = filterKeys(source, key => key === 'selected')

    expect(typeof result).toBe('function')
    expect(result.selected).toBe('visible')
    expect('filtered' in result).toBe(false)

    const callResult = result('input')

    expect(calls).toEqual(['input'])
    expect(callResult).toBe('called input')
  })

  test('treats missing keys according to whether they are allowed', () => {
    const source: {
      present: string
      missing?: number
      filteredExisting: boolean
      filteredMissing?: string
    } = {
      present: 'value',
      filteredExisting: true,
    }
    const allowed = new Set<PropertyKey>(['present', 'missing'])
    const result = filterKeys(source, key => allowed.has(key))

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

    expect((result as any).filteredMissing).toBeUndefined()
    expect('filteredMissing' in result).toBe(false)
    expect(Object.getOwnPropertyDescriptor(result, 'filteredMissing')).toBeUndefined()

    expect(() => {
      ;(result as any).filteredMissing = 'nope'
    }).toThrow(TypeError)
    expect('filteredMissing' in source).toBe(false)

    expect(() => {
      delete (result as any).filteredExisting
    }).toThrow(TypeError)
    expect(source.filteredExisting).toBe(true)
  })
})
