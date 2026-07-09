/**
 * Return the minimal supertype of both inputs.
 * Like type-fest's MergeDeep, but when entries conflict, union
 * the conflicting values instead of letting right overwrite left.
 */
export type Widen<A, B> =
  [Exclude<A, null | undefined>] extends [never]
    ? A | B
    : [Exclude<B, null | undefined>] extends [never]
      ? A | B
      : WidenDistribute<Exclude<A, null | undefined>, Exclude<B, null | undefined>>
        | Extract<A, null | undefined>
        | Extract<B, null | undefined>

type WidenDistribute<A, B> =
  A extends unknown
    ? B extends unknown
      ? WidenOne<A, B>
      : never
    : never

type WidenOne<A, B> =
  A extends readonly unknown[]
    ? B extends readonly unknown[]
      ? WidenArray<A, B>
      : A | B
    : B extends readonly unknown[]
      ? A | B
      : A extends (...args: any[]) => any
        ? B extends (...args: any[]) => any
          ? WidenFunction<A, B>
          : A | B
        : B extends (...args: any[]) => any
          ? A | B
          : A extends object
            ? B extends object
              ? WidenObject<A, B>
              : A | B
            : A | B

type IsTuple<T extends readonly unknown[]> =
  number extends T['length'] ? false : true

type WidenArray<A extends readonly unknown[], B extends readonly unknown[]> =
  IsTuple<A> extends true
    ? IsTuple<B> extends true
      ? WidenTuple<A, B>
      : A | B
    : IsTuple<B> extends true
      ? A | B
      : A extends unknown[]
        ? B extends unknown[]
          ? Array<Widen<A[number], B[number]>>
          : ReadonlyArray<Widen<A[number], B[number]>>
        : ReadonlyArray<Widen<A[number], B[number]>>

type WidenTuple<A extends readonly unknown[], B extends readonly unknown[]> =
  WidenTupleValues<A, B> extends infer Tuple extends unknown[]
    ? A extends unknown[]
      ? B extends unknown[]
        ? Tuple
        : Readonly<Tuple>
      : Readonly<Tuple>
    : never

type WidenTupleValues<A extends readonly unknown[], B extends readonly unknown[]> =
  A extends readonly [infer AHead, ...infer ATail]
    ? B extends readonly [infer BHead, ...infer BTail]
      ? [Widen<AHead, BHead>, ...WidenTupleValues<ATail, BTail>]
      : [...A]
    : B extends readonly [infer BHead, ...infer BTail]
      ? [BHead, ...WidenTupleValues<[], BTail>]
      : []

type WidenFunction<A extends (...args: any[]) => any, B extends (...args: any[]) => any> =
  [keyof A | keyof B] extends [never]
    ? A | B
    : (Call<A> | Call<B>) & WidenObject<A, B>

type Call<T extends (...args: any[]) => any> =
  T extends (...args: infer Args) => infer Return
    ? (...args: Args) => Return
    : never

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

type ReadonlyKeys<T> = {
  [K in keyof T]-?: Equal<
    { [Q in K]: T[K] },
    { -readonly [Q in K]: T[K] }
  > extends true ? never : K
}[keyof T]

type WidenValue<A, B, K extends PropertyKey> =
  K extends keyof A
    ? K extends keyof B
      ? Widen<A[K], B[K]>
      : A[K]
    : K extends keyof B
      ? B[K]
      : never

type IsOptional<A, B, K extends PropertyKey> =
  K extends keyof A
    ? K extends OptionalKeys<A>
      ? true
      : K extends keyof B
        ? K extends OptionalKeys<B> ? true : false
        : false
    : K extends keyof B
      ? K extends OptionalKeys<B> ? true : false
      : false

type IsReadonly<A, B, K extends PropertyKey> =
  K extends keyof A
    ? K extends ReadonlyKeys<A>
      ? K extends keyof B
        ? K extends ReadonlyKeys<B> ? true : false
        : true
      : false
    : K extends keyof B
      ? K extends ReadonlyKeys<B> ? true : false
      : false

type AllKeys<A, B> = keyof A | keyof B

type RequiredMutableKeys<A, B> = {
  [K in AllKeys<A, B>]-?:
    IsOptional<A, B, K> extends true
      ? never
      : IsReadonly<A, B, K> extends true
        ? never
        : K
}[AllKeys<A, B>]

type OptionalMutableKeys<A, B> = {
  [K in AllKeys<A, B>]-?:
    IsOptional<A, B, K> extends true
      ? IsReadonly<A, B, K> extends true
        ? never
        : K
      : never
}[AllKeys<A, B>]

type RequiredReadonlyKeys<A, B> = {
  [K in AllKeys<A, B>]-?:
    IsOptional<A, B, K> extends true
      ? never
      : IsReadonly<A, B, K> extends true
        ? K
        : never
}[AllKeys<A, B>]

type OptionalReadonlyKeys<A, B> = {
  [K in AllKeys<A, B>]-?:
    IsOptional<A, B, K> extends true
      ? IsReadonly<A, B, K> extends true
        ? K
        : never
      : never
}[AllKeys<A, B>]

type Simplify<T> = { [K in keyof T]: T[K] } & {}

type WidenObject<A, B> = Simplify<
  { [K in RequiredMutableKeys<A, B>]-?: WidenValue<A, B, K> }
  & { [K in OptionalMutableKeys<A, B>]?: WidenValue<A, B, K> }
  & { readonly [K in RequiredReadonlyKeys<A, B>]-?: WidenValue<A, B, K> }
  & { readonly [K in OptionalReadonlyKeys<A, B>]?: WidenValue<A, B, K> }
>
