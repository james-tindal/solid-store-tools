import { describe, it, expect, expectTypeOf } from 'vitest'
import { objectFromAccessor } from './object-from-accessor'

describe('objectFromAccessor', () => {
  it('returns a proxy typed as the object returned by the accessor', () => {
    const proxy = objectFromAccessor(() => ({
      label: 'current',
      count: 3,
      nested: {
        enabled: true,
      },
    }))

    expectTypeOf(proxy).toEqualTypeOf<{
      label: string
      count: number
      nested: {
        enabled: boolean
      }
    }>()
  })

  it('calls the accessor for each property read', () => {
    let calls = 0
    const proxy = objectFromAccessor(() => {
      calls += 1

      return {
        first: 'one',
        second: 'two',
      }
    })

    expect(proxy.first).toBe('one')
    expect(proxy.second).toBe('two')
    expect(calls).toBe(2)
  })

  it('reads from the latest object returned by the accessor', () => {
    let current = { value: 'initial' }
    const proxy = objectFromAccessor(() => current)

    expect(proxy.value).toBe('initial')

    current = { value: 'updated' }

    expect(proxy.value).toBe('updated')
  })

  it('writes to the latest object returned by the accessor', () => {
    let current = { value: 'initial' }
    const proxy = objectFromAccessor(() => current)

    proxy.value = 'updated'

    expect(current.value).toBe('updated')

    current = { value: 'next' }
    proxy.value = 'latest'

    expect(current.value).toBe('latest')
  })

  it('checks keys on the latest object returned by the accessor', () => {
    let current = { value: 'initial' } as any
    const proxy = objectFromAccessor(() => current)

    expect('value' in proxy).toBe(true)
    expect('next' in proxy).toBe(false)

    current = { next: 'updated' }

    expect('value' in proxy).toBe(false)
    expect('next' in proxy).toBe(true)
  })

  it('enumerates keys from the latest object returned by the accessor', () => {
    let current = { first: 1 } as any
    const proxy = objectFromAccessor(() => current)

    expect(Reflect.ownKeys(proxy)).toEqual(['first'])

    current = { second: 2 }

    expect(Reflect.ownKeys(proxy)).toEqual(['second'])
  })

  it('gets property descriptors from the latest object returned by the accessor', () => {
    let current = {}
    const proxy = objectFromAccessor(() => current)

    Object.defineProperty(current, 'value', {
      configurable: true,
      enumerable: true,
      value: 'initial',
    })

    expect(Object.getOwnPropertyDescriptor(proxy, 'value')).toEqual(
      Object.getOwnPropertyDescriptor(current, 'value'),
    )

    current = {}
    Object.defineProperty(current, 'value', {
      configurable: true,
      enumerable: false,
      value: 'updated',
    })

    expect(Object.getOwnPropertyDescriptor(proxy, 'value')).toEqual(
      Object.getOwnPropertyDescriptor(current, 'value'),
    )
  })

  it('deletes properties from the latest object returned by the accessor', () => {
    let current = { value: 'initial' } as any
    const proxy = objectFromAccessor(() => current)

    expect(delete proxy.value).toBe(true)
    expect('value' in current).toBe(false)

    current = { value: 'updated' }

    expect(delete proxy.value).toBe(true)
    expect('value' in current).toBe(false)
  })

  it('defines properties on the latest object returned by the accessor', () => {
    let current = {}
    const proxy = objectFromAccessor(() => current)

    Object.defineProperty(proxy, 'value', {
      configurable: true,
      enumerable: true,
      value: 'initial',
    })

    expect(Object.getOwnPropertyDescriptor(current, 'value')).toEqual({
      configurable: true,
      enumerable: true,
      value: 'initial',
      writable: false,
    })

    current = {}
    Object.defineProperty(proxy, 'value', {
      configurable: true,
      enumerable: false,
      value: 'updated',
    })

    expect(Object.getOwnPropertyDescriptor(current, 'value')).toEqual({
      configurable: true,
      enumerable: false,
      value: 'updated',
      writable: false,
    })
  })

  it('reads symbol keys from the object returned by the accessor', () => {
    const key = Symbol('key')

    const proxy = objectFromAccessor(() => ({
      [key]: 'symbol value',
    }))

    expect(proxy[key]).toBe('symbol value')
  })
})
