
export const pickAccessor = <T extends object, const K extends readonly (keyof T)[]>
  (accessor: () => T, keys: K): Pick<T, K[number]> =>
    Object.defineProperties(
      {},
      Object.fromEntries(
        keys.map(key => [
          key,
          {
            enumerable: true,
            configurable: true,
            get: () => {
              const object = accessor()
              const value = object[key]
              return typeof value === 'function' ? value.bind(object) : value
            },
          },
        ])
      )
    ) as Pick<T, K[number]>

export const pickObject = <T extends object, const K extends readonly (keyof T)[]>
  (object: T, keys: K): Pick<T, K[number]> =>
    pickAccessor(() => object, keys)

type PickOverload = {
  <T extends object, const K extends readonly (keyof T)[]>
    (accessor: () => T, keys: K): Pick<T, K[number]>
  <T extends object, const K extends readonly (keyof T)[]>
    (object: T, keys: K): Pick<T, K[number]>
}

export const pick: PickOverload = (objectOrAccessor: any, keys: readonly PropertyKey[]) =>
  typeof objectOrAccessor === 'function'
    ? pickAccessor(objectOrAccessor, keys as any)
    : pickObject(objectOrAccessor, keys as any)
