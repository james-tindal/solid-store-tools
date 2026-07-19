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

export function filterKeys<T extends object>(source: T, allows: (key: string | symbol, object: T) => boolean): T {
  const wrappedMethods = new WrappedMethods(key => ({
    object: source,
    method: Reflect.get(source, key, source) as Function,
  }))

  function wrapMethod(key: string | symbol, value: unknown) {
    return wrappedMethods.get(key, value)
  }

  function descriptorFor(object: T, key: string | symbol) {
    const descriptor = dataDescriptorFrom(object, key)
    if (!descriptor) return

    return {
      ...descriptor,
      value: wrapMethod(key, descriptor.value),
    }
  }

  const target = typeof source === 'function'
    ? function () { }
    : {}

  function syncNonConfigurableDescriptor(object: T, key: string | symbol) {
    const descriptor = descriptorFor(object, key)
    if (!descriptor || descriptor.configurable) return
    Reflect.defineProperty(target, key, descriptor)
  }

  function syncNonConfigurableDescriptors(object: T) {
    for (const key of Reflect.ownKeys(object))
      if (allows(key, object))
        syncNonConfigurableDescriptor(object, key)
  }

  syncNonConfigurableDescriptors(source)

  const handler: ProxyHandler<object> = {
    apply: (_target, thisArgument, argumentsList) =>
      Reflect.apply(source as any, thisArgument, argumentsList),

    defineProperty(target, key, descriptor) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataDefineProperty(target, key, descriptor)

      if (!allows(key, source))
        return false

      const result = Reflect.defineProperty(source, key, descriptor)
      if (result)
        syncNonConfigurableDescriptor(source, key)

      return result
    },

    deleteProperty(_target, key) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataDeleteProperty(target, key)

      if (allows(key, source))
        return Reflect.deleteProperty(source, key)
      else
        return false
    },

    get(target, key) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataGet(target, key)

      if (allows(key, source))
        return wrapMethod(key, Reflect.get(source, key, source))
    },

    getOwnPropertyDescriptor(target, key) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataGetOwnPropertyDescriptor(target, key)

      const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, key)
      if (targetDescriptor && !targetDescriptor.configurable)
        return targetDescriptor

      if (allows(key, source))
        return descriptorFor(source, key)
    },

    has(target, key) {
      return isSolidStoreMetadataKey(key)
        ? solidStoreMetadataHas(target, key)
        : allows(key, source) && key in source
    },

    ownKeys() {
      syncNonConfigurableDescriptors(source)

      return ownKeysWithLocalMetadata(
        Reflect.ownKeys(source).filter(key => allows(key, source)),
        target,
      )
    },

    set(target, key, value) {
      if (isSolidStoreMetadataKey(key))
        return solidStoreMetadataSet(target, key, value)

      if (!allows(key, source))
        return false

      const result = Reflect.set(source, key, value, source)
      if (result)
        syncNonConfigurableDescriptor(source, key)

      return result
    },

    preventExtensions: () => false,
    setPrototypeOf: (_target, prototype) => Reflect.setPrototypeOf(source, prototype),
    getPrototypeOf: () => Reflect.getPrototypeOf(source),
  }

  return new Proxy(target, handler) as T
}
