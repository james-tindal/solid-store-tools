import { filterKeys } from './filterKeys'

type KeysOfUnion<T> = T extends unknown ? keyof T : never

type Expand<T> = T extends unknown ? { [K in keyof T]: T[K] } : never

type OmitUnion<T, K extends PropertyKey> =
  T extends unknown ? Expand<Omit<T, Extract<K, keyof T>>> : never

type OmitResult<T, K extends PropertyKey> =
  T extends (...args: infer A) => infer R
    ? ((...args: A) => R) & OmitUnion<T, K>
    : OmitUnion<T, K>

export const omitAccessor = <T extends object, const K extends readonly KeysOfUnion<T>[]>
  (accessor: () => T, keys: K): OmitResult<T, K[number]> => {
    const omitted = new Set<PropertyKey>(keys)
    return filterKeys(accessor, key => !omitted.has(key)) as unknown as OmitResult<T, K[number]>
  }

export const omitObject = <T extends object, const K extends readonly KeysOfUnion<T>[]>
  (object: T, keys: K): OmitResult<T, K[number]> =>
    omitAccessor(() => object, keys)

type OmitOverload = {
  <T extends object, const K extends readonly KeysOfUnion<T>[]>
    (accessor: () => T, keys: K): OmitResult<T, K[number]>
  <T extends object, const K extends readonly KeysOfUnion<T>[]>
    (object: T, keys: K): OmitResult<T, K[number]>
}

export const omit: OmitOverload = (objectOrAccessor: any, keys: readonly PropertyKey[]) =>
  typeof objectOrAccessor === 'function' && objectOrAccessor.length === 0
    ? omitAccessor(objectOrAccessor, keys as readonly never[])
    : omitObject(objectOrAccessor, keys as readonly never[])
