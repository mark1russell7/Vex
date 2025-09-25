import { OLens, oCompose, prop, index, recordKey } from "./optics";

/** Start with a property (loosen inner generic to avoid deep keyof explosions) */
export const P = <A extends object, K extends keyof A>(k: K): OLens<A, any> =>
  prop<A, any>(k as any);

/** Ergonomic chaining with relaxed generics (keeps Optional-first behavior) */
export const chain = <A, B>(base: OLens<A, B>) => ({
  p: (k: string) => chain(oCompose(base as any, prop<any, any>(k as any)) as any),
  i: (i: number) => chain(oCompose(base as any, index<any>(i)) as any),
  k: (k: string) => chain(oCompose(base as any, recordKey<any>(k)) as any),
  lens: () => base as OLens<A, any>,
});
