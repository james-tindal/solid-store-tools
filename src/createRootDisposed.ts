import { createRoot, Owner } from 'solid-js'
import { RootFunction } from 'solid-js/types/reactive/signal.js'

/**
 * Runs `fn` inside a Solid root and disposes that root immediately after `fn`
 * returns.
 *
 * Useful in tests when reactive computations are created after an `await`,
 * where the original test root/owner no longer applies. Wrap the reactive
 * code in `disposedRoot` when you only need the computed result during the
 * callback and do not need its reactivity to continue afterward.
 */
export const createRootDisposed = <T>(fn: RootFunction<T>, detachedOwner?: typeof Owner) =>
  createRoot(dispose => {
    const output = fn(dispose)
    dispose()
    return output
  }, detachedOwner)

/**
 * Runs `fn` inside a Solid root and returns both its output and the disposer.
 *
 * Use this when reactive computations must be created synchronously under a
 * root, but need to remain alive across later test steps, awaits, timers, or
 * assertions. This does not make post-`await` reactive creation owned; create
 * the reactive graph inside `fn`, then call `dispose` when finished.
 */
export const createRootDisposeLater = <T>(fn: RootFunction<T>, detachedOwner?: typeof Owner) =>
  createRoot(dispose => ({
    output: fn(dispose),
    dispose,
  }), detachedOwner)
