import { Narrow } from './Narrow'
import { Widen } from './Widen'

/**
 * Widen only the union branches of `T` that satisfy `Where`.
 */
export type WidenWhere<T, Where, Patch> =
  T extends unknown
    ? [Narrow<T, Where>] extends [never]
      ? T
      : Widen<T, Patch>
    : never
