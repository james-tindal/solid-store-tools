import { pick } from './pick'

export const omitAccessor = <T extends object, const K extends readonly (keyof T)[]>
  (accessor: () => T, keys: K): Omit<T, K[number]> => {
    const omitted = new Set<PropertyKey>(keys)
    const pickedKeys = Object.keys(accessor())
      .filter(key => !omitted.has(key)) as Exclude<keyof T, K[number]>[]

    return pick(accessor, pickedKeys)
  }

export const omitObject = <T extends object, const K extends readonly (keyof T)[]>
  (object: T, keys: K): Omit<T, K[number]> =>
    omitAccessor(() => object, keys)

type OmitOverload = {
  <T extends object, const K extends readonly (keyof T)[]>
    (accessor: () => T, keys: K): Omit<T, K[number]>
  <T extends object, const K extends readonly (keyof T)[]>
    (object: T, keys: K): Omit<T, K[number]>
}

export const omit: OmitOverload = (objectOrAccessor: any, keys: readonly PropertyKey[]) =>
  typeof objectOrAccessor === 'function'
    ? omitAccessor(objectOrAccessor, keys as readonly never[])
    : omitObject(objectOrAccessor, keys as readonly never[])
