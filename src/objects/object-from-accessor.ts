
export const objectFromAccessor = <T extends object>(accessor: () => T) =>
  new Proxy({} as T, {
    get: (_target, key) => accessor()[key as keyof T],
    set: (_target, key, value) => {
      accessor()[key as keyof T] = value
      return true
    },
    has: (_target, key) => key in accessor(),
    ownKeys: () => Reflect.ownKeys(accessor()),
    getOwnPropertyDescriptor: (_target, key) =>
      Object.getOwnPropertyDescriptor(accessor(), key),
    deleteProperty: (_target, key) => Reflect.deleteProperty(accessor(), key),
    defineProperty: (_target, key, descriptor) =>
      Reflect.defineProperty(accessor(), key, descriptor),
  })
