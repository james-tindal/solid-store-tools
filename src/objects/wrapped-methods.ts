import { objectFromAccessor } from './object-from-accessor'

type WrappedMethodSource = {
  object: object
  method: Function
}

export class WrappedMethods {
  readonly #wrappers = new Map<string | symbol, Function>()

  constructor(
    private readonly resolve: (key: string | symbol) => WrappedMethodSource,
  ) {}

  get(key: string | symbol, value: unknown) {
    if (typeof value !== 'function') return value

    const cached = this.#wrappers.get(key)
    if (cached) return cached

    const wrapper = bindFunctionAccessor(
      () => this.resolve(key).object,
      () => this.resolve(key).method,
    )
    this.#wrappers.set(key, wrapper)
    return wrapper
  }
}

function bindFunctionAccessor(
  sourceObject: () => object,
  sourceMethod: () => Function,
) {
  return new Proxy(objectFromAccessor(sourceMethod), {
    apply(_target, _thisArgument, argumentsList) {
      return Reflect.apply(sourceMethod(), sourceObject(), argumentsList)
    },
  })
}
