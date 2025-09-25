import { Optional, some, none, isFound } from "../external/Funk/optional/optional";
import { fold as foldEither } from "../external/Funk/optional/either";
import type { Monoid } from "../math/algebra/monoid";

export type Traversal<A> = {
  results: () => Optional<A>[];
  map: <B>(f: (a: A) => B) => Traversal<B>;
  compact: () => Traversal<NonNullable<A>>;
  any: (f?: (a: A) => boolean) => boolean;
  all: (f?: (a: A) => boolean) => boolean;
  none: (f?: (a: A) => boolean) => boolean;
  sum: (f?: (a: A) => number) => number;
  min: (f?: (a: A) => number) => number | undefined;
  max: (f?: (a: A) => number) => number | undefined;
  fold: <M>(M: Monoid<M>, f: (a: A) => M) => Optional<M>;
  reduceBy: (op: string) => Optional<A>;
  anyOpt: (f?: (a: A) => boolean) => Optional<boolean>;
  allOpt: (f?: (a: A) => boolean) => Optional<boolean>;
  noneOpt: (f?: (a: A) => boolean) => Optional<boolean>;
  sumOpt: (f?: (a: A) => number) => Optional<number>;
  minOpt: (f?: (a: A) => number) => Optional<number>;
  maxOpt: (f?: (a: A) => number) => Optional<number>;
  foldStrict: <M>(M: Monoid<M>, f:(a:A)=>M) => Optional<M>;
};

function extract<A>(xs: Optional<A>[]): { arr: A[]; anyNone: boolean } {
  const arr: A[] = [];
  let anyNone = false;
  for (const o of xs) {
    if (isFound(o)) arr.push(foldEither(o, () => null as any, r => r));
    else anyNone = true;
  }
  return { arr, anyNone };
}

export function makeTraversal<A>(opts: {
  values: Optional<A>[];
  invoke?: (a: A, op: string, b: A) => A | undefined;
}): Traversal<A> {
  const xs = opts.values;
  const toArray = () => extract(xs).arr;
  const hasNone = () => extract(xs).anyNone;

  return {
    results: () => xs,

    map: <B>(f: (a: A) => B) =>
      makeTraversal<B>({
        values: xs.map(o => isFound(o) ? some(f(foldEither(o, () => null as any, r => r))) : none<B>()),
        invoke: opts.invoke as any
      }),

    compact: () => {
      const ys: Optional<NonNullable<A>>[] =
        xs.map(o =>
          isFound(o)
            ? (foldEither(o, () => null as any, r => r) != null
                ? some(foldEither(o, () => null as any, r => r) as NonNullable<A>)
                : none())
            : none()
        );
      return makeTraversal<NonNullable<A>>({ values: ys, invoke: opts.invoke as any });
    },

    any: (f?) => { const arr = toArray(); return f ? arr.some(f) : arr.some((x: any) => !!x); },
    all: (f?) => { const arr = toArray(); return arr.length === 0 ? true : (f ? arr.every(f) : arr.every((x: any) => !!x)); },
    none: (f?) => { const arr = toArray(); return f ? arr.every(a => !f(a)) : arr.every((x: any) => !x); },

    sum: (f?) => toArray().map(f ?? ((x: any) => x as number)).reduce((s, n) => s + n, 0),
    min: (f?) => { const arr = toArray().map(f ?? ((x: any) => x as number)); return arr.length ? Math.min(...arr) : undefined; },
    max: (f?) => { const arr = toArray().map(f ?? ((x: any) => x as number)); return arr.length ? Math.max(...arr) : undefined; },

    fold: <M>(M: Monoid<M>, f: (a: A) => M) => {
      let acc: M | undefined = undefined;
      for (const o of xs) {
        if (isFound(o)) {
          const v = f(foldEither(o, () => null as any, r => r));
          acc = acc === undefined ? v : M.concat(acc, v);
        }
      }
      return acc === undefined ? none<M>() : some(acc);
    },

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

    anyOpt: (f?) => hasNone() ? none() : some((f ? toArray().some(f) : toArray().some((x: any) => !!x))),
    allOpt: (f?) => hasNone() ? none() : some((toArray().length === 0) ? true : (f ? toArray().every(f) : toArray().every((x: any) => !!x))),
    noneOpt: (f?) => hasNone() ? none() : some((f ? toArray().every(a => !f(a)) : toArray().every((x: any) => !x))),
    sumOpt: (f?) => hasNone() ? none() : some(toArray().map(f ?? ((x: any) => x as number)).reduce((s, n) => s + n, 0)),
    minOpt: (f?) => hasNone() ? none() : (toArray().length ? some(Math.min(...toArray().map(f ?? ((x: any) => x as number)))) : none()),
    maxOpt: (f?) => hasNone() ? none() : (toArray().length ? some(Math.max(...toArray().map(f ?? ((x: any) => x as number)))) : none()),
    foldStrict: <M>(M: Monoid<M>, f: (a: A) => M) => hasNone()
      ? none<M>()
      : (() => {
          let acc: M | undefined = undefined;
          for (const o of xs) {
            const v = f(foldEither(o, () => null as any, r => r) as A);
            acc = acc === undefined ? v : M.concat(acc, v);
          }
          return acc === undefined ? none<M>() : some(acc);
        })(),
  };
}
