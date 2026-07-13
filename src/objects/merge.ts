
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
  const wrapMethod = (key: string | symbol, value: Function) =>
    Object.assign(function (...args: unknown[]) {
      const source = findSource(objects, key)
      const currentValue = source && Reflect.get(source, key, source)
      return Reflect.apply(currentValue as any, source, args)
    }, value)

  function read(key: string | symbol) {
    const source = findSource(objects, key)
    if (!source) return undefined

    const value = (source as any)[key]
    if (typeof value === 'function')
      return wrapMethod(key, value)
    return value
  }

  return new Proxy({}, {
    get(target, key, receiver) {
      if (Reflect.has(target, key))
        return Reflect.get(target, key, receiver)
      else
        return read(key)
    },
    has(target, key) {
      return key in target || findSource(objects, key) !== undefined
    },
    ownKeys(target) {
      return dedupe([...Reflect.ownKeys(target), ...getMergedPropertyKeys(objects)])
    },
    getOwnPropertyDescriptor(target, key) {
      const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, key)
      if (targetDescriptor && !targetDescriptor.configurable)
        return targetDescriptor

      if (!findSource(objects, key)) return undefined

      return {
        enumerable: true,
        configurable: true,
        get: () => read(key),
      }
    },
  }) as MergeObjects<T>
}

function findSource(objects: readonly object[], key: string | symbol) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i]!
    if (getPropertyKeys(object).includes(key))
      return object
  }
}

const getMergedPropertyKeys = (objects: readonly object[]) =>
  dedupe(objects.flatMap(getPropertyKeys))

const getPropertyKeys = (object: object) =>
  dedupe(
    walkPrototypeChain(object)
      .flatMap(Reflect.ownKeys)
  ).filter(key => key !== 'constructor')

function* walkPrototypeChain(object: object) {
  for (
    let current: object | null = object;
    current && current !== Object.prototype;
    current = Object.getPrototypeOf(current)
  )
    yield current
}

type UnwrapIterable<T extends Iterable<any>> = T extends Iterable<infer X> ? X : never
const dedupe = <T extends Iterable<any>>(xs: T) => [...new Set<UnwrapIterable<T>>(xs)]
