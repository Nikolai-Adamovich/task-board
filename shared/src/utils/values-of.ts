/**
 * Extracts values from an `as const` object and returns them as a
 * strongly-typed non-empty tuple.
 *
 * This eliminates the repetitive pattern:
 *   `Object.values(X) as [X, ...X[]]`
 *
 * @example
 *   const MyEnum = { A: 'a', B: 'b' } as const;
 *   const MyEnumValues = valuesOf(MyEnum);
 *   // type: readonly ['a', 'b']
 */
export function valuesOf<T extends Record<string, unknown>>(obj: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(obj) as [T[keyof T], ...T[keyof T][]];
}
