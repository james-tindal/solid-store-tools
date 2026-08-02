export function assertExists<T>(x: T, message?: string): asserts x is NonNullable<T> {
  if (x === null || x === undefined)
    throw new TypeError(message ?? 'Value must not be null or undefined')
}

type TupleOf<T, N extends number, R extends T[] = []> =
  R['length'] extends N ? R : TupleOf<T, N, [...R, T]>

export type ArrayWithLength<T, N extends number> =
  number extends N ? T[] : TupleOf<T, N>

export function assertLength<T, N extends number>(
  array: T[],
  length: N,
  message?: string,
): asserts array is ArrayWithLength<T, N> {
  if (array.length !== length)
    throw new RangeError(message ?? `Array must contain exactly ${length} item(s)`)
}
