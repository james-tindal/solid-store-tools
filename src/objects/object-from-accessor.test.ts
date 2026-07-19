import { describe, it, expect, expectTypeOf } from 'vitest'
import { createSignal } from 'solid-js'
import { assertGarbageCollected } from '../assert-garbage-collected'
import { objectFromAccessor } from './object-from-accessor'
import { createRootDisposed } from '../createRootDisposed'

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
    expect(calls).toBe(3)
  })

  it('reads from the latest object returned by the accessor', () => {
    let current = { value: 'initial' }
    const proxy = objectFromAccessor(() => current)

    expect(proxy.value).toBe('initial')

    current = { value: 'updated' }

    expect(proxy.value).toBe('updated')
  })

  it('releases previously returned objects while a wrapped method remains alive', async () => {
    let current = {
      method() {
        return 'old'
      },
    }
    let previous: typeof current | undefined = current
    const proxy = objectFromAccessor(() => current)
    const method = proxy.method
    const collected = assertGarbageCollected(previous)

    current = {
      method() {
        return 'new'
      },
    }
    previous = undefined

    expect(method()).toBe('new')

    await collected
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

  it('reports source non-configurable descriptors as configurable proxy descriptors', () => {
    const current = {}
    const proxy = objectFromAccessor(() => current)

    Object.defineProperty(current, 'value', {
      configurable: false,
      enumerable: true,
      value: 'locked',
      writable: true,
    })

    expect(Object.getOwnPropertyDescriptor(proxy, 'value')).toEqual({
      configurable: true,
      enumerable: true,
      value: 'locked',
      writable: true,
    })
  })

  it('enumerates source non-configurable properties without proxy invariant errors', () => {
    const current = {}
    const proxy = objectFromAccessor(() => current)

    Object.defineProperty(current, 'value', {
      configurable: false,
      enumerable: true,
      value: 'locked',
      writable: true,
    })

    expect(Object.keys(proxy)).toEqual(['value'])
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

  it('array methods call the latest array returned by the accessor', () => {
    let current = [1, 2, 3]
    const proxy = objectFromAccessor(() => current)
    const map = proxy.map

    expect(proxy.map(value => value * 2)).toEqual([2, 4, 6])

    current = [10, 20]

    expect(proxy.map).toBe(map)
    expect(map(value => value + 1)).toEqual([11, 21])
  })

  it('prototype access and mutation use the current object returned by the accessor', () => {
    class First {
      name = 'Ada'
    }
    class Second {
      name = 'Grace'
    }
    class Next {}

    const first = new First()
    const second = new Second()
    let current: First | Second = first
    const proxy = objectFromAccessor(() => current)

    expect(Object.getPrototypeOf(proxy)).toBe(First.prototype)
    expect(proxy).toBeInstanceOf(First)

    current = second

    expect(Object.getPrototypeOf(proxy)).toBe(Second.prototype)
    expect(proxy).toBeInstanceOf(Second)

    expect(Object.setPrototypeOf(proxy, Next.prototype)).toBe(proxy)
    expect(Object.getPrototypeOf(first)).toBe(First.prototype)
    expect(Object.getPrototypeOf(second)).toBe(Next.prototype)
    expect(Object.getPrototypeOf(proxy)).toBe(Next.prototype)
  })

  it('previously read methods call the latest object returned by the accessor', () => {
    const first = {
      count: 1,
      increment(step = 1) {
        this.count += step
        return this.count
      },
    }
    const second = {
      count: 10,
      increment(step = 1) {
        this.count += step * 10
        return this.count
      },
    }
    let current = first
    const proxy = objectFromAccessor(() => current)
    const increment = proxy.increment

    expect(increment()).toBe(2)
    expect(first.count).toBe(2)

    current = second

    expect(proxy.increment).toBe(increment)
    expect(Object.getOwnPropertyDescriptor(proxy, 'increment')?.value).toBe(increment)
    expect(increment(2)).toBe(30)
    expect(second.count).toBe(30)
  })

  it('function calls use the latest function returned by the accessor', () => {
    const first = Object.assign(function first(value: string) {
      return `first ${value}`
    }, {
      label: 'first',
    })
    const second = Object.assign(function second(value: string) {
      return `second ${value}`
    }, {
      label: 'second',
    })
    let current = first
    const proxy = objectFromAccessor(() => current)

    expect(proxy('input')).toBe('first input')
    expect(proxy.label).toBe('first')

    current = second

    expect(proxy('input')).toBe('second input')
    expect(proxy.label).toBe('second')
  })

  it('works with Solid signals as accessors', () => {
    const first = {
      name: 'Ada',
    } as {
      name?: string
    }
    const second = {} as {
      name?: string
    }
    Object.defineProperty(second, 'name', {
      value: 'Grace',
      enumerable: false,
      configurable: true,
      writable: true,
    })
    const [source, setSource] = createRootDisposed(() => createSignal(first))
    const proxy = objectFromAccessor(source)

    expect(proxy.name).toBe('Ada')
    expect(Object.keys(proxy)).toEqual(['name'])
    expect(Object.getOwnPropertyDescriptor(proxy, 'name')).toEqual({
      value: 'Ada',
      writable: true,
      enumerable: true,
      configurable: true,
    })

    setSource(second)

    expect(proxy.name).toBe('Grace')
    expect(Object.keys(proxy)).toEqual([])
    expect(Object.getOwnPropertyNames(proxy)).toEqual(['name'])
    expect(Object.getOwnPropertyDescriptor(proxy, 'name')).toEqual({
      value: 'Grace',
      writable: true,
      enumerable: false,
      configurable: true,
    })

    proxy.name = 'Katherine'

    expect(first.name).toBe('Ada')
    expect(second.name).toBe('Katherine')
  })
})
