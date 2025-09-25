import { Optional, some, none, isFound } from "../external/Funk/optional/optional";
import { fold as foldEither } from "../external/Funk/optional/either";

/** Top/Bottom wrapper; Bottom carries no value */
export type TB<T> =
  | { tag: "Top";    value: T }
  | { tag: "Bottom" };

export const top = <T>(v: T): TB<T> => ({ tag: "Top", value: v });
export const bottom = <T = never>(): TB<T> => ({ tag: "Bottom" });

export const isTop = <T>(t: TB<T>): t is { tag: "Top"; value: T } => t.tag === "Top";
export const isBottom = <T>(t: TB<T>): t is { tag: "Bottom" } => t.tag === "Bottom";

/** Functor/Monad */
export const mapTB   = <A,B>(x: TB<A>, f: (a:A)=>B): TB<B> => isTop(x) ? top(f(x.value)) : bottom();
export const chainTB = <A,B>(x: TB<A>, f: (a:A)=>TB<B>): TB<B> => isTop(x) ? f(x.value) : bottom();
export const apTB    = <A,B>(fab: TB<(a:A)=>B>, xa: TB<A>): TB<B> =>
  isTop(fab) && isTop(xa) ? top(fab.value(xa.value)) : bottom();

/** Bridges with Optional */
export const fromOptionalTB = <A>(oa: Optional<A>): TB<A> => isFound(oa) ? top(foldEither(oa, ()=>null as any, r=>r)) : bottom();
export const toOptionalTB   = <A>(t: TB<A>): Optional<A> => isTop(t) ? some(t.value) : none<A>();
