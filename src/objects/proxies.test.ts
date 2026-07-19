import { assert, test } from 'vitest'
import { assertGarbageCollected } from '../assert-garbage-collected'
import { filterKeys } from './filterKeys'
import { merge } from './merge'
import { objectFromAccessor } from './object-from-accessor'

const utilities = {
  objectFromAccessor: <T extends object>(source: T) => objectFromAccessor(() => source),
  filterKeys: <T extends object>(source: T) => filterKeys(source, () => true),
  merge: <T extends object>(source: T) => merge(source),
}

for (const [name, create] of Object.entries(utilities)) {
  test(`${name} reports source properties as proxy-compatible data descriptors`, () => {
    let accessorValue = 4
    const source = {
      writableData: 1,
      enumerableData: 6,
    } as {
      writableData: number
      readonlyData: number
      getterOnly: number
      getterSetter: number
      nonConfigurableWritable: number
      nonConfigurableReadonly: number
      enumerableData: number
      nonEnumerableData: number
    }

    Object.defineProperties(source, {
      readonlyData: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: 2,
      },
      getterOnly: {
        configurable: true,
        enumerable: true,
        get: () => 3,
      },
      getterSetter: {
        configurable: true,
        enumerable: true,
        get: () => accessorValue,
        set: value => {
          accessorValue = value
        },
      },
      nonConfigurableWritable: {
        configurable: false,
        enumerable: true,
        writable: true,
        value: 5,
      },
      nonConfigurableReadonly: {
        configurable: false,
        enumerable: true,
        writable: false,
        value: 6,
      },
      nonEnumerableData: {
        configurable: true,
        enumerable: false,
        writable: true,
        value: 7,
      },
    })

    const view = create(source)

    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(view, 'writableData'), {
      configurable: true,
      enumerable: true,
      writable: true,
      value: 1,
    })
    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(view, 'readonlyData'), {
      configurable: true,
      enumerable: true,
      writable: false,
      value: 2,
    })
    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(view, 'getterOnly'), {
      configurable: true,
      enumerable: true,
      writable: false,
      value: 3,
    })
    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(view, 'getterSetter'), {
      configurable: true,
      enumerable: true,
      writable: true,
      value: 4,
    })
    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(view, 'nonConfigurableWritable'), {
      configurable: true,
      enumerable: true,
      writable: true,
      value: 5,
    })
    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(view, 'nonConfigurableReadonly'), {
      configurable: true,
      enumerable: true,
      writable: false,
      value: 6,
    })
    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(view, 'nonEnumerableData'), {
      configurable: true,
      enumerable: false,
      writable: true,
      value: 7,
    })
  })

  test(`${name} exposes data-property methods as stable live wrappers`, () => {
    const source = {
      count: 1,
      increment(step = 1) {
        this.count += step
        return this.count
      },
    } as any
    const view = create(source)
    const increment = view.increment

    assert.strictEqual(view.increment, increment)
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view, 'increment')?.value, increment)
    assert.notStrictEqual(increment, source.increment)

    assert.strictEqual(increment(2), 3)
    assert.strictEqual(source.count, 3)

    source.increment = function (step = 1) {
      this.count += step * 10
      return this.count
    }

    assert.strictEqual(view.increment, increment)
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view, 'increment')?.value, increment)
    assert.strictEqual(increment(2), 23)
    assert.strictEqual(source.count, 23)

    source.increment = 1

    assert.strictEqual((view as any).increment, 1)
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view, 'increment')?.value, 1)
    assert.throws(() => increment(), TypeError)
  })

  test(`${name} exposes accessor-returned methods as stable live wrappers`, () => {
    let implementation = function (this: { count: number }, step = 1) {
      this.count += step
      return this.count
    } as any
    const source = {
      count: 1,
      get increment() {
        return implementation
      },
    }
    const view = create(source)
    const increment = view.increment

    assert.strictEqual(view.increment, increment)
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view, 'increment')?.value, increment)
    assert.notStrictEqual(increment, implementation)

    assert.strictEqual(increment(2), 3)
    assert.strictEqual(source.count, 3)

    implementation = function (this: { count: number }, step = 1) {
      this.count += step * 10
      return this.count
    }

    assert.strictEqual(view.increment, increment)
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view, 'increment')?.value, increment)
    assert.strictEqual(increment(2), 23)
    assert.strictEqual(source.count, 23)

    implementation = 1

    assert.strictEqual((view as any).increment, 1)
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view, 'increment')?.value, 1)
    assert.throws(() => increment(), TypeError)
  })

  test(`${name} retains entries on wrapped methods`, () => {
    const symbol = Symbol()
    // @ts-expect-error
    const fn = function () { return this.a }
    const action = Object.assign(function (amount: number) {
      return amount * 2
    }, {
      a: 100,
      [symbol]: 'chips',
      fn,
    })
    const source = { action }
    const view = create(source)

    assert.notStrictEqual(view.action, source.action)
    assert.strictEqual(view.action.a, 100)
    assert.strictEqual(view.action[symbol], 'chips')
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view.action, 'prototype')?.configurable, false)

    const wrappedFn = view.action.fn
    assert.notStrictEqual(wrappedFn, fn)
    assert.strictEqual(wrappedFn(), 100)

    action.fn = function (this: { a: number }) {
      return this.a * 2
    }

    assert.strictEqual(view.action.fn, wrappedFn)
    assert.strictEqual(wrappedFn(), 200)

    const entries = Object.entries(view.action)
    assert.deepStrictEqual(entries.map(([key]) => key), ['a', 'fn'])
    assert.strictEqual(entries[1]?.[1], wrappedFn)

    assert.strictEqual(view.action(50), 100)
  })

  test(`${name} retains wrapped method identity after switching to non-function and back`, () => {
    const source = {
      count: 1,
      increment(step = 1) {
        this.count += step
        return this.count
      },
    } as any
    const view = create(source)
    const increment = view.increment

    source.increment = 1

    assert.strictEqual(view.increment, 1)

    source.increment = function (step = 1) {
      this.count += step * 10
      return this.count
    }

    assert.strictEqual(view.increment, increment)
    assert.strictEqual(increment(2), 21)
  })

  test(`${name} can get prototype properties`, () => {
    class Source {
      count = 1

      get doubled() {
        return this.count * 2
      }

      increment(step = 1) {
        this.count += step
        return this.count
      }
    }

    const source = new Source
    const view = create(source)
    const increment = view.increment

    assert.strictEqual(view.doubled, 2)
    assert.strictEqual(increment(2), 3)
    assert.strictEqual(source.count, 3)
    assert.strictEqual(view.doubled, 6)
    assert.isTrue('doubled' in view)
    assert.isTrue('increment' in view)
  })

  test(`${name} does not report prototype properties as own properties`, () => {
    class Source {
      own = 1

      get inheritedGetter() {
        return 2
      }

      inheritedMethod() {
        return 3
      }
    }

    const view = create(new Source)

    assert.deepStrictEqual(Object.keys(view), ['own'])
    assert.deepStrictEqual(Reflect.ownKeys(view), ['own'])
    assert.isUndefined(Reflect.getOwnPropertyDescriptor(view, 'inheritedGetter'))
    assert.isUndefined(Reflect.getOwnPropertyDescriptor(view, 'inheritedMethod'))
  })

  test(`${name} reads source accessors on access`, () => {
    let value = 1
    const source = {
      get value() {
        return value
      },
    }

    const view = create(source)

    assert.strictEqual(view.value, 1)

    value = 2

    assert.strictEqual(view.value, 2)
  })

  test(`${name} releases proxy while extracted wrapped method remains referenced`, async () => {
    const source = {
      method() {},
    }
    let view: { method: () => void } | undefined = create(source)
    let method: (() => void) | undefined = view.method
    const proxyCollected = assertGarbageCollected(view)

    view = undefined

    await proxyCollected
    method = undefined
  })

  test(`${name} releases source method while extracted wrapped method remains referenced`, async () => {
    let sourceMethod: (() => string) | undefined = function sourceMethod() {
      return 'old'
    }
    const source = {
      method: sourceMethod,
    }
    const view = create(source)
    const method = view.method
    const methodCollected = assertGarbageCollected(sourceMethod)

    source.method = function replacement() {
      return 'new'
    }
    sourceMethod = undefined

    assert.strictEqual(method(), 'new')

    await methodCollected
  })
}

const callableUtilities = {
  objectFromAccessor: <T extends Function>(source: T) => objectFromAccessor(() => source),
  filterKeys: <T extends Function>(source: T) => filterKeys(source, () => true),
}

for (const [name, create] of Object.entries(callableUtilities)) {
  test(`${name} supports callable source function own property introspection`, () => {
    const symbol = Symbol()
    const source = Object.assign(function action(amount: number) {
      return amount * 2
    }, {
      a: 100,
      [symbol]: 'chips',
    })
    const view = create(source)

    assert.notStrictEqual(view, source)
    assert.strictEqual(view.a, 100)
    assert.strictEqual(view[symbol], 'chips')
    assert.strictEqual(Reflect.getOwnPropertyDescriptor(view, 'prototype')?.configurable, false)
    assert.deepStrictEqual(Object.entries(view), [
      ['a', 100],
    ])
    assert.strictEqual(view(50), 100)
  })
}
