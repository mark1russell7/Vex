import { Optional, some, none } from "../external/Funk/optional/optional";

/** Optional Lens: both directions Optional. */
export type OLens<A, B> = {
  get: (a: A) => Optional<B>;
  set: (a: A, b: B) => Optional<A>;
};

export const oLens = <A, B>(get: OLens<A,B>["get"], set: OLens<A,B>["set"]): OLens<A,B> => ({ get, set });

export const oCompose = <A, B, C>(ab: OLens<A,B>, bc: OLens<B,C>): OLens<A,C> =>
  oLens(
    (a) => ab.get(a).tag === "Right" ? bc.get((ab.get(a) as any).right) : none<C>(),
    (a, c) => ab.get(a).tag === "Right"
      ? (bc.set((ab.get(a) as any).right, c).tag === "Right"
          ? ab.set(a, (bc.set((ab.get(a) as any).right, c) as any).right)
          : none<A>())
      : none<A>()
  );

export const oGetter = <A, B>(get: (a: A) => Optional<B>): OLens<A,B> =>
  oLens(get, (_a, _b) => none<A>());

/* Common constructors (tolerant to proxies; no hasOwnProperty guard) */
export const prop = <A extends object, K extends keyof A>(k: K): OLens<A, A[K]> =>
  oLens(
    (a) => {
      const v = (a as any)[k as any];
      return v === undefined ? none<A[K]>() : some(v);
    },
    (a, b) =>
      some(
        Object.assign(
          Array.isArray(a) ? [...(a as any)] : { ...(a as any) },
          { [k as any]: b }
        ) as A
      )
  );

export const index = <T>(i: number): OLens<T[], T> =>
  oLens(
    (as) => (Array.isArray(as) && i>=0 && i<as.length) ? some(as[i]) : none<T>(),
    (as, b) => (Array.isArray(as) && i>=0 && i<as.length)
      ? some(Object.assign([...as], { [i]: b }))
      : none<T[]>()
  );

export const recordKey = <V>(k: string): OLens<Record<string,V>, V> =>
  oLens(
    (r) => {
      const v = (r as any)?.[k];
      return v === undefined ? none<V>() : some(v);
    },
    (r, v) => (r != null) ? some({ ...(r as any), [k]: v }) : none<Record<string,V>>()
  );

