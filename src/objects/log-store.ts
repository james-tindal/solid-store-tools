import { createComputed, createRoot, on, onCleanup } from 'solid-js'

export type LogStoreEvent =
| {
    type: 'add'
    path: PropertyKey[]
    value: unknown
  }
| {
    type: 'delete'
    path: PropertyKey[]
    previous: unknown
  }
| {
    type: 'set'
    path: PropertyKey[]
    previous: unknown
    value: unknown
  }

export type LogStoreFilter = (event: LogStoreEvent) => boolean

type WatchedObject = Record<PropertyKey, unknown>

export function logStore<T extends object>(
  store: T,
  filter?: LogStoreFilter,
): T {
  watchObject(store as WatchedObject, [], filter)
  return store
}

function watchObject(
  object: WatchedObject,
  path: PropertyKey[],
  filter: LogStoreFilter | undefined,
) {
  const previous = new Map<PropertyKey, unknown>()
  const childDisposers = new Map<PropertyKey, () => void>()

  for (const key of objectKeys(object)) {
    const value = object[key]
    previous.set(key, value)
    watchChild(key, value)
  }

  createComputed(on(
    () => Reflect.ownKeys(object),
    () => {
      const currentKeys = new Set(objectKeys(object))

      for (const key of currentKeys) {
        const value = object[key]

        if (!previous.has(key)) {
          previous.set(key, value)
          watchChild(key, value)
          emit({ type: 'add', path: [...path, pathKey(object, key)], value }, filter)
          continue
        }

        const oldValue = previous.get(key)
        if (Object.is(oldValue, value)) continue

        previous.set(key, value)
        unwatchChild(key)
        watchChild(key, value)
        emit({ type: 'set', path: [...path, pathKey(object, key)], previous: oldValue, value }, filter)
      }

      for (const [key, oldValue] of previous) {
        if (currentKeys.has(key as any)) continue

        previous.delete(key)
        unwatchChild(key)
        emit({ type: 'delete', path: [...path, pathKey(object, key)], previous: oldValue }, filter)
      }
    },
    { defer: true },
  ))

  onCleanup(() => {
    for (const dispose of childDisposers.values())
      dispose()
  })

  function watchChild(key: PropertyKey, value: unknown) {
    if (!isWatchableObject(value)) return

    const dispose = createRoot(dispose => {
      watchObject(value, [...path, pathKey(object, key)], filter)
      return dispose
    })
    childDisposers.set(key, dispose)
  }

  function unwatchChild(key: PropertyKey) {
    childDisposers.get(key)?.()
    childDisposers.delete(key)
  }
}

function emit(event: LogStoreEvent, filter: LogStoreFilter | undefined) {
  if (filter && !filter(event)) return
  console.log(event)
}

function isWatchableObject(value: unknown): value is WatchedObject {
  return typeof value === 'object' && value !== null
}

function objectKeys(object: WatchedObject) {
  return Reflect.ownKeys(object)
    .filter(key => Object.prototype.propertyIsEnumerable.call(object, key))
}

function pathKey(object: WatchedObject, key: PropertyKey) {
  return Array.isArray(object) && isArrayIndexKey(key)
    ? Number(key)
    : key
}

function isArrayIndexKey(key: PropertyKey) {
  if (typeof key !== 'string') return false

  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && String(index) === key
}
