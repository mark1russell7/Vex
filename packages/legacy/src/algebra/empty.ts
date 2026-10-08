/** Empty/Zero semantics per type */
export interface Empty<T> {
  empty(): T;
  isEmpty(t: T): boolean;
}

/** Numbers: empty = NaN (your convention) */
export const EmptyNumber: Empty<number> = {
  empty: () => Number.NaN,
  isEmpty: (t) => Number.isNaN(t),
};

/** Booleans: we can use undefined as “empty” sentinel only if wrapped; for plain boolean, no true empty.
 * If you want an actual empty, wrap with TB<boolean> or Optional<boolean>.
 */
export const EmptyBoolean: Empty<boolean | undefined> = {
  empty: () => undefined,
  isEmpty: (t) => t === undefined,
};

/** Arrays */
export const EmptyArray = <T>(): Empty<ReadonlyArray<T>> => ({
  empty: () => Object.freeze([] as T[]),
  isEmpty: (a) => a.length === 0,
});

/** Objects */
export const EmptyObject: Empty<Record<string, unknown>> = {
  empty: () => ({}),
  isEmpty: (o) => Object.keys(o).length === 0,
};
