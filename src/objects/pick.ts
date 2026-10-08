
import { filterKeys } from './filterKeys'

type KeysOfUnion<T> = T extends unknown ? keyof T : never

type Expand<T> = T extends unknown ? { [K in keyof T]: T[K] } : never

type PickUnion<T, K extends PropertyKey> =
  T extends unknown ? Expand<Pick<T, Extract<K, keyof T>>> : never

type PickResult<T, K extends PropertyKey> =
  T extends (...args: infer A) => infer R
    ? ((...args: A) => R) & PickUnion<T, K>
    : PickUnion<T, K>

export function pick<T extends object, const K extends readonly KeysOfUnion<T>[]>(object: T, keys: K): PickResult<T, K[number]>
export function pick<T extends object, const K extends readonly (keyof T)[]>(object: T, keys: K): Pick<T, K[number]>
export function pick<T extends object, const K extends readonly KeysOfUnion<T>[]>(object: T, keys: K): PickResult<T, K[number]> {
  const selected = new Set<PropertyKey>(keys.map(key => typeof key === 'number' ? String(key) : key))
  return filterKeys(object, key => selected.has(key)) as unknown as PickResult<T, K[number]>
}
