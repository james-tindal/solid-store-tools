import { createComputed, createRoot, createSignal, onCleanup, untrack } from 'solid-js'

type BranchKey = string | number | symbol

type Selection = BranchKey | readonly [BranchKey, unknown]
type SelectionKey<T> =
  T extends readonly [infer K extends BranchKey, unknown] ? K :
  T extends BranchKey ? T :
  never
type SelectionData<T, TKey extends BranchKey> =
  Extract<T, readonly [TKey, unknown]> extends readonly [TKey, infer TData] ? TData :
  undefined

type BranchEntry<TData> = object | ((data: TData) => object)
type Branches<TSelection extends Selection> = {
  [K in SelectionKey<TSelection>]: BranchEntry<SelectionData<TSelection, K>>
}
type BranchResult<T> =
  T extends (...args: any[]) => infer TResult ? TResult : T
type StoreResult<T> =
  T extends (...args: any[]) => any ? T :
  T extends readonly (infer U)[]
    ? number extends T['length']
      ? Array<StoreResult<U>>
      : { -readonly [K in keyof T]: StoreResult<T[K]> } :
  T extends object ? { -readonly [K in keyof T]: StoreResult<T[K]> } :
  T

export function switchStore<const TSelection extends Selection, const TBranches extends Branches<TSelection>>(
  pick: () => TSelection,
  branches: TBranches,
): StoreResult<BranchResult<TBranches[SelectionKey<TSelection>]>> {
  type Store = StoreResult<BranchResult<TBranches[SelectionKey<TSelection>]>> & object
  const [store, setStore] = createSignal<Store>({} as Store, { equals: false })
  let disposeBranch: (() => void) | undefined
  let key: BranchKey | undefined

  createComputed(() => {
    const selection = normalizeSelection(pick())
    if (selection.key === key) return

    untrack(() => {
      disposeBranch?.()
      key = selection.key
      createRoot(dispose => {
        disposeBranch = dispose
        const entry = branches[selection.key as SelectionKey<TSelection>]
        const spec = typeof entry === 'function'
          ? entry(selection.data as never)
          : entry

        setStore(() => spec as Store)
      })
    })
  })

  onCleanup(() => disposeBranch?.())

  return new Proxy({} as Store, {
    get: (target, key) =>
      isSolidStoreSymbol(key)
        ? Reflect.get(target, key)
        : store()[key as keyof Store],
    has: (target, key) =>
      isSolidStoreSymbol(key)
        ? Reflect.has(target, key)
        : key in store(),
    ownKeys: target =>
      dedupe([
        ...Reflect.ownKeys(store()),
        ...Reflect.ownKeys(target),
      ]),
    getOwnPropertyDescriptor: (target, key) =>
      isSolidStoreSymbol(key)
        ? Reflect.getOwnPropertyDescriptor(target, key)
        : Reflect.getOwnPropertyDescriptor(store(), key),
    set: (target, key, value) =>
      isSolidStoreSymbol(key)
        ? Reflect.set(target, key, value)
        : Reflect.set(store(), key, value),
    defineProperty: (target, key, descriptor) =>
      isSolidStoreSymbol(key)
        ? Reflect.defineProperty(target, key, descriptor)
        : Reflect.defineProperty(store(), key, descriptor),
    deleteProperty: (target, key) =>
      isSolidStoreSymbol(key)
        ? Reflect.deleteProperty(target, key)
        : Reflect.deleteProperty(store(), key),
  }) as StoreResult<BranchResult<TBranches[SelectionKey<TSelection>]>>
}

const isSolidStoreSymbol = (key: PropertyKey) =>
  typeof key === 'symbol' &&
  ['Symbol(solid-proxy)', 'Symbol(store-node)', 'Symbol(store-has)'].includes(String(key))

const dedupe = <T>(values: T[]) => [...new Set(values)]

function normalizeSelection(selection: Selection) {
  return Array.isArray(selection)
    ? { key: selection[0], data: selection[1] }
    : { key: selection, data: undefined }
}
