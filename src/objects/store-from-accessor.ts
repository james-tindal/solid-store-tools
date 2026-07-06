import { createEffect } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'

export function storeFromAccessor<T extends object>(accessor: () => T): T {
  const [store, setStore] = createStore(accessor())
  createEffect(() => setStore(reconcile(accessor())))
  return store
}
