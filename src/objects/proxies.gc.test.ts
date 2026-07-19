import { assert } from 'vitest'
import { test, runTests } from '../test-garbage-collected'
import { filterKeys } from './filterKeys'
import { merge } from './merge'
import { objectFromAccessor } from './object-from-accessor'

const utilities = {
  objectFromAccessor: <T extends object>(source: T) => objectFromAccessor(() => source),
  filterKeys: <T extends object>(source: T) => filterKeys(source, () => true),
  merge: <T extends object>(source: T) => merge(source),
}

for (const [name, create] of Object.entries(utilities)) {
  test(`${name} releases proxy while extracted wrapped method remains referenced`, () => {
    const source = {
      method() {},
    }
    let view: { method: () => void } | undefined = create(source)
    const method: (() => void) | undefined = view.method
    const target = view

    view = undefined

    return { target, retain: method }
  })

  test(`${name} releases source method while extracted wrapped method remains referenced`, () => {
    let sourceMethod: (() => string) | undefined = function sourceMethod() {
      return 'old'
    }
    const source = {
      method: sourceMethod,
    }
    const view = create(source)
    const method = view.method
    const target = sourceMethod

    source.method = function replacement() {
      return 'new'
    }
    sourceMethod = undefined

    assert.strictEqual(method(), 'new')

    return { target, retain: method }
  })
}

runTests('proxy utilities release garbage')
