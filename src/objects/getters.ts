
// Converts nullary function entries into getter properties.
// Recurses into non-array object entries.
// Arrays and non-nullary functions are retained as values.
export function getters<const T extends object>(spec: T): DeriveObject<T> {
  return Object.defineProperties(
    {},
    Object.fromEntries(
      Object.keys(spec).map(key => [
        key,
        {
          enumerable: true,
          configurable: true,
          get: () => deriveEntry(Reflect.get(spec, key)),
        },
      ])
    )
  ) as DeriveObject<T>
}

function deriveEntry(value: unknown): unknown {
  if (isAccessor(value))
    return value()

  if (isNonArrayObject(value))
    return getters(value)

  return value
}

function isAccessor(value: unknown): value is () => unknown {
  return typeof value === 'function' && value.length === 0
}

function isNonArrayObject(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !(value instanceof Array)
}

type DeriveObject<T> =
  T extends (...args: infer Args) => infer R ? Args extends [] ? R : T :
  T extends readonly unknown[] ? T :
  T extends object ? { readonly [K in keyof T]: DeriveObject<T[K]> } :
  T
