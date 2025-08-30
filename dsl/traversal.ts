// dsl/traversal.ts
import { Optional, none, some } from "../external/Funk/optional/optional";
import { reduceWithMonoidOpt, mapOpt, chainOpt } from "../optional.utils";
import { Monoid } from "../math/algebra/monoid";
import { fold as foldEither } from "../external/Funk/optional/either";

export type Traversal<A> = {
  results: () => Optional<A>[];
  map: <B>(f: (a: A) => B) => Traversal<B>;
  compact: () => Traversal<NonNullable<A>>;
  // Booleans
  any: (f?: (a: A) => boolean) => boolean;
  all: (f?: (a: A) => boolean) => boolean;
  none: (f?: (a: A) => boolean) => boolean;
  // Numbers
  sum: (f?: (a: A) => number) => number;
  min: (f?: (a: A) => number) => number | undefined;
  max: (f?: (a: A) => number) => number | undefined;
  // Monoids
  fold: <M>(M: Monoid<M>, f: (a: A) => M) => Optional<M>;
  // Domain reduction by method name
  reduceBy: (op: string) => Optional<A>;
};

export function makeTraversal<A>(opts: {
  values: Optional<A>[];
  invoke?: (a: A, op: string, b: A) => A | undefined;
}): Traversal<A> {
  const xs = opts.values;

  const toArray = (): A[] => {
    const acc: A[] = [];
    for (const o of xs) foldEither(o, () => {}, (a) => { acc.push(a); });
    return acc;
  };

  return {
    results: () => xs,

    map: <B>(f: (a: A) => B) =>
      makeTraversal<B>({ values: xs.map((o) => mapOpt(o, f)) }),

    compact: () => {
      const ys: Optional<NonNullable<A>>[] = xs.map((o) =>
        chainOpt(o, (a) => (a == null ? none<NonNullable<A>>() : some(a as NonNullable<A>)))
      );
      return makeTraversal<NonNullable<A>>({ values: ys });
    },

    any: (f?: (a: A) => boolean) => {
      const arr = toArray();
      return f ? arr.some(f) : arr.some((x: any) => Boolean(x));
    },

    all: (f?: (a: A) => boolean) => {
      const arr = toArray();
      if (arr.length === 0) return true;
      return f ? arr.every(f) : arr.every((x: any) => Boolean(x));
    },

    none: (f?: (a: A) => boolean) => {
      const arr = toArray();
      return f ? arr.every((a) => !f(a)) : arr.every((x: any) => !Boolean(x));
    },

    sum: (f?: (a: A) => number) => {
      const arr = f ? toArray().map(f) : (toArray() as any as number[]);
      return arr.reduce((s, n) => s + n, 0);
    },

    min: (f?: (a: A) => number) => {
      const arr = f ? toArray().map(f) : (toArray() as any as number[]);
      return arr.length ? Math.min(...arr) : undefined;
    },

    max: (f?: (a: A) => number) => {
      const arr = f ? toArray().map(f) : (toArray() as any as number[]);
      return arr.length ? Math.max(...arr) : undefined;
    },

    fold: <M>(M: Monoid<M>, f: (a: A) => M) =>
      reduceWithMonoidOpt(xs.map((o) => mapOpt(o, f)), M),

    reduceBy: (op: string) => {
      const arr = toArray();
      if (!arr.length || !opts.invoke) return none<A>();
      let acc = arr[0];
      for (let i = 1; i < arr.length; i++) {
        const next = opts.invoke(acc, op, arr[i]);
        if (next === undefined) return none<A>();
        acc = next;
      }
      return some(acc);
    },
  };
}
