
type Simplify<T> = { [K in keyof T]: T[K] } & {}

type OptionalKeys<T extends object> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

type MergeValue<Left extends object, Right extends object, Key extends keyof Left | keyof Right> =
  Key extends keyof Right
    ? Key extends OptionalKeys<Right>
      ? Right[Key] | (Key extends keyof Left ? Left[Key] : never)
      : Right[Key]
    : Key extends keyof Left
      ? Left[Key]
      : never

type MergeTwo<Left extends object, Right extends object> =
  Left extends unknown
    ? Right extends unknown
      ? Simplify<{
          [Key in keyof Left | keyof Right]: MergeValue<Left, Right, Key>
        }>
      : never
    : never

type MergeObjects<T extends readonly object[]> =
  T extends readonly [infer Only extends object]
    ? Only
    : T extends readonly [infer Head extends object, ...infer Tail extends object[]]
      ? MergeTwo<Head, MergeObjects<Tail>>
    : {}

export function merge<const T extends readonly object[]>(...objects: T): MergeObjects<T> {
  return new Proxy({}, {
    get(_, key) {
      const source = findSource(objects, key)
      if (!source) return undefined

      const value = (source as any)[key]
      if (typeof value === 'function')
        return Object.assign(value.bind(source), value)
      return value
    },
    has(_, key) {
      return findSource(objects, key) !== undefined
    },
    ownKeys() {
      return getMergedPropertyKeys(objects)
    },
    getOwnPropertyDescriptor(_, key) {
      if (!findSource(objects, key)) return undefined

      return {
        enumerable: true,
        configurable: true,
      }
    },
  }) as MergeObjects<T>
}

const findSource = (objects: readonly object[], key: string | symbol) => {
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i]!
    if (getPropertyKeys(object).includes(key))
      return object
  }
}

const getMergedPropertyKeys = (objects: readonly object[]) => {
  const keys: (string | symbol)[] = []
  const seen = new Set<string | symbol>()

  for (const object of objects) {
    for (const key of getPropertyKeys(object)) {
      if (seen.has(key)) continue

      seen.add(key)
      keys.push(key)
    }
  }

  return keys
}

const getPropertyKeys = (object: object) => {
  const keys: (string | symbol)[] = []
  const seen = new Set<string | symbol>()

  for (let current: object | null = object; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
    for (const key of Reflect.ownKeys(current)) {
      if (key === 'constructor') continue
      if (seen.has(key)) continue

      seen.add(key)
      keys.push(key)
    }
  }

  return keys
}
