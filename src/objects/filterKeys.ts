export function filterKeys<T extends object>(accessor: () => T, allows: (key: PropertyKey, object: T) => boolean): T {
  const methodWrappers = new Map<PropertyKey, Function>()

  function getObject() {
    const object = accessor()
    if (object === null || (typeof object !== 'object' && typeof object !== 'function'))
      throw new TypeError(`pick/omit expected source to be an object, received ${JSON.stringify(object)}`)
    return object
  }

  function wrapMethod(key: PropertyKey, value: unknown) {
    if (typeof value !== 'function') return value

    const cached = methodWrappers.get(key)
    if (cached) return cached

    function wrapper(...args: unknown[]) {
      const currentObject = getObject()
      const currentValue = Reflect.get(currentObject, key, currentObject)
      return Reflect.apply(currentValue as any, currentObject, args)
    }
    methodWrappers.set(key, wrapper)
    return wrapper
  }

  function descriptorFor(object: T, key: PropertyKey) {
    const descriptor = Reflect.getOwnPropertyDescriptor(object, key)
    if (!descriptor) return

    if ('value' in descriptor) return {
      ...descriptor,
      value: wrapMethod(key, descriptor.value),
    }

    return descriptor
  }

  const target = typeof getObject() === 'function'
    ? function () { }
    : {}

  function syncNonConfigurableDescriptor(object: T, key: PropertyKey) {
    const descriptor = descriptorFor(object, key)
    if (!descriptor || descriptor.configurable) return
    Reflect.defineProperty(target, key, descriptor)
  }

  function syncNonConfigurableDescriptors(object: T) {
    for (const key of Reflect.ownKeys(object))
      if (allows(key, object))
        syncNonConfigurableDescriptor(object, key)
  }

  syncNonConfigurableDescriptors(getObject())

  const handler: ProxyHandler<object> = {
    apply: (_target, thisArgument, argumentsList) =>
      Reflect.apply(getObject() as any, thisArgument, argumentsList),

    defineProperty(target, key, descriptor) {
      if (isSolidStoreSymbol(key))
        return Reflect.defineProperty(target, key, descriptor)

      const object = getObject()
      if (!allows(key, object))
        return false

      const result = Reflect.defineProperty(object, key, descriptor)
      if (result)
        syncNonConfigurableDescriptor(object, key)

      return result
    },

    deleteProperty(_target, key) {
      const object = getObject()
      if (allows(key, object))
        return Reflect.deleteProperty(object, key)
      else
        return false
    },

    get(target, key) {
      if (isSolidStoreSymbol(key))
        return Reflect.get(target, key)

      const object = getObject()
      if (allows(key, object))
        return wrapMethod(key, Reflect.get(object, key, object))
    },

    getOwnPropertyDescriptor(target, key) {
      if (isSolidStoreSymbol(key))
        return Reflect.getOwnPropertyDescriptor(target, key)

      const object = getObject()
      if (allows(key, object))
        return descriptorFor(object, key)
    },

    has(_target, key) {
      const object = getObject()
      return allows(key, object) && key in object
    },

    ownKeys() {
      const object = getObject()
      syncNonConfigurableDescriptors(object)

      const keys = Reflect.ownKeys(object).filter(key => allows(key, object))
      const keySet = new Set(keys)

      for (const key of Reflect.ownKeys(target)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
        if (descriptor && !descriptor.configurable && !keySet.has(key))
          keys.push(key)
      }

      return keys
    },

    set(_target, key, value) {
      const object = getObject()
      if (!allows(key, object))
        return false

      const result = Reflect.set(object, key, value, object)
      if (result)
        syncNonConfigurableDescriptor(object, key)

      return result
    },

    preventExtensions: () => false,
    setPrototypeOf: (_target, prototype) => Reflect.setPrototypeOf(getObject(), prototype),
    getPrototypeOf: () => Reflect.getPrototypeOf(getObject()),
  }

  return new Proxy(target, handler) as T
}

const isSolidStoreSymbol = (key: PropertyKey) =>
  typeof key === 'symbol' &&
  ['Symbol(solid-proxy)', 'Symbol(store-node)', 'Symbol(store-has)'].includes(String(key))
