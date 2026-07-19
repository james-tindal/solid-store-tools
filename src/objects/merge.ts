
import {
  dataDescriptorFrom,
  isSolidStoreMetadataKey,
  ownKeysWithLocalMetadata,
  solidStoreMetadataDefineProperty,
  solidStoreMetadataDeleteProperty,
  solidStoreMetadataGet,
  solidStoreMetadataGetOwnPropertyDescriptor,
  solidStoreMetadataHas,
  solidStoreMetadataSet,
  withoutSolidStoreMetadataKeys,
} from './private-helpers'
import { WrappedMethods } from './wrapped-methods'

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
  const wrappedMethods = new WrappedMethods(key => {
    const source = findSource(objects, key)
    return {
      object: source!,
      method: Reflect.get(source!, key, source!) as Function,
    }
  })

  function descriptorFor(source: object, key: string | symbol) {
    const descriptor = dataDescriptorFrom(source, key)
    if (!descriptor) return

    return {
      ...descriptor,
      value: wrappedMethods.get(key, descriptor.value),
    }
  }

  function read(key: string | symbol) {
    const source = findSource(objects, key)
    if (!source) return undefined

    return wrappedMethods.get(key, Reflect.get(source, key, source))
  }

  function findWriteSource(key: string | symbol) {
    return findSource(objects, key) ?? objects.at(-1)
  }

  return new Proxy({}, {
    get(target, key, receiver) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataGet(target, key)

      if (Reflect.has(target, key))
        return Reflect.get(target, key, receiver)
      else
        return read(key)
    },
    has(target, key) {
      return isSolidStoreMetadataKey(key)
        ? solidStoreMetadataHas(target, key)
        : key in target || findSource(objects, key) !== undefined
    },
    ownKeys(target) {
      return ownKeysWithLocalMetadata(getMergedPropertyKeys(objects), target)
    },
    getOwnPropertyDescriptor(target, key) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataGetOwnPropertyDescriptor(target, key)

      const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, key)
      if (targetDescriptor && !targetDescriptor.configurable)
        return targetDescriptor

      const source = findSource(objects, key)
      if (!source) return undefined

      return descriptorFor(source, key)
    },
    set(target, key, value) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataSet(target, key, value)

      const source = findWriteSource(key)
      return source
        ? Reflect.set(source, key, value, source)
        : false
    },
    defineProperty(target, key, descriptor) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataDefineProperty(target, key, descriptor)

      const source = findWriteSource(key)
      return source
        ? Reflect.defineProperty(source, key, descriptor)
        : false
    },
    deleteProperty(target, key) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataDeleteProperty(target, key)

      const source = findSource(objects, key)
      return source
        ? Reflect.deleteProperty(source, key)
        : true
    },
    setPrototypeOf: () => false,
    preventExtensions: () => false,
  }) as MergeObjects<T>
}

function findSource(objects: readonly object[], key: string | symbol) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i]!
    if (key in object)
      return object
  }
}

const getMergedPropertyKeys = (objects: readonly object[]) =>
  dedupe(objects.flatMap(getPropertyKeys))

const getPropertyKeys = (object: object) =>
  withoutSolidStoreMetadataKeys(Reflect.ownKeys(object))

type UnwrapIterable<T extends Iterable<any>> = T extends Iterable<infer X> ? X : never
const dedupe = <T extends Iterable<any>>(xs: T) => [...new Set<UnwrapIterable<T>>(xs)]
