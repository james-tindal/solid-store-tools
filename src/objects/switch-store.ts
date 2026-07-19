import { createComputed, createRoot, createSignal, onCleanup, untrack } from 'solid-js'
import { objectFromAccessor } from './object-from-accessor'

type BranchKey = string | number | symbol

type Selection = BranchKey | [BranchKey, unknown]
type SelectionKey<T> =
  T extends [infer K extends BranchKey, unknown] ? K :
  T extends BranchKey ? T :
  never
type SelectionData<T, TKey extends BranchKey> =
  Extract<T, [TKey, unknown]> extends [TKey, infer TData] ? TData :
  undefined

type BranchEntry<TData> = object | ((data: TData) => object)
type Branches<TSelection extends Selection> = {
  [K in SelectionKey<TSelection>]: BranchEntry<SelectionData<TSelection, K>>
}
type StoreBranches<TSelection extends Selection> = {
  [K in SelectionKey<TSelection>]: object | ((data: SelectionData<TSelection, K>) => object)
}
type BranchResult<T> =
  T extends (...args: any[]) => infer TResult ? TResult : T
type MutableResult<T> =
  T extends (...args: any[]) => any ? T :
  T extends (infer U)[]
    ? number extends T['length']
      ? Array<MutableResult<U>>
      : { -readonly [K in keyof T]: MutableResult<T[K]> } :
  T extends object ? { -readonly [K in keyof T]: MutableResult<T[K]> } :
  T

export function switchStore<const TSelection extends Selection, const TBranches extends StoreBranches<TSelection>>(
  pickBranch: () => TSelection,
  branches: TBranches,
): MutableResult<BranchResult<TBranches[SelectionKey<TSelection>]>> {
  return objectFromAccessor(switchAccessor(pickBranch, branches) as any) as MutableResult<BranchResult<TBranches[SelectionKey<TSelection>]>>
}

export function switchAccessor<const TSelection extends Selection, const TBranches extends Branches<TSelection>>(
  pickBranch: () => TSelection,
  branches: TBranches,
): () => MutableResult<BranchResult<TBranches[SelectionKey<TSelection>]>> {
  type Result = MutableResult<BranchResult<TBranches[SelectionKey<TSelection>]>>
  const [branchKey, setBranchKey] = createSignal<BranchKey>()
  let disposeBranch: (() => void) | undefined
  let key: BranchKey | undefined
  let current: Result

  createComputed(() => {
    const selection = normalizeSelection(pickBranch())
    if (selection.key === key) return

    untrack(() => {
      disposeBranch?.()
      key = selection.key
      createRoot(dispose => {
        disposeBranch = dispose
        const entry = branches[selection.key as SelectionKey<TSelection>]
        current = resolveBranch(entry, selection.data)
        setBranchKey(() => selection.key)
      })
    })
  })

  onCleanup(() => disposeBranch?.())

  return () => {
    branchKey()
    return current
  }
}

function normalizeSelection(selection: Selection): any {
  return Array.isArray(selection)
    ? { key: selection[0], data: selection[1] }
    : { key: selection, data: undefined }
}

const resolveBranch = <TData>(entry: BranchEntry<TData>, data: TData) =>
  typeof entry === 'function' ? entry(data) : entry
