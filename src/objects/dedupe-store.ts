import { createComputed } from 'solid-js'
import { createStore, reconcile, type ReconcileOptions } from 'solid-js/store'
import { isSolidStoreMetadataKey } from './private-helpers'

export function dedupeStore<T extends object>(object: T, options?: ReconcileOptions): T {
  const [store, setStore] = createStore(snapshot(object))

  createComputed(() => {
    setStore(reconcile(snapshot(object), options))
  })

  return store as T
}

function snapshot(object: object) {
  const copy: Record<PropertyKey, unknown> = {}

  for (const key of Reflect.ownKeys(object)) {
    if (isSolidStoreMetadataKey(key)) continue
    copy[key] = Reflect.get(object, key, object)
  }

  return copy
}
