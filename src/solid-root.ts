import { createRoot, Owner } from 'solid-js'
import { RootFunction } from 'solid-js/types/reactive/signal.js'


/**
 * Runs `fn` inside a Solid root and stores the root disposer.
 *
 * Call `testRoot.dispose()` from afterEach to dispose all roots created with
 * `testRoot` during the test. Not compatible with vitest test.concurrent.
 */
export const testRoot = <T>(fn: RootFunction<T>, detachedOwner?: typeof Owner): T =>
  createRoot(dispose => {
    testRoot.disposers.push(dispose)
    return fn(dispose)
  }, detachedOwner)

testRoot.disposers = [] as (() => void)[]
testRoot.dispose = () => {
  let dispose
  while (dispose = testRoot.disposers.pop())
    dispose()
}
