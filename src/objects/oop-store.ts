import { createMutable, createStore } from 'solid-js/store'
import { Simplify } from 'type-fest'
import { omit } from './omit'

function immutableStore<T extends object>(mutable: T) {
  const [immutable] = createStore(mutable)
  return immutable
}

function bindOwnFunctions<T extends object>(
  source: T,
  receiver: T,
) {
  for (const key in source)
    if (typeof source[key] === 'function')
      source[key] = source[key].bind(receiver)
}

function bindPrototypeMethods<T extends object>(
  source: T,
  receiver: T,
) {
  const proto = Object.getPrototypeOf(source)
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor') continue
    const value = proto[key]
    if (typeof value === 'function')
      (receiver as any)[key] = (value as Function).bind(receiver)
  }
}


// bind own functions
export function FunctionStore<T extends object>(instance: T) {
  const mutable = createMutable(instance)
  bindOwnFunctions(instance, mutable)
  return immutableStore(mutable)
}

export const FactoryStore = <T extends object, Args extends unknown[]>(factory: (...args: Args) => T) =>
  (...args: Args) => FunctionStore(factory(...args))


// bind prototype methods
export function MethodStore<T extends object>(instance: T): Simplify<T> {
  const mutable = createMutable(instance)
  bindPrototypeMethods(instance, mutable)
  return immutableStore(mutable)
}

type Constructor<T extends object, Args extends unknown[] = unknown[]> = new (...args: Args) => T

export const ClassStore =
  <T extends object, Args extends unknown[]>(C: Constructor<T, Args>) =>
    Object.assign(
      (...args: Args) => MethodStore(new C(...args)),
      { private<Keys extends string[]>(this: ReturnType<typeof ClassStore<T, Args>>, ...keys: Keys) {
        return (...args: Parameters<typeof this>) => omit(this(...args), keys as any as CommonKeys<Keys, typeof this>) } },
    )

type KeysOfUnion<T> = T extends unknown ? keyof T : never
type CommonKeys<
  Keys extends string[],
  Fn extends (...args: any) => object,
> = Extract<Keys[number], KeysOfUnion<ReturnType<Fn>>>[]
