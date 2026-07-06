
// Convert own functions to getters
// getters can be at top level of the object or in nested objects/arrays
// Non-function values are retained
export function getters<const T extends object>(spec: T): DeriveObject<T> {
  if (Array.isArray(spec))
    return spec.map(deriveEntry) as DeriveObject<T>

  return Object.defineProperties(
    {},
    Object.fromEntries(
      Object.entries(spec).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? { enumerable: true, configurable: true, get: value }
          : { enumerable: true, configurable: true, value: deriveEntry(value) },
      ])
    )
  ) as DeriveObject<T>
}

function deriveEntry(value: unknown): unknown {
  if (typeof value === 'function')
    return value()

  if (isPlainObjectOrArray(value))
    return getters(value)

  return value
}

function isPlainObjectOrArray(value: unknown): value is object {
  if (value === null || typeof value !== 'object') return false

  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === Array.prototype
}

type DerivedEntry = (...args: never[]) => unknown

type DeriveObject<T> =
  T extends DerivedEntry ? ReturnType<T> :
  T extends readonly (infer U)[]
    ? number extends T['length']
      ? Array<DeriveObject<U>>
      : { -readonly [K in keyof T]: DeriveObject<T[K]> }
    :
  T extends object ? { readonly [K in keyof T]: DeriveObject<T[K]> } :
  T
