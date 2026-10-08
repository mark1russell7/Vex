import type { AnyDomain } from "./domain.ts";
import { vexError, type VexError } from "./errors.ts";
import { evaluate, type FreeFn } from "./evaluate.ts";
import { app, lit, v } from "./ir.ts";
import { vexList, type ListItem } from "./list.ts";
import { fail, ok, toOptional, type Optional, type Result } from "./result.ts";
import { space as spaces, type Space } from "./space.ts";

/** A monoid: an associative `concat` with an identity element `empty`. */
export interface Monoid<M> {
  readonly empty: M;
  readonly concat: (a: M, b: M) => M;
}

/** Standard monoids. */
export const monoids: {
  readonly sum: Monoid<number>;
  readonly product: Monoid<number>;
  readonly all: Monoid<boolean>;
  readonly any: Monoid<boolean>;
} = {
  sum: { empty: 0, concat: (a, b) => a + b },
  product: { empty: 1, concat: (a, b) => a * b },
  all: { empty: true, concat: (a, b) => a && b },
  any: { empty: false, concat: (a, b) => a || b },
};

/** One item of a traversal: the start key and the result there. */
export interface TraversalItem<K extends string, T> {
  readonly key: K;
  readonly result: Result<T>;
}

/**
 * A traversal: the results of one program at each start key. The reductions skip error items by default.
 * After `strict()`, an error item makes the reduction that error.
 */
export interface Traversal<K extends string, T> {
  readonly items: readonly TraversalItem<K, T>[];
  /** This method gives a traversal whose reductions fail on the first error item. */
  strict(): Traversal<K, T>;
  /** This method gives the result at one key. */
  get(k: K): Optional<T>;
  /** The values of the items without errors. */
  values(): readonly T[];
  /** The keys of the items without errors. */
  keys(): readonly K[];
  /** The errors of the items with errors. */
  errors(): readonly VexError[];
  count(): Optional<number>;
  sum(this: Traversal<K, number>): Optional<number>;
  mean(this: Traversal<K, number>): Optional<number>;
  min(this: Traversal<K, number>): Optional<number>;
  max(this: Traversal<K, number>): Optional<number>;
  any(this: Traversal<K, boolean>): Optional<boolean>;
  all(this: Traversal<K, boolean>): Optional<boolean>;
  none(this: Traversal<K, boolean>): Optional<boolean>;
  /** This method folds the values with a domain op, from the left. */
  reduce(op: string): Optional<T>;
  /** This method gives the result of a reduction, with its error. */
  reduceResult(op: "count" | "sum" | "mean" | "min" | "max" | "any" | "all" | "none" | "reduce", reduceOp?: string): Result<unknown>;
  /** This method maps each value with `f`. If `f` throws, the item has the error `#CALC!`. */
  map<U>(f: (value: T, key: K) => U): Traversal<K, U>;
  /** This method folds the values with a monoid. */
  fold<M>(monoid: Monoid<M>, f: (value: T) => M): M;
}

interface TraversalEnv {
  readonly domains: readonly AnyDomain[];
  readonly options?: { readonly fns?: Readonly<Record<string, FreeFn>> };
}

const EMPTY_SPACE: Space = spaces.record({ $: {} });

const opt = <U>(r: Result<unknown>): Optional<U> => toOptional(r as Result<U>);

/** This function makes a traversal from items. */
export function traversal<K extends string, T>(items: readonly TraversalItem<K, T>[], env: TraversalEnv, isStrict = false): Traversal<K, T> {
  const reduce = (op: string, reduceOp?: string): Result<unknown> => {
    const list = vexList(items as readonly ListItem[]);
    const args = [v("$list"), ...(reduceOp === undefined ? [] : [lit(reduceOp)]), ...(isStrict ? [lit({ strict: true })] : [])];
    return evaluate(app(op, ...args), {
      space: EMPTY_SPACE,
      origin: "$",
      domains: env.domains,
      vars: { $list: list },
      ...(env.options?.fns === undefined ? {} : { fns: env.options.fns }),
    });
  };
  const t: Traversal<K, T> = {
    items,
    strict: () => traversal(items, env, true),
    get: (k) => {
      const item = items.find((it) => it.key === k);
      return item === undefined ? toOptional(fail(vexError("unknown-key", `no item has the key "${k}"`))) : toOptional(item.result);
    },
    values: () => items.flatMap((it) => (it.result.ok ? [it.result.value] : [])),
    keys: () => items.flatMap((it) => (it.result.ok ? [it.key] : [])),
    errors: () => items.flatMap((it) => (it.result.ok ? [] : [it.result.error])),
    count: () => opt(reduce("count")),
    sum: () => opt(reduce("sum")),
    mean: () => opt(reduce("mean")),
    min: () => opt(reduce("min")),
    max: () => opt(reduce("max")),
    any: () => opt(reduce("any")),
    all: () => opt(reduce("all")),
    none: () => opt(reduce("none")),
    reduce: (op) => opt(reduce("reduce", op)),
    reduceResult: (op, reduceOp) => reduce(op, reduceOp),
    map: <U>(f: (value: T, key: K) => U): Traversal<K, U> =>
      traversal(
        items.map((it): TraversalItem<K, U> => {
          if (!it.result.ok) return { key: it.key, result: it.result };
          try {
            return { key: it.key, result: ok(f(it.result.value, it.key)) };
          } catch (thrown) {
            return { key: it.key, result: fail(vexError("threw", "the map function threw an exception", { thrown, focus: it.key })) };
          }
        }),
        env,
        isStrict,
      ),
    fold: <M>(monoid: Monoid<M>, f: (value: T) => M): M => t.values().reduce((acc, x) => monoid.concat(acc, f(x)), monoid.empty),
  };
  return t;
}
