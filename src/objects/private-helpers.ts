import { $PROXY } from 'solid-js'
import { $RAW } from 'solid-js/store'

export const isSolidStoreMetadataKey = (x: any) =>
  [$PROXY, $RAW].includes(x) ||
  typeof x === 'symbol' && ['store-node', 'store-has'].includes(x.description!)

export const withoutSolidStoreMetadataKeys = (keys: (string | symbol)[]) =>
  keys.filter(key => !isSolidStoreMetadataKey(key))

export const solidStoreMetadataGet = Reflect.get
export const solidStoreMetadataSet = Reflect.set
export const solidStoreMetadataHas = Reflect.has
export const solidStoreMetadataDefineProperty = Reflect.defineProperty
export const solidStoreMetadataDeleteProperty = Reflect.deleteProperty
export const solidStoreMetadataGetOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor

export function ownKeysWithLocalMetadata(sourceKeys: (string | symbol)[], target: object) {
  const keys = new Set(withoutSolidStoreMetadataKeys(sourceKeys))

  for (const key of Reflect.ownKeys(target)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
    if (descriptor && !descriptor.configurable)
      keys.add(key)
  }

  return [...keys]
}

export function dataDescriptorFrom<T extends object>(
  object: T,
  key: string | symbol,
): PropertyDescriptor | undefined {
  const descriptor = Reflect.getOwnPropertyDescriptor(object, key)
  if (!descriptor) return

  return {
    configurable: true,
    enumerable: descriptor.enumerable,
    writable: isDescriptorWritable(descriptor),
    value: Reflect.get(object, key, object),
  }
}

function isDescriptorWritable(descriptor: PropertyDescriptor) {
  return 'value' in descriptor
    ? descriptor.writable
    : descriptor.set !== undefined
}
