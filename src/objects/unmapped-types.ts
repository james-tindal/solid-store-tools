
export interface UnmappedTypes {}

export type UnmappedTypesUnion =
  | UnmappedTypes[keyof UnmappedTypes]
  | Date
