/**
 * Narrow `T` to the subtype satisfied by `Pattern`.
 */
export type Narrow<T, Pattern> =
  T extends unknown
    ? NarrowOne<T, Pattern>
    : never

type PatternObject<T> =
  [T] extends [object]
    ? [T] extends [(...args: any[]) => any]
      ? false
      : [T] extends [readonly any[]]
        ? false
        : [keyof T] extends [never]
          ? false
          : true
    : false

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>

export type OmitPreserveCall<T, K extends PropertyKey> =
  T extends (...args: infer Args) => infer Return
    ? ((...args: Args) => Return) & Omit<T, K>
    : Omit<T, K>

type NarrowPatternValue<T, Pattern, K extends keyof Pattern> =
  K extends keyof T
    ? NonNullable<Pattern[K]> extends infer PatternValue
      ? PatternObject<PatternValue> extends true
        ? Narrow<NonNullable<T[K]>, PatternValue>
        : Narrow<T[K], Pattern[K]>
      : never
    : never

type NarrowPatternKeys<T, Pattern> = {
  [K in keyof Pattern]-?: NarrowPatternValue<T, Pattern, K>
}

type HasNever<T> =
  true extends {
    [K in keyof T]-?: [T[K]] extends [never] ? true : false
  }[keyof T]
    ? true
    : false

type NarrowArrayValue<T, PatternElement> =
  T extends readonly (infer SourceElement)[]
    ? Narrow<SourceElement, PatternElement> extends infer Element
      ? [Element] extends [never]
        ? never
        : T extends any[]
          ? Array<Element>
          : ReadonlyArray<Element>
      : never
    : Extract<T, readonly PatternElement[]>

type NarrowArray<T, Pattern> =
  Pattern extends readonly (infer PatternElement)[]
    ? NarrowArrayValue<T, PatternElement>
    : never

type ApplyPattern<T, Pattern> =
  [OptionalKeys<Pattern>] extends [never]
    ? OmitPreserveCall<T, keyof Pattern & keyof T> & NarrowPatternKeys<T, Pattern>
    : [RequiredKeys<Pattern>] extends [never]
      ? OmitPreserveCall<T, keyof Pattern & keyof T>
        & { [K in OptionalKeys<Pattern>]?: NarrowPatternKeys<T, Pattern>[K] }
      : OmitPreserveCall<T, keyof Pattern & keyof T>
        & { [K in RequiredKeys<Pattern>]-?: NarrowPatternKeys<T, Pattern>[K] }
        & { [K in OptionalKeys<Pattern>]?: NarrowPatternKeys<T, Pattern>[K] }

type NarrowOne<T, Pattern> =
  Pattern extends readonly any[]
    ? NarrowArray<T, Pattern>
    : PatternObject<Pattern> extends true
      ? HasNever<NarrowPatternKeys<T, Pattern>> extends true
        ? never
        : ApplyPattern<T, Pattern>
      : Extract<T, Pattern>
