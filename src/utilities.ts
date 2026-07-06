export function assertExists<T>(x: T, message?: string): asserts x is NonNullable<T> {
  if (x === null || x === undefined)
    throw new TypeError(message ?? 'Value must not be null or undefined')
}
