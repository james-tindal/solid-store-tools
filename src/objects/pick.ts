
import { filterKeys } from './filterKeys'

type KeysOfUnion<T> = T extends unknown ? keyof T : never

type Expand<T> = T extends unknown ? { [K in keyof T]: T[K] } : never

type PickUnion<T, K extends PropertyKey> =
  T extends unknown ? Expand<Pick<T, Extract<K, keyof T>>> : never

type PickResult<T, K extends PropertyKey> =
  T extends (...args: infer A) => infer R
    ? ((...args: A) => R) & PickUnion<T, K>
    : PickUnion<T, K>

export function pickAccessor<T extends object, const K extends readonly KeysOfUnion<T>[]>(accessor: () => T, keys: K): PickResult<T, K[number]> {
  const selected = new Set<PropertyKey>(keys)
  return filterKeys(accessor, key => selected.has(key)) as unknown as PickResult<T, K[number]>
}

export const pickObject = <T extends object, const K extends readonly KeysOfUnion<T>[]>
  (object: T, keys: K): PickResult<T, K[number]> =>
    pickAccessor(() => object, keys)

type PickOverload = {
  <T extends object, const K extends KeysOfUnion<T>>
    (accessor: () => T, keys: readonly K[]): PickResult<T, K>
  <T extends object, const K extends KeysOfUnion<T>>
    (object: T, keys: readonly K[]): PickResult<T, K>
}

export const pick: PickOverload = (objectOrAccessor: any, keys: readonly PropertyKey[]) =>
  typeof objectOrAccessor === 'function' && objectOrAccessor.length === 0
    ? pickAccessor(objectOrAccessor, keys as any)
    : pickObject(objectOrAccessor, keys as any)
