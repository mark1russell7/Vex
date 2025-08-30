// algebra/monoid.ts
export interface Semigroup<T> { concat: (a: T, b: T) => T; }
export interface Monoid<T> extends Semigroup<T> { empty: T; }

export const Monoid = {
  first<T>(): Monoid<T | undefined> {
    return { empty: undefined, concat: (a, b) => (a !== undefined ? a : b) };
  },
  all(): Monoid<boolean> {
    return { empty: true, concat: (a, b) => a && b };
  },
  any(): Monoid<boolean> {
    return { empty: false, concat: (a, b) => a || b };
  },
  sum(): Monoid<number> {
    return { empty: 0, concat: (a, b) => a + b };
  },
  product(): Monoid<number> {
    return { empty: 1, concat: (a, b) => a * b };
  },
};
