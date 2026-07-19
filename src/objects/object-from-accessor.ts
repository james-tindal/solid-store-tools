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
} from './private-helpers'
import { WrappedMethods } from './wrapped-methods'

export function objectFromAccessor<T extends object>(accessor: () => T): T {
  function getObject() {
    const object = accessor()
    if (object === null || (typeof object !== 'object' && typeof object !== 'function'))
      throw new TypeError(`objectFromAccessor expected source to be an object, received ${JSON.stringify(object)}`)
    return object
  }

  const wrappedMethods = new WrappedMethods(key => {
    const currentObject = getObject()
    return {
      object: currentObject,
      method: Reflect.get(currentObject, key, currentObject) as Function,
    }
  })
  
  function descriptorFor(object: T, key: string | symbol) {
    const descriptor = dataDescriptorFrom(object, key)
    if (!descriptor) return

    return {
      ...descriptor,
      value: wrappedMethods.get(key, descriptor.value),
    }
  }

  const target = typeof getObject() === 'function'
    ? function () { }
    : {}

  return new Proxy(target, {
    apply: (_target, thisArgument, argumentsList) =>
      Reflect.apply(getObject() as any, thisArgument, argumentsList),

    defineProperty(target, key, descriptor) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataDefineProperty(target, key, descriptor)

      const object = getObject()
      return Reflect.defineProperty(object, key, descriptor)
    },

    deleteProperty: (_target, key) =>
      isSolidStoreMetadataKey(key)
        ? solidStoreMetadataDeleteProperty(target, key)
        : Reflect.deleteProperty(getObject(), key),

    get(target, key) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataGet(target, key)

      const object = getObject()
      return wrappedMethods.get(key, Reflect.get(object, key, object))
    },

    getOwnPropertyDescriptor(target, key) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataGetOwnPropertyDescriptor(target, key)

      const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, key)
      if (targetDescriptor && !targetDescriptor.configurable)
        return targetDescriptor

      return descriptorFor(getObject(), key)
    },

    has: (target, key) =>
      isSolidStoreMetadataKey(key)
        ? solidStoreMetadataHas(target, key)
        : key in getObject(),

    ownKeys: target =>
      ownKeysWithLocalMetadata(Reflect.ownKeys(getObject()), target),

    preventExtensions: () => false,

    set(target, key, value) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataSet(target, key, value)

      const object = getObject()
      return Reflect.set(object, key, value, object)
    },

    getPrototypeOf: () =>
      Reflect.getPrototypeOf(getObject()),

    setPrototypeOf: (_target, prototype) =>
      Reflect.setPrototypeOf(getObject(), prototype),
  }) as T
}
