import { createComputed, createRoot, onCleanup, untrack } from 'solid-js'
import { createStore } from 'solid-js/store'

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
  const [store, setStore] = createStore({} as Store)
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

        for (const key of Object.keys(store))
          setStore(key as any, undefined)
        setStore(spec as any)
      })
    })
  })

  onCleanup(() => disposeBranch?.())

  return store as StoreResult<BranchResult<TBranches[SelectionKey<TSelection>]>>
}

function normalizeSelection(selection: Selection) {
  return Array.isArray(selection)
    ? { key: selection[0], data: selection[1] }
    : { key: selection, data: undefined }
}
